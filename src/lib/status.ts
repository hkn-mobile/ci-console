import { loadApps, type AppEntry } from "./config";
import { getStore, GitHubError, type SecretInfo } from "./github";

export type AppStatus = AppEntry & {
  secrets: Map<string, SecretInfo>;
  error?: string;
};

/** Every configured app with the secrets GitHub reports for it; one failing repo does not hide the rest. */
export async function loadStatus(): Promise<{ apps: AppStatus[]; error?: string }> {
  const apps = await loadApps();
  let store;
  try {
    store = getStore();
  } catch (error) {
    const message = error instanceof GitHubError ? error.message : "Không tạo được kết nối GitHub";
    return { apps: apps.map((a) => ({ ...a, secrets: new Map() })), error: message };
  }

  const statuses = await Promise.all(
    apps.map(async (app): Promise<AppStatus> => {
      try {
        const secrets = await store.listSecrets(app.repo);
        return { ...app, secrets: new Map(secrets.map((s) => [s.name, s])) };
      } catch (error) {
        const message = error instanceof GitHubError ? error.message : "Không đọc được secret";
        return { ...app, secrets: new Map(), error: message };
      }
    }),
  );
  return { apps: statuses };
}

export function formatDate(iso: string): string {
  // The server runs in UTC; people reading the console are in Vietnam.
  return new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
}
