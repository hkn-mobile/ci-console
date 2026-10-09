import { readFile, rename, writeFile } from "node:fs/promises";
import { configFile } from "./paths";

export type AppEntry = {
  name: string;
  /** owner/repo on GitHub. */
  repo: string;
  /**
   * GitHub environment holding this app's secrets and CFG_ variables, for a
   * repo with more than one app (each on its own branch). Unset = repo level.
   */
  environment?: string;
  /** The app's main branch in such a repo: releases run there and runs are filtered by it. */
  branch?: string;
};

export type ConsoleConfig = {
  apps: AppEntry[];
  /** Repos the token can reach that should not be offered as apps (e.g. ci-templates). */
  ignored: string[];
};

export const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const NAME_PATTERN = /^[A-Za-z0-9_./-]{1,100}$/;

/** What forms post to name an app: owner/repo, or owner/repo#environment. */
export const APP_ID_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(#[A-Za-z0-9_.-]+)?$/;

/**
 * Stable id of an app. The GitHub store reads "owner/repo#environment" as that
 * environment's secrets and variables, so secret and config calls take it as is.
 */
export function appId(app: Pick<AppEntry, "repo" | "environment">): string {
  return app.environment ? `${app.repo}#${app.environment}` : app.repo;
}

/** True when a run or build on this branch belongs to the app; apps without a branch own every branch. */
export function ownsBranch(app: Pick<AppEntry, "branch">, ...branches: (string | null | undefined)[]): boolean {
  return !app.branch || branches.includes(app.branch);
}

const CONFIG_FILE = configFile;

/** Reads console.config.json on every call so edits apply without a restart. */
export async function loadConfig(): Promise<ConsoleConfig> {
  const raw = JSON.parse(await readFile(CONFIG_FILE(), "utf8")) as { apps?: unknown; ignored?: unknown };
  if (!Array.isArray(raw.apps)) throw new Error("console.config.json needs an apps array");

  const apps = raw.apps.map((entry, index) => {
    const app = entry as Partial<AppEntry>;
    if (typeof app.name !== "string" || typeof app.repo !== "string" || !REPO_PATTERN.test(app.repo)) {
      throw new Error(`console.config.json apps[${index}] needs a name and an owner/repo`);
    }
    for (const field of ["environment", "branch"] as const) {
      if (app[field] !== undefined && (typeof app[field] !== "string" || !NAME_PATTERN.test(app[field]))) {
        throw new Error(`console.config.json apps[${index}].${field} is not a valid name`);
      }
    }
    return {
      name: app.name,
      repo: app.repo,
      ...(app.environment ? { environment: app.environment } : {}),
      ...(app.branch ? { branch: app.branch } : {}),
    };
  });
  const ignored = Array.isArray(raw.ignored) ? raw.ignored.filter((r): r is string => typeof r === "string") : [];
  return { apps, ignored };
}

export async function loadApps(): Promise<AppEntry[]> {
  return (await loadConfig()).apps;
}

/** Writes through a temp file so a crash never leaves half a config behind. */
export async function saveConfig(config: ConsoleConfig): Promise<void> {
  const file = CONFIG_FILE();
  const temp = `${file}.tmp`;
  await writeFile(temp, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  await rename(temp, file);
}

/** Turns "ac_remote_control" into "Ac Remote Control" as a starting display name. */
export function defaultAppName(repo: string): string {
  return repo
    .split("/")[1]
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}
