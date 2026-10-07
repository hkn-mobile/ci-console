import { readFile, rename, writeFile } from "node:fs/promises";
import { configFile } from "./paths";

export type AppEntry = {
  name: string;
  /** owner/repo on GitHub. */
  repo: string;
};

export type ConsoleConfig = {
  apps: AppEntry[];
  /** Repos the token can reach that should not be offered as apps (e.g. ci-templates). */
  ignored: string[];
};

export const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

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
    return { name: app.name, repo: app.repo };
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
