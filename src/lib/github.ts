import { sealForGitHub } from "./seal";

export type SecretInfo = { name: string; updatedAt: string };

/** A repository variable; unlike a secret, its value can be read back. */
export type VariableInfo = { name: string; value: string; updatedAt: string };

export type RepoInfo = { repo: string; private: boolean };

export type RunStatus = "queued" | "in_progress" | "completed" | "waiting" | "requested" | "pending";

export type WorkflowRun = {
  id: number;
  number: number;
  status: RunStatus;
  /** success, failure, cancelled, ... once status is completed. */
  conclusion: string | null;
  branch: string;
  commit: string;
  /** Set when the run was triggered by a pull request. */
  prNumber: number | null;
  actor: string;
  createdAt: string;
  updatedAt: string;
  url: string;
};

/** Where a running workflow is right now. */
export type RunProgress = { runner: string | null; step: string | null };

export type RunnerInfo = { name: string; status: "online" | "offline"; busy: boolean; labels: string[] };

export type ArtifactInfo = { id: number; name: string; size: number; expired: boolean };

/** Values for the workflow_dispatch inputs of android-release.yml. */
export type ReleaseInputs = { upload: boolean; versionCode: string; versionName: string };

/** Which grant a failed call needed, so the error names the missing permission. */
type Scope = "Secrets" | "Variables" | "Actions" | "Metadata";

/** What the console needs from GitHub; secret values can be written but never read back. */
export interface SecretStore {
  listSecrets(repo: string): Promise<SecretInfo[]>;
  setSecret(repo: string, name: string, value: string): Promise<void>;
  deleteSecret(repo: string, name: string): Promise<void>;
  listVariables(repo: string): Promise<VariableInfo[]>;
  /** Creates the variable, or overwrites it when it already exists. */
  setVariable(repo: string, name: string, value: string): Promise<void>;
  deleteVariable(repo: string, name: string): Promise<void>;
  /** Repos the token can reach, whether or not it may write their secrets. */
  listRepos(): Promise<RepoInfo[]>;
  /** True when the token may read (and so, with a write grant, set) the repo's secrets. */
  canManageSecrets(repo: string): Promise<boolean>;
  defaultBranch(repo: string): Promise<string>;
  /** False when the workflow file is not on the default branch. */
  hasWorkflow(repo: string, workflow: string): Promise<boolean>;
  listRuns(repo: string, workflow: string, limit: number): Promise<WorkflowRun[]>;
  dispatchRelease(repo: string, workflow: string, ref: string, inputs: ReleaseInputs): Promise<void>;
  listArtifacts(repo: string, runId: number): Promise<ArtifactInfo[]>;
  runProgress(repo: string, runId: number): Promise<RunProgress>;
  /** Self-hosted runners of an organization; fails for personal accounts. */
  listOrgRunners(org: string): Promise<RunnerInfo[]>;
  /** The artifact's zip archive. */
  downloadArtifact(repo: string, artifactId: number): Promise<Uint8Array>;
}

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const API = "https://api.github.com";

class GitHubSecretStore implements SecretStore {
  constructor(private readonly token: string) {}

  private async request(method: string, url: string, scope: Scope, body?: unknown): Promise<Response> {
    const response = await fetch(`${API}${url}`, {
      method,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      throw new GitHubError(describe(response.status, scope), response.status);
    }
    return response;
  }

  async listSecrets(repo: string): Promise<SecretInfo[]> {
    const response = await this.request("GET", `/repos/${repo}/actions/secrets?per_page=100`, "Secrets");
    const data = (await response.json()) as { secrets: { name: string; updated_at: string }[] };
    return data.secrets.map((s) => ({ name: s.name, updatedAt: s.updated_at }));
  }

  async setSecret(repo: string, name: string, value: string): Promise<void> {
    const keyResponse = await this.request("GET", `/repos/${repo}/actions/secrets/public-key`, "Secrets");
    const { key, key_id } = (await keyResponse.json()) as { key: string; key_id: string };
    const encrypted_value = await sealForGitHub(value, key);
    await this.request("PUT", `/repos/${repo}/actions/secrets/${name}`, "Secrets", { encrypted_value, key_id });
  }

  async deleteSecret(repo: string, name: string): Promise<void> {
    await this.request("DELETE", `/repos/${repo}/actions/secrets/${name}`, "Secrets");
  }

  async listVariables(repo: string): Promise<VariableInfo[]> {
    const variables: VariableInfo[] = [];
    // GitHub caps this endpoint at 30 per page.
    for (let page = 1; page <= 20; page++) {
      const response = await this.request("GET", `/repos/${repo}/actions/variables?per_page=30&page=${page}`, "Variables");
      const data = (await response.json()) as { total_count: number; variables: { name: string; value: string; updated_at: string }[] };
      variables.push(...data.variables.map((v) => ({ name: v.name, value: v.value, updatedAt: v.updated_at })));
      if (variables.length >= data.total_count || data.variables.length === 0) break;
    }
    return variables;
  }

  async setVariable(repo: string, name: string, value: string): Promise<void> {
    try {
      await this.request("POST", `/repos/${repo}/actions/variables`, "Variables", { name, value });
    } catch (error) {
      if (!(error instanceof GitHubError && error.status === 409)) throw error;
      await this.request("PATCH", `/repos/${repo}/actions/variables/${name}`, "Variables", { name, value });
    }
  }

  async deleteVariable(repo: string, name: string): Promise<void> {
    await this.request("DELETE", `/repos/${repo}/actions/variables/${name}`, "Variables");
  }

  async listRepos(): Promise<RepoInfo[]> {
    const repos: RepoInfo[] = [];
    for (let page = 1; page <= 10; page++) {
      const response = await this.request("GET", `/user/repos?per_page=100&page=${page}&sort=full_name`, "Metadata");
      const batch = (await response.json()) as { full_name: string; private: boolean }[];
      repos.push(...batch.map((r) => ({ repo: r.full_name, private: r.private })));
      if (batch.length < 100) break;
    }
    return repos;
  }

  async canManageSecrets(repo: string): Promise<boolean> {
    try {
      await this.request("GET", `/repos/${repo}/actions/secrets?per_page=1`, "Secrets");
      return true;
    } catch (error) {
      if (error instanceof GitHubError && [403, 404].includes(error.status)) return false;
      throw error;
    }
  }

  async defaultBranch(repo: string): Promise<string> {
    const response = await this.request("GET", `/repos/${repo}`, "Metadata");
    return ((await response.json()) as { default_branch: string }).default_branch;
  }

  async hasWorkflow(repo: string, workflow: string): Promise<boolean> {
    try {
      await this.request("GET", `/repos/${repo}/actions/workflows/${workflow}`, "Actions");
      return true;
    } catch (error) {
      if (error instanceof GitHubError && error.status === 404) return false;
      throw error;
    }
  }

  async listRuns(repo: string, workflow: string, limit: number): Promise<WorkflowRun[]> {
    const response = await this.request("GET", `/repos/${repo}/actions/workflows/${workflow}/runs?per_page=${limit}`, "Actions");
    const data = (await response.json()) as {
      workflow_runs: {
        id: number;
        run_number: number;
        status: RunStatus;
        conclusion: string | null;
        head_branch: string;
        head_sha: string;
        pull_requests?: { number: number }[];
        actor?: { login: string };
        created_at: string;
        updated_at: string;
        html_url: string;
      }[];
    };
    return data.workflow_runs.map((r) => ({
      id: r.id,
      number: r.run_number,
      status: r.status,
      conclusion: r.conclusion,
      branch: r.head_branch,
      commit: r.head_sha,
      prNumber: r.pull_requests?.[0]?.number ?? null,
      actor: r.actor?.login ?? "",
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      url: r.html_url,
    }));
  }

  async dispatchRelease(repo: string, workflow: string, ref: string, inputs: ReleaseInputs): Promise<void> {
    await this.request("POST", `/repos/${repo}/actions/workflows/${workflow}/dispatches`, "Actions", {
      ref,
      inputs: {
        upload: String(inputs.upload),
        "version-code": inputs.versionCode,
        "version-name": inputs.versionName,
      },
    });
  }

  async runProgress(repo: string, runId: number): Promise<RunProgress> {
    const response = await this.request("GET", `/repos/${repo}/actions/runs/${runId}/jobs?per_page=20`, "Actions");
    const data = (await response.json()) as {
      jobs: { status: string; runner_name: string | null; steps?: { name: string; status: string }[] }[];
    };
    const job = data.jobs.find((j) => j.status === "in_progress") ?? data.jobs[0];
    return {
      runner: job?.runner_name || null,
      step: job?.steps?.find((st) => st.status === "in_progress")?.name ?? null,
    };
  }

  async listOrgRunners(org: string): Promise<RunnerInfo[]> {
    const response = await this.request("GET", `/orgs/${org}/actions/runners?per_page=100`, "Metadata");
    const data = (await response.json()) as {
      runners: { name: string; status: "online" | "offline"; busy: boolean; labels: { name: string }[] }[];
    };
    return data.runners.map((r) => ({ name: r.name, status: r.status, busy: r.busy, labels: r.labels.map((l) => l.name) }));
  }

  async listArtifacts(repo: string, runId: number): Promise<ArtifactInfo[]> {
    const response = await this.request("GET", `/repos/${repo}/actions/runs/${runId}/artifacts?per_page=100`, "Actions");
    const data = (await response.json()) as {
      artifacts: { id: number; name: string; size_in_bytes: number; expired: boolean }[];
    };
    return data.artifacts.map((a) => ({ id: a.id, name: a.name, size: a.size_in_bytes, expired: a.expired }));
  }

  async downloadArtifact(repo: string, artifactId: number): Promise<Uint8Array> {
    // GitHub answers with a redirect to blob storage; fetch drops the token on that cross-origin hop.
    const response = await this.request("GET", `/repos/${repo}/actions/artifacts/${artifactId}/zip`, "Actions");
    return new Uint8Array(await response.arrayBuffer());
  }
}

/** Keeps secrets and fake runs in memory so the UI can be tried without a token. */
class DemoSecretStore implements SecretStore {
  private static secrets = new Map<string, Map<string, string>>();
  private static variables = new Map<string, Map<string, VariableInfo>>();
  private static runs = new Map<string, { id: number; createdAt: number; upload: boolean; branch: string }[]>();

  async listSecrets(repo: string): Promise<SecretInfo[]> {
    const repoSecrets = DemoSecretStore.secrets.get(repo) ?? new Map<string, string>();
    return [...repoSecrets.entries()].map(([name, updatedAt]) => ({ name, updatedAt }));
  }

  async setSecret(repo: string, name: string): Promise<void> {
    const repoSecrets = DemoSecretStore.secrets.get(repo) ?? new Map<string, string>();
    repoSecrets.set(name, new Date().toISOString());
    DemoSecretStore.secrets.set(repo, repoSecrets);
  }

  async deleteSecret(repo: string, name: string): Promise<void> {
    DemoSecretStore.secrets.get(repo)?.delete(name);
  }

  async listVariables(repo: string): Promise<VariableInfo[]> {
    return [...(DemoSecretStore.variables.get(repo)?.values() ?? [])];
  }

  async setVariable(repo: string, name: string, value: string): Promise<void> {
    const repoVariables = DemoSecretStore.variables.get(repo) ?? new Map<string, VariableInfo>();
    repoVariables.set(name, { name, value, updatedAt: new Date().toISOString() });
    DemoSecretStore.variables.set(repo, repoVariables);
  }

  async deleteVariable(repo: string, name: string): Promise<void> {
    DemoSecretStore.variables.get(repo)?.delete(name);
  }

  async listRepos(): Promise<RepoInfo[]> {
    return [
      { repo: "hkn-mobile/ac_remote_control", private: true },
      { repo: "hkn-mobile/demo-shop", private: true },
      { repo: "hkn-mobile/ci-templates", private: true },
      { repo: "hkn-mobile/public-notes", private: false },
    ];
  }

  async canManageSecrets(repo: string): Promise<boolean> {
    return repo !== "hkn-mobile/public-notes";
  }

  async defaultBranch(): Promise<string> {
    return "main";
  }

  async hasWorkflow(repo: string): Promise<boolean> {
    return repo.endsWith("ac_remote_control");
  }

  /** A demo run queues for 5 s, runs for 25 s, then succeeds. */
  async listRuns(repo: string, workflow: string, limit: number): Promise<WorkflowRun[]> {
    // Demo dispatches only exist for the release workflow.
    if (workflow !== "android-release.yml") return [];
    const runs = DemoSecretStore.runs.get(repo) ?? [];
    const now = Date.now();
    return runs
      .slice(-limit)
      .reverse()
      .map((run, index) => {
        const age = now - run.createdAt;
        const status: RunStatus = age < 5_000 ? "queued" : age < 30_000 ? "in_progress" : "completed";
        return {
          id: run.id,
          number: runs.length - index,
          status,
          conclusion: status === "completed" ? "success" : null,
          branch: run.branch,
          commit: "0123456789abcdef0123456789abcdef01234567",
          prNumber: null,
          actor: "demo",
          createdAt: new Date(run.createdAt).toISOString(),
          updatedAt: new Date(now).toISOString(),
          url: `https://github.com/${repo}/actions`,
        };
      });
  }

  async dispatchRelease(repo: string, _workflow: string, ref: string, inputs: ReleaseInputs): Promise<void> {
    const runs = DemoSecretStore.runs.get(repo) ?? [];
    runs.push({ id: Date.now(), createdAt: Date.now(), upload: inputs.upload, branch: ref });
    DemoSecretStore.runs.set(repo, runs);
  }

  async runProgress(repo: string, runId: number): Promise<RunProgress> {
    const run = (DemoSecretStore.runs.get(repo) ?? []).find((r) => r.id === runId);
    const age = run ? Date.now() - run.createdAt : 0;
    return { runner: age < 5_000 ? null : "hkn-flutter", step: age < 5_000 ? null : age < 15_000 ? "Run flutter test" : "Build App Bundle" };
  }

  async listOrgRunners(): Promise<RunnerInfo[]> {
    const busy = [...DemoSecretStore.runs.values()].flat().some((r) => Date.now() - r.createdAt < 30_000);
    return [{ name: "hkn-flutter", status: "online", busy, labels: ["self-hosted", "Linux", "X64", "flutter-android"] }];
  }

  async listArtifacts(repo: string, runId: number): Promise<ArtifactInfo[]> {
    return [{ id: runId, name: `${repo.split("/")[1]}-prod-${runId % 1000}`, size: 2048, expired: false }];
  }

  /** A tiny zip shaped like a real release artifact. */
  async downloadArtifact(repo: string, artifactId: number): Promise<Uint8Array> {
    const { zipSync, strToU8 } = await import("fflate");
    const info = {
      workflow: "release",
      flavor: "prod",
      versionName: "1.0.0",
      versionCode: 100 + (artifactId % 1000),
      upload: false,
      commit: "0123456789abcdef0123456789abcdef01234567",
      ref: "main",
    };
    return zipSync({
      "app/outputs/bundle/prodRelease/app-prod-release.aab": strToU8(`demo bundle for ${repo}`),
      "build-info.json": strToU8(JSON.stringify(info)),
    });
  }
}

function describe(status: number, scope: Scope): string {
  switch (status) {
    case 401:
      return "Token không hợp lệ hoặc đã hết hạn";
    case 403:
      return scope === "Metadata"
        ? "Token không có quyền đọc repo này"
        : `Token chưa có quyền ${scope} (Read and write) cho repo này`;
    case 404:
      return "Không thấy repo, hoặc token không được cấp quyền cho repo này";
    case 422:
      return "GitHub từ chối yêu cầu: nhánh không tồn tại hoặc workflow không nhận tham số này";
    default:
      return `GitHub trả về lỗi ${status}`;
  }
}

export function isDemoMode(): boolean {
  return process.env.CONSOLE_DEMO === "1";
}

/** The real GitHub store, or the in-memory one when CONSOLE_DEMO=1. */
export function getStore(): SecretStore {
  if (isDemoMode()) return new DemoSecretStore();
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new GitHubError("Chưa đặt GITHUB_TOKEN trong .env.local", 0);
  return new GitHubSecretStore(token);
}
