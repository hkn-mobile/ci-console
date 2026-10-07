import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { unzipSync } from "fflate";
import type { AppEntry } from "./config";
import { getStore, type SecretStore, type WorkflowRun } from "./github";
import { dataDir } from "./paths";

/** Workflows whose builds are kept, by file name in the app repo. */
export const ARCHIVED_WORKFLOWS = {
  release: "android-release.yml",
  ci: "android-ci.yml",
} as const;

export type BuildKind = keyof typeof ARCHIVED_WORKFLOWS;

export type BuildFile = { name: string; size: number; sha256: string };

export type BuildMeta = {
  repo: string;
  kind: BuildKind;
  runId: number;
  runNumber: number;
  runUrl: string;
  branch: string;
  commit: string;
  flavor: string;
  versionName: string;
  versionCode: number | null;
  /** True when the run also sent the bundle to Google Play. */
  upload: boolean;
  builtAt: string;
  archivedAt: string;
  files: BuildFile[];
};

const BUILD_FILE = "build.json";
const SKIP_FILE = "skip.json";
const KEEP_PER_APP = Number(process.env.CONSOLE_KEEP_BUILDS) || 30;
const SAFE_NAME = /^[A-Za-z0-9._-]+$/;

const buildsRoot = () => path.join(dataDir(), "builds");
export const repoKey = (repo: string) => repo.replace("/", "__");
const runDir = (repo: string, runId: number) => path.join(buildsRoot(), repoKey(repo), String(runId));

/** Shared across requests so a run is downloaded once even when several pages ask for it. */
const inFlight: Map<string, Promise<void>> = ((globalThis as { __ciArchiveInFlight?: Map<string, Promise<void>> })
  .__ciArchiveInFlight ??= new Map());
let queue: Promise<unknown> = Promise.resolve();

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

/** Downloads, unzips and stores one run's APK/AAB; one at a time to keep memory flat. */
function archiveRun(store: SecretStore, repo: string, kind: BuildKind, run: WorkflowRun): Promise<void> {
  const key = `${repo}#${run.id}`;
  const existing = inFlight.get(key);
  if (existing) return existing;

  const job = (queue = queue.then(() => doArchive(store, repo, kind, run)).catch((error) => {
    console.error(`[archive] ${key} failed:`, error instanceof Error ? error.message : error);
  })) as Promise<void>;
  const tracked = job.finally(() => inFlight.delete(key));
  inFlight.set(key, tracked);
  return tracked;
}

async function doArchive(store: SecretStore, repo: string, kind: BuildKind, run: WorkflowRun): Promise<void> {
  const dir = runDir(repo, run.id);
  if (await exists(path.join(dir, BUILD_FILE))) return;

  const artifacts = (await store.listArtifacts(repo, run.id)).filter((a) => !a.expired);
  await mkdir(dir, { recursive: true });
  if (artifacts.length === 0) {
    await writeFile(path.join(dir, SKIP_FILE), JSON.stringify({ reason: "no artifacts (expired or none)" }));
    return;
  }

  const files: BuildFile[] = [];
  let info: Record<string, unknown> = {};
  const guessed = guessFromNames(kind, artifacts[0].name);
  try {
    for (const artifact of artifacts) {
      const entries = unzipSync(await store.downloadArtifact(repo, artifact.id));
      for (const [entryPath, content] of Object.entries(entries)) {
        const name = path.basename(entryPath);
        if (name === "build-info.json") {
          info = JSON.parse(new TextDecoder().decode(content)) as Record<string, unknown>;
          continue;
        }
        if (!/\.(apk|aab)$/i.test(name) || !SAFE_NAME.test(name)) continue;
        await writeFile(path.join(dir, name), content);
        files.push({ name, size: content.byteLength, sha256: createHash("sha256").update(content).digest("hex") });
        guessed.flavor ||= name.match(/^app-([A-Za-z0-9]+)-release\./)?.[1] ?? "";
      }
    }
    if (files.length === 0) {
      await writeFile(path.join(dir, SKIP_FILE), JSON.stringify({ reason: "artifact had no apk or aab" }));
      return;
    }

    const meta: BuildMeta = {
      repo,
      kind,
      runId: run.id,
      runNumber: run.number,
      runUrl: run.url,
      branch: String(info.ref ?? run.branch),
      commit: String(info.commit ?? run.commit),
      flavor: String(info.flavor ?? guessed.flavor),
      versionName: String(info.versionName ?? ""),
      versionCode:
        typeof info.versionCode === "number" && info.versionCode > 0 ? info.versionCode : guessed.versionCode,
      upload: info.upload === true,
      builtAt: String(info.builtAt ?? run.createdAt),
      archivedAt: new Date().toISOString(),
      files,
    };
    const temp = path.join(dir, `${BUILD_FILE}.tmp`);
    await writeFile(temp, JSON.stringify(meta, null, 2));
    await rename(temp, path.join(dir, BUILD_FILE));
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
  await prune(repo);
}

/**
 * Labels for builds made before the workflows wrote build-info.json. Release
 * artifacts are named <repo>-<flavor>-<versionCode>; CI ones end in the PR
 * number instead, so only their flavor is taken.
 */
function guessFromNames(kind: BuildKind, artifactName: string): { flavor: string; versionCode: number | null } {
  const match = artifactName.match(/-([A-Za-z0-9]+)-(\d+)$/);
  return {
    flavor: match?.[1] === "release" ? "" : (match?.[1] ?? ""),
    versionCode: kind === "release" && match ? Number(match[2]) : null,
  };
}

/** Keeps every build that went to Play and the newest KEEP_PER_APP of the rest. */
async function prune(repo: string): Promise<void> {
  const builds = (await listBuilds()).filter((b) => b.repo === repo && !b.upload);
  for (const old of builds.slice(KEEP_PER_APP)) {
    await rm(runDir(repo, old.runId), { recursive: true, force: true });
  }
}

/**
 * Looks at the latest runs of each app and starts archiving the finished,
 * successful ones not stored yet. Called when a page opens; nothing polls.
 */
export async function syncBuilds(apps: AppEntry[], kinds: BuildKind[] = ["release", "ci"]): Promise<{ pending: number }> {
  let store: SecretStore;
  try {
    store = getStore();
  } catch {
    return { pending: inFlight.size };
  }

  await Promise.all(
    apps.flatMap((app) =>
      kinds.map(async (kind) => {
        let runs: WorkflowRun[];
        try {
          runs = await store.listRuns(app.repo, ARCHIVED_WORKFLOWS[kind], 10);
        } catch {
          return;
        }
        for (const run of runs) {
          if (run.status !== "completed" || run.conclusion !== "success") continue;
          const dir = runDir(app.repo, run.id);
          if ((await exists(path.join(dir, BUILD_FILE))) || (await exists(path.join(dir, SKIP_FILE)))) continue;
          void archiveRun(store, app.repo, kind, run);
        }
      }),
    ),
  );
  return { pending: inFlight.size };
}

export function pendingArchives(): number {
  return inFlight.size;
}

/** Every stored build, newest first. */
export async function listBuilds(): Promise<BuildMeta[]> {
  const builds: BuildMeta[] = [];
  let repos: string[];
  try {
    repos = await readdir(buildsRoot());
  } catch {
    return [];
  }
  for (const repo of repos) {
    let runs: string[];
    try {
      runs = await readdir(path.join(buildsRoot(), repo));
    } catch {
      continue;
    }
    for (const run of runs) {
      try {
        builds.push(JSON.parse(await readFile(path.join(buildsRoot(), repo, run, BUILD_FILE), "utf8")) as BuildMeta);
      } catch {
        // Not archived yet, skipped, or mid-download.
      }
    }
  }
  return builds.sort((a, b) => b.builtAt.localeCompare(a.builtAt));
}

/** Absolute path of a stored file, or null when the request does not name one. */
export async function resolveBuildFile(key: string, runId: string, name: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_.-]+__[A-Za-z0-9_.-]+$/.test(key) || !/^\d+$/.test(runId) || !SAFE_NAME.test(name)) return null;
  const file = path.join(buildsRoot(), key, runId, name);
  if (!file.startsWith(buildsRoot() + path.sep) || !(await exists(file))) return null;
  return file;
}

export async function readBuild(key: string, runId: string): Promise<BuildMeta | null> {
  if (!/^[A-Za-z0-9_.-]+__[A-Za-z0-9_.-]+$/.test(key) || !/^\d+$/.test(runId)) return null;
  try {
    return JSON.parse(await readFile(path.join(buildsRoot(), key, runId, BUILD_FILE), "utf8")) as BuildMeta;
  } catch {
    return null;
  }
}
