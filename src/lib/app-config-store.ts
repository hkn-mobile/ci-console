import { getStore } from "./github";
import { CONFIG_PREFIX, type ConfigEntry } from "./app-config";

/** Every CFG_ variable and secret of a repo, sorted by key. */
export async function loadAppConfig(repo: string): Promise<ConfigEntry[]> {
  const store = getStore();
  const [variables, secrets] = await Promise.all([store.listVariables(repo), store.listSecrets(repo)]);
  const strip = (name: string) => name.slice(CONFIG_PREFIX.length);
  return [
    ...variables
      .filter((v) => v.name.startsWith(CONFIG_PREFIX))
      .map((v) => ({ key: strip(v.name), secret: false, value: v.value, updatedAt: v.updatedAt })),
    ...secrets
      .filter((s) => s.name.startsWith(CONFIG_PREFIX))
      .map((s) => ({ key: strip(s.name), secret: true, updatedAt: s.updatedAt })),
  ].sort((a, b) => a.key.localeCompare(b.key));
}
