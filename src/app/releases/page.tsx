import Link from "next/link";
import { connection } from "next/server";
import { listBuilds, syncBuilds, type BuildMeta } from "@/lib/archive";
import { isActive, loadReleases, loadRunners, RELEASE_WORKFLOW, type AppRun, type RunnerStatus } from "@/lib/releases";
import { formatDate } from "@/lib/status";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Badge } from "@/components/Badge";
import { PageHeader } from "@/components/PageHeader";
import { cardClass } from "@/components/ui";
import { ReleaseForm } from "./ReleaseForm";

const KIND_LABEL = { release: "Phát hành", ci: "CI" } as const;

export default async function ReleasesPage() {
  await connection();
  const { apps, error } = await loadReleases();
  const [runners, { pending }] = await Promise.all([loadRunners(apps), syncBuilds(apps)]);
  const archived = new Map((await listBuilds()).map((b) => [b.runId, b]));
  const running = apps.some((app) => app.runs.some(isActive)) || pending > 0;

  return (
    <div className="space-y-8">
      <AutoRefresh active={running} />
      <PageHeader title="Phát hành và lần chạy">
        Chạy workflow <code className="font-mono text-fg">{RELEASE_WORKFLOW}</code> của từng app và theo dõi các lần chạy gần đây của cả
        Android CI lẫn Android Release.
        {running && <span className="mt-2 block text-accent">Có lần chạy đang diễn ra, trang tự làm mới mỗi 8 giây.</span>}
      </PageHeader>

      {error && <div className="rounded-xl border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad">{error}</div>}

      {runners.length > 0 && <RunnerPanel statuses={runners} />}

      <div className="space-y-6">
        {apps.map((app) => (
          <section key={app.id} className={cardClass}>
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-4">
              <div>
                <h2 className="font-semibold">{app.name}</h2>
                <a
                  href={`https://github.com/${app.repo}/actions`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[11px] text-fg-faint hover:text-accent"
                >
                  {app.repo}
                  {app.branch && ` · ${app.branch}`} ↗
                </a>
              </div>
              {app.runs[0] && <RunBadge run={app.runs[0]} />}
            </header>

            {app.error ? (
              <p className="px-5 py-4 text-sm text-bad">{app.error}</p>
            ) : (
              <div className="grid gap-6 p-5 lg:grid-cols-[1fr_380px]">
                {app.hasWorkflow ? (
                  <ReleaseForm repo={app.id} defaultBranch={app.defaultBranch ?? "main"} />
                ) : (
                  <p className="text-sm text-fg-muted">
                    Repo chưa có <code className="font-mono">.github/workflows/{RELEASE_WORKFLOW}</code> trên nhánh mặc định. Chạy script{" "}
                    <code className="font-mono">setup_flutter_project.py</code> trong ci-templates cho app này trước.
                  </p>
                )}
                <RunList runs={app.runs} archived={archived} />
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

/** Online / busy state of the self-hosted build machines. */
function RunnerPanel({ statuses }: { statuses: RunnerStatus[] }) {
  return (
    <section className={`${cardClass} px-5 py-4`}>
      <h2 className="text-xs font-medium uppercase tracking-wide text-fg-muted">Máy build</h2>
      <ul className="mt-3 space-y-2">
        {statuses.map((status) =>
          status.error ? (
            <li key={status.org} className="text-sm text-fg-faint">
              <span className="font-mono">{status.org}</span>: {status.error}
            </li>
          ) : status.runners.length === 0 ? (
            <li key={status.org} className="text-sm text-fg-muted">
              <span className="font-mono">{status.org}</span>: chưa có máy build tự host; các lần chạy dùng máy của GitHub.
            </li>
          ) : (
            status.runners.map((runner) => (
              <li key={`${status.org}/${runner.name}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="font-medium">{runner.name}</span>
                {runner.status === "offline" ? (
                  <Badge tone="bad">Offline</Badge>
                ) : runner.busy ? (
                  <Badge tone="warn">Đang build</Badge>
                ) : (
                  <Badge tone="ok">Sẵn sàng</Badge>
                )}
                <span className="font-mono text-[11px] text-fg-faint">
                  {status.org} · {runner.labels.filter((l) => !["self-hosted", "Linux", "X64"].includes(l)).join(", ")}
                </span>
              </li>
            ))
          ),
        )}
      </ul>
    </section>
  );
}

function RunList({ runs, archived }: { runs: AppRun[]; archived: Map<number, BuildMeta> }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-fg-muted">Lần chạy gần đây</h3>
      {runs.length === 0 ? (
        <p className="text-sm text-fg-faint">Chưa chạy lần nào.</p>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-line">
          {runs.map((run) => (
            <li key={`${run.kind}-${run.id}`} className="flex items-center border-b border-line last:border-0">
              <a href={run.url} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 transition hover:bg-surface-2">
                <span className="w-16 shrink-0">
                  <span className="block text-[11px] font-medium text-fg-muted">{KIND_LABEL[run.kind]}</span>
                  <span className="block font-mono text-xs text-fg-faint">#{run.number}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs text-fg">
                    {formatDate(run.createdAt)}
                    {run.prNumber !== null && <span className="text-fg-muted"> · PR #{run.prNumber}</span>}
                  </span>
                  {isActive(run) && run.progress ? (
                    <span className="block truncate text-[11px] text-accent">
                      {run.progress.runner ? `${run.progress.runner}` : "Đang chờ máy build"}
                      {run.progress.step && ` · ${run.progress.step}`}
                    </span>
                  ) : (
                    <span className="block truncate font-mono text-[11px] text-fg-faint">
                      {run.branch}
                      {run.actor && ` · ${run.actor}`}
                    </span>
                  )}
                </span>
                <RunBadge run={run} />
              </a>
              {archived.has(run.id) && (
                <Link
                  href="/builds"
                  aria-label={`Tải bản build của lần chạy #${run.number}`}
                  className="shrink-0 px-3 text-xs text-accent hover:underline"
                >
                  Tải
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RunBadge({ run }: { run: AppRun }) {
  if (isActive(run)) return <Badge tone="neutral">{run.status === "in_progress" ? "Đang chạy" : "Đang chờ"}</Badge>;
  if (run.conclusion === "success") return <Badge tone="ok">Thành công</Badge>;
  if (run.conclusion === "cancelled" || run.conclusion === "skipped") return <Badge tone="neutral">Đã huỷ</Badge>;
  return <Badge tone="bad">Lỗi</Badge>;
}
