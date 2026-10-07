import { loadApps, type AppEntry } from "./config";
import { getStore, GitHubError, type RunnerInfo, type RunProgress, type SecretStore, type WorkflowRun } from "./github";

/** Workflow file the ci-templates setup script writes into every app. */
export const RELEASE_WORKFLOW = "android-release.yml";
export const CI_WORKFLOW = "android-ci.yml";

export type RunKind = "release" | "ci";

/** A run of either workflow, with live progress while it is still going. */
export type AppRun = WorkflowRun & { kind: RunKind; progress?: RunProgress };

export type ReleaseStatus = AppEntry & {
  defaultBranch?: string;
  hasWorkflow: boolean;
  runs: AppRun[];
  error?: string;
};

export type RunnerStatus = { org: string; runners: RunnerInfo[]; error?: string };

const RUNS_SHOWN = 6;

const messageOf = (error: unknown, fallback: string) => (error instanceof GitHubError ? error.message : fallback);

async function runsOf(store: SecretStore, repo: string, workflow: string, kind: RunKind): Promise<AppRun[]> {
  try {
    return (await store.listRuns(repo, workflow, RUNS_SHOWN)).map((run) => ({ ...run, kind }));
  } catch (error) {
    // An app without this workflow simply has no runs of it.
    if (error instanceof GitHubError && error.status === 404) return [];
    throw error;
  }
}

/** Latest CI and release runs for every app; one failing repo does not hide the rest. */
export async function loadReleases(): Promise<{ apps: ReleaseStatus[]; error?: string }> {
  const apps = await loadApps();
  let store: SecretStore;
  try {
    store = getStore();
  } catch (error) {
    return { apps: apps.map((a) => ({ ...a, hasWorkflow: false, runs: [] })), error: messageOf(error, "Không kết nối được GitHub") };
  }

  const statuses = await Promise.all(
    apps.map(async (app): Promise<ReleaseStatus> => {
      try {
        const [defaultBranch, hasWorkflow, releaseRuns, ciRuns] = await Promise.all([
          store.defaultBranch(app.repo),
          store.hasWorkflow(app.repo, RELEASE_WORKFLOW),
          runsOf(store, app.repo, RELEASE_WORKFLOW, "release"),
          runsOf(store, app.repo, CI_WORKFLOW, "ci"),
        ]);
        const runs = [...releaseRuns, ...ciRuns]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, RUNS_SHOWN);
        // Only runs still going cost an extra call, to show where they are.
        await Promise.all(
          runs.filter(isActive).map(async (run) => {
            try {
              run.progress = await store.runProgress(app.repo, run.id);
            } catch {
              run.progress = { runner: null, step: null };
            }
          }),
        );
        return { ...app, defaultBranch, hasWorkflow, runs };
      } catch (error) {
        return { ...app, hasWorkflow: false, runs: [], error: messageOf(error, "Không đọc được workflow") };
      }
    }),
  );
  return { apps: statuses };
}

/** Self-hosted runners of every organization that owns a listed app. */
export async function loadRunners(apps: AppEntry[]): Promise<RunnerStatus[]> {
  let store: SecretStore;
  try {
    store = getStore();
  } catch {
    return [];
  }
  const owners = [...new Set(apps.map((a) => a.repo.split("/")[0]))];
  return Promise.all(
    owners.map(async (org): Promise<RunnerStatus> => {
      try {
        return { org, runners: await store.listOrgRunners(org) };
      } catch {
        return { org, runners: [], error: "Không đọc được máy build (tài khoản cá nhân, hoặc token thiếu quyền Self-hosted runners)" };
      }
    }),
  );
}

export function isActive(run: WorkflowRun): boolean {
  return run.status !== "completed";
}
