"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { isAuthorized } from "@/lib/auth";
import { APP_ID_PATTERN, appId, defaultAppName, loadConfig, REPO_PATTERN, saveConfig } from "@/lib/config";
import { getStore, GitHubError } from "@/lib/github";

export type ListState = { error?: string; done?: string };

async function requireAuth() {
  if (!isAuthorized((await headers()).get("authorization"))) throw new Error("Unauthorized");
}

function repoFrom(formData: FormData): string | null {
  const repo = String(formData.get("repo") ?? "").trim();
  return REPO_PATTERN.test(repo) ? repo : null;
}

/** An app's id (repo, or repo#environment) posted by the remove and rename forms. */
function idFrom(formData: FormData): string | null {
  const id = String(formData.get("repo") ?? "").trim();
  return APP_ID_PATTERN.test(id) ? id : null;
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Adds a repo as an app, but only after GitHub confirms the token may manage its secrets. */
export async function addAppAction(_prev: ListState, formData: FormData): Promise<ListState> {
  await requireAuth();
  const repo = repoFrom(formData);
  if (!repo) return { error: "Repo không hợp lệ" };

  const name = String(formData.get("name") ?? "").trim().slice(0, 60) || defaultAppName(repo);
  const config = await loadConfig();
  if (config.apps.some((a) => same(a.repo, repo))) return { error: "Repo đã có trong danh sách" };

  try {
    const store = getStore();
    const reachable = (await store.listRepos()).find((r) => same(r.repo, repo));
    if (!reachable || !(await store.canManageSecrets(reachable.repo))) {
      return { error: "Token không có quyền Secrets cho repo này" };
    }
    config.apps.push({ name, repo: reachable.repo });
    config.ignored = config.ignored.filter((r) => !same(r, repo));
    await saveConfig(config);
  } catch (error) {
    return { error: error instanceof GitHubError ? error.message : "Không thêm được app" };
  }
  revalidatePath("/");
  return { done: `Đã thêm ${name}` };
}

/** Drops an app from the console only; nothing changes on GitHub. */
export async function removeAppAction(_prev: ListState, formData: FormData): Promise<ListState> {
  await requireAuth();
  const id = idFrom(formData);
  if (!id) return { error: "Repo không hợp lệ" };

  const config = await loadConfig();
  const before = config.apps.length;
  config.apps = config.apps.filter((a) => !same(appId(a), id));
  if (config.apps.length === before) return { error: "Repo không có trong danh sách" };
  await saveConfig(config);
  revalidatePath("/");
  return { done: "Đã bỏ khỏi danh sách" };
}

export async function ignoreRepoAction(_prev: ListState, formData: FormData): Promise<ListState> {
  await requireAuth();
  const repo = repoFrom(formData);
  if (!repo) return { error: "Repo không hợp lệ" };

  const config = await loadConfig();
  if (!config.ignored.some((r) => same(r, repo))) config.ignored.push(repo);
  await saveConfig(config);
  revalidatePath("/");
  return { done: "Đã ẩn" };
}

export async function unignoreRepoAction(_prev: ListState, formData: FormData): Promise<ListState> {
  await requireAuth();
  const repo = repoFrom(formData);
  if (!repo) return { error: "Repo không hợp lệ" };

  const config = await loadConfig();
  config.ignored = config.ignored.filter((r) => !same(r, repo));
  await saveConfig(config);
  revalidatePath("/");
  return { done: "Đã bỏ ẩn" };
}

/** Changes an app's display name; the repo and its secrets stay as they are. */
export async function renameAppAction(_prev: ListState, formData: FormData): Promise<ListState> {
  await requireAuth();
  const id = idFrom(formData);
  if (!id) return { error: "Repo không hợp lệ" };

  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  if (!name) return { error: "Tên không được để trống" };

  const config = await loadConfig();
  const app = config.apps.find((a) => same(appId(a), id));
  if (!app) return { error: "Repo không có trong danh sách" };

  app.name = name;
  await saveConfig(config);
  revalidatePath("/");
  return { done: "Đã đổi tên" };
}
