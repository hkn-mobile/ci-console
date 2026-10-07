import { loadConfig } from "./config";
import { getStore, GitHubError } from "./github";

export type Candidate = { repo: string; private: boolean };

/**
 * Repos the token may manage secrets for that are neither listed as apps nor
 * hidden. Repos without the Secrets grant are only counted, never offered.
 */
export async function loadCandidates(): Promise<{
  candidates: Candidate[];
  ignored: string[];
  withoutAccess: number;
  error?: string;
}> {
  const config = await loadConfig();
  const listed = new Set(config.apps.map((a) => a.repo.toLowerCase()));
  const ignored = new Set(config.ignored.map((r) => r.toLowerCase()));

  try {
    const store = getStore();
    const repos = (await store.listRepos()).filter(
      (r) => !listed.has(r.repo.toLowerCase()) && !ignored.has(r.repo.toLowerCase()),
    );
    const access = await Promise.all(repos.map((r) => store.canManageSecrets(r.repo)));
    return {
      candidates: repos.filter((_, i) => access[i]),
      ignored: config.ignored,
      withoutAccess: access.filter((ok) => !ok).length,
    };
  } catch (error) {
    const message = error instanceof GitHubError ? error.message : "Không đọc được danh sách repo của token";
    return { candidates: [], ignored: config.ignored, withoutAccess: 0, error: message };
  }
}
