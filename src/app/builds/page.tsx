import Link from "next/link";
import { headers } from "next/headers";
import { connection } from "next/server";
import QRCode from "qrcode";
import { listBuilds, repoKey, syncBuilds, type BuildMeta } from "@/lib/archive";
import { loadApps } from "@/lib/config";
import { formatDate } from "@/lib/status";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Badge } from "@/components/Badge";
import { PageHeader } from "@/components/PageHeader";
import { cardClass, ghostButton } from "@/components/ui";

const KIND_LABEL = { release: "Phát hành", ci: "CI (PR)" } as const;

export default async function BuildsPage({ searchParams }: { searchParams: Promise<{ app?: string }> }) {
  await connection();
  const { app: selected } = await searchParams;
  const apps = await loadApps();
  const { pending } = await syncBuilds(apps);
  const names = new Map(apps.map((a) => [a.repo, a.name]));
  const builds = (await listBuilds()).filter((b) => !selected || b.repo === selected);

  const host = (await headers()).get("host") ?? "localhost:3100";
  const origin = `http://${host}`;

  return (
    <div className="space-y-8">
      <AutoRefresh active={pending > 0} intervalMs={5000} />
      <PageHeader title="Bản build">
        File APK và AAB được lưu lại trên server sau mỗi lần build thành công, kể cả khi GitHub đã xoá. Web chỉ hỏi GitHub khi bạn mở
        trang này hoặc trang Phát hành.
        {pending > 0 && <span className="mt-2 block text-accent">Đang tải {pending} bản build từ GitHub về server…</span>}
      </PageHeader>

      <nav className="flex flex-wrap gap-1.5">
        <FilterLink href="/builds" active={!selected}>
          Tất cả
        </FilterLink>
        {apps.map((app) => (
          <FilterLink key={app.repo} href={`/builds?app=${encodeURIComponent(app.repo)}`} active={selected === app.repo}>
            {app.name}
          </FilterLink>
        ))}
      </nav>

      {builds.length === 0 ? (
        <div className={`${cardClass} px-5 py-8 text-center text-sm text-fg-muted`}>
          Chưa có bản build nào được lưu. Chạy Android Release ở trang <Link href="/releases" className="text-accent">Phát hành</Link>{" "}
          hoặc mở một PR để có bản build đầu tiên.
        </div>
      ) : (
        <ul className={cardClass}>
          {await Promise.all(builds.map(async (build) => <BuildRow key={`${build.repo}-${build.runId}`} build={build} appName={names.get(build.repo) ?? build.repo} origin={origin} />))}
        </ul>
      )}
    </div>
  );
}

async function BuildRow({ build, appName, origin }: { build: BuildMeta; appName: string; origin: string }) {
  const base = `/builds/file/${repoKey(build.repo)}/${build.runId}`;
  const apk = build.files.find((f) => f.name.toLowerCase().endsWith(".apk"));
  const qr = apk ? await QRCode.toString(`${origin}${base}/${apk.name}`, { type: "svg", margin: 1, width: 168 }) : null;

  return (
    <li className="grid gap-3 border-b border-line px-5 py-4 last:border-0 md:grid-cols-[1fr_auto] md:items-center">
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{appName}</span>
          <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-fg-muted">{KIND_LABEL[build.kind]}</span>
          {build.flavor && <span className="rounded bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent">{build.flavor}</span>}
          {build.upload ? <Badge tone="ok">Đã đẩy lên Play</Badge> : build.kind === "release" && <Badge tone="neutral">Chạy thử</Badge>}
        </div>
        <div className="text-sm text-fg">
          {build.versionName || "—"}
          {build.versionCode !== null && <span className="text-fg-muted"> ({build.versionCode})</span>}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-fg-faint">
          <span>{formatDate(build.builtAt)}</span>
          <span className="font-mono">
            {build.branch} · {build.commit.slice(0, 7)}
          </span>
          <a href={build.runUrl} target="_blank" rel="noreferrer" className="hover:text-accent">
            Lần chạy #{build.runNumber} ↗
          </a>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {build.files.map((file) => (
          <a key={file.name} href={`${base}/${file.name}`} className={`${ghostButton} py-1.5`} title={`SHA-256 ${file.sha256}`}>
            Tải {file.name.split(".").pop()?.toUpperCase()} · {formatSize(file.size)}
          </a>
        ))}
        {qr && (
          <details className="relative">
            <summary className={`${ghostButton} cursor-pointer list-none py-1.5`}>QR</summary>
            <div className="absolute right-0 z-10 mt-2 rounded-lg border border-line bg-white p-2 shadow-lg">
              <div className="size-[168px]" dangerouslySetInnerHTML={{ __html: qr }} />
              <p className="mt-1 max-w-[168px] text-center text-[10px] text-zinc-600">Quét bằng điện thoại trong mạng công ty để cài APK, không cần mật khẩu</p>
            </div>
          </details>
        )}
      </div>
    </li>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-sm transition ${
        active ? "border-accent bg-accent-soft text-accent" : "border-line text-fg-muted hover:text-fg"
      }`}
    >
      {children}
    </Link>
  );
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
