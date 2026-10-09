import Link from "next/link";
import { connection } from "next/server";
import { SECRETS } from "@/lib/catalog";
import { formatDate, loadStatus } from "@/lib/status";
import { loadCandidates } from "@/lib/candidates";
import { defaultAppName } from "@/lib/config";
import { AppName, CandidateRow, RemoveAppButton, UnhideButton } from "@/components/RepoListForms";
import { Badge } from "@/components/Badge";
import { PageHeader } from "@/components/PageHeader";
import { cardClass } from "@/components/ui";

export default async function Home() {
  await connection();
  const [{ apps, error }, offer] = await Promise.all([loadStatus(), loadCandidates()]);
  const reachable = apps.filter((a) => !a.error);
  const total = reachable.length * SECRETS.length;
  const present = reachable.reduce((n, app) => n + SECRETS.filter((s) => app.secrets.has(s.name)).length, 0);
  const complete = reachable.filter((app) => SECRETS.every((s) => app.secrets.has(s.name))).length;

  return (
    <div className="space-y-8">
      <PageHeader title="Secret của các app">
        GitHub chỉ cho ghi, không cho đọc lại giá trị. Bảng này cho biết secret nào đã có và lần cập nhật cuối; bấm tên cột để điền
        cho nhiều app cùng lúc.
      </PageHeader>

      {error && <Notice tone="bad">{error}</Notice>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="App" value={apps.length} note={apps.length - reachable.length ? `${apps.length - reachable.length} không đọc được` : "đều đọc được"} />
        <Stat label="Secret đã có" value={`${present}/${total}`} note={total - present ? `${total - present} còn thiếu` : "không thiếu gì"} tone={total - present ? "warn" : "ok"} />
        <Stat label="App sẵn sàng phát hành" value={`${complete}/${apps.length}`} note={`đủ cả ${SECRETS.length} secret`} tone={complete === apps.length ? "ok" : "neutral"} />
      </div>

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full min-w-[760px] table-fixed text-sm">
          <colgroup>
            <col className="w-48" />
            {SECRETS.map((secret) => (
              <col key={secret.name} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-line bg-surface-2/60 text-left">
              <th className="sticky left-0 bg-surface-2 px-4 py-3 text-xs font-medium uppercase tracking-wide text-fg-muted">App</th>
              {SECRETS.map((secret) => (
                <th key={secret.name} className="px-4 py-3 align-top">
                  <Link href={`/secrets/${secret.name}`} className="group block" title={secret.help}>
                    <span className="font-medium text-fg group-hover:text-accent">{secret.label}</span>
                    <span className="mt-0.5 block font-mono text-[10px] font-normal text-fg-faint [overflow-wrap:anywhere]">{secret.name}</span>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {apps.map((app) => (
              <tr key={app.id} className="border-b border-line last:border-0 hover:bg-surface-2/40">
                <td className="sticky left-0 bg-surface px-4 py-3">
                  <AppName repo={app.id} name={app.name} />
                  <a
                    href={`https://github.com/${app.repo}/settings/${app.environment ? `environments` : "secrets/actions"}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block font-mono text-[11px] text-fg-faint [overflow-wrap:anywhere] hover:text-accent"
                  >
                    {app.repo}
                    {app.environment && ` · ${app.environment}`} ↗
                  </a>
                  {app.error && <div className="mt-1 max-w-56 text-xs text-bad">{app.error}</div>}
                  <div className="mt-1.5">
                    <RemoveAppButton repo={app.id} name={app.name} />
                  </div>
                </td>
                {SECRETS.map((secret) => {
                  const info = app.secrets.get(secret.name);
                  return (
                    <td key={secret.name} className="px-4 py-3 align-top">
                      {app.error ? (
                        <span className="text-fg-faint">—</span>
                      ) : info ? (
                        <div className="space-y-1">
                          <Badge tone="ok">Đã có</Badge>
                          <div className="text-[11px] text-fg-faint">{formatDate(info.updatedAt)}</div>
                        </div>
                      ) : (
                        <Link href={`/secrets/${secret.name}`} aria-label={`Điền ${secret.label} cho ${app.name}`}>
                          <Badge tone="warn">Thiếu</Badge>
                        </Link>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Repo chưa có trong danh sách</h2>
          <p className="mt-1 text-sm text-fg-muted">
            Các repo token có quyền Secrets nhưng chưa là app. Cấp thêm repo cho token trên GitHub rồi tải lại trang là repo hiện ở
            đây.
          </p>
        </div>
        {offer.error ? (
          <Notice tone="bad">{offer.error}</Notice>
        ) : offer.candidates.length > 0 ? (
          <ul className={cardClass}>
            {offer.candidates.map((c) => (
              <CandidateRow key={c.repo} repo={c.repo} isPrivate={c.private} suggestedName={defaultAppName(c.repo)} />
            ))}
          </ul>
        ) : (
          <div className={`${cardClass} px-4 py-5 text-sm text-fg-muted`}>Không còn repo nào để thêm.</div>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-fg-faint">
          {offer.withoutAccess > 0 && <span>{offer.withoutAccess} repo khác token thấy được nhưng không có quyền Secrets.</span>}
          {offer.ignored.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer list-none hover:text-fg">Đã ẩn {offer.ignored.length} repo ⌄</summary>
              <ul className="mt-2 space-y-1.5">
                {offer.ignored.map((repo) => (
                  <li key={repo} className="flex items-center gap-2">
                    <span className="font-mono">{repo}</span>
                    <UnhideButton repo={repo} />
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  note: string;
  tone?: "ok" | "warn" | "neutral";
}) {
  const noteColor = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-fg-muted";
  return (
    <div className={`${cardClass} p-4`}>
      <div className="text-xs font-medium uppercase tracking-wide text-fg-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      <div className={`mt-0.5 text-xs ${noteColor}`}>{note}</div>
    </div>
  );
}

function Notice({ children }: { tone: "bad"; children: React.ReactNode }) {
  return <div className="rounded-xl border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad">{children}</div>;
}
