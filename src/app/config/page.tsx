import Link from "next/link";
import { connection } from "next/server";
import type { ConfigEntry } from "@/lib/app-config";
import { loadAppConfig } from "@/lib/app-config-store";
import { loadApps } from "@/lib/config";
import { GitHubError } from "@/lib/github";
import { formatDate } from "@/lib/status";
import { PageHeader } from "@/components/PageHeader";
import { cardClass, ghostButton } from "@/components/ui";
import { AddEntryForm, EntryRow, ImportForm } from "./ConfigForms";

export default async function ConfigPage({ searchParams }: { searchParams: Promise<{ app?: string }> }) {
  await connection();
  const apps = await loadApps();
  const { app: picked } = await searchParams;
  const app = apps.find((a) => a.repo === picked) ?? apps[0];

  let entries: ConfigEntry[] = [];
  let error: string | undefined;
  if (app) {
    try {
      entries = await loadAppConfig(app.repo);
    } catch (e) {
      error = e instanceof GitHubError ? e.message : "Không đọc được config";
    }
  }
  const secrets = entries.filter((e) => e.secret).length;

  return (
    <div className="space-y-8">
      <PageHeader title="Config của app">
        Mỗi dòng là một key app đọc bằng <code className="font-mono text-fg">String.fromEnvironment(&apos;KEY&apos;)</code>. Dòng{" "}
        <b className="font-medium text-fg">Thường</b> lưu vào GitHub Variables, xem lại được; dòng <b className="font-medium text-fg">Bí mật</b> lưu
        vào Secrets, chỉ ghi được, không xem lại được. Khi build, CI gom tất cả thành <code className="font-mono text-fg">config/app.json</code>.
      </PageHeader>

      {apps.length === 0 ? (
        <p className="text-sm text-fg-muted">Chưa có app nào. Thêm app ở trang Tổng quan.</p>
      ) : (
        <nav aria-label="Chọn app" className="flex flex-wrap gap-2">
          {apps.map((a) => (
            <Link
              key={a.repo}
              href={`/config?app=${encodeURIComponent(a.repo)}`}
              aria-current={a.repo === app?.repo ? "page" : undefined}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                a.repo === app?.repo ? "border-accent bg-accent-soft font-medium text-fg" : "border-line text-fg-muted hover:border-line-strong hover:text-fg"
              }`}
            >
              {a.name}
            </Link>
          ))}
        </nav>
      )}

      {app && (
        <>
          <section className={cardClass}>
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <h2 className="font-semibold">{app.name}</h2>
                <p className="text-xs text-fg-muted">
                  {error ? (
                    <span className="text-bad">{error}</span>
                  ) : (
                    `${entries.length} dòng · ${entries.length - secrets} thường · ${secrets} bí mật`
                  )}
                </p>
              </div>
              {!error && entries.length > 0 && (
                <a href={`/config/download?app=${encodeURIComponent(app.repo)}`} className={ghostButton} title="Dòng bí mật để trống, điền tay">
                  Tải app.json
                </a>
              )}
            </header>
            {!error &&
              (entries.length === 0 ? (
                <p className="px-5 py-6 text-sm text-fg-muted">Chưa có dòng nào. Thêm từng dòng bên dưới hoặc nhập cả file app.json.</p>
              ) : (
                <ul>
                  {entries.map((entry) => (
                    <EntryRow key={`${entry.secret}-${entry.key}`} repo={app.repo} entry={entry} updatedAt={formatDate(entry.updatedAt)} />
                  ))}
                </ul>
              ))}
          </section>

          {!error && (
            <>
              <AddEntryForm repo={app.repo} />
              <ImportForm repo={app.repo} />
            </>
          )}
        </>
      )}
    </div>
  );
}
