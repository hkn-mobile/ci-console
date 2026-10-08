"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { isAuthorized } from "@/lib/auth";
import { CONFIG_KEY_PATTERN, CONFIG_PREFIX, looksSecret, MAX_VARIABLE_BYTES } from "@/lib/app-config";
import { loadApps } from "@/lib/config";
import { getStore, GitHubError, type SecretStore } from "@/lib/github";
import type { ActionState, RepoResult } from "./actions";

const MAX_IMPORT_BYTES = 256 * 1024;

class InputError extends Error {}

/** Re-checks auth inside the action: an action is a public POST endpoint, not just a button. */
async function requireAuth() {
  if (!isAuthorized((await headers()).get("authorization"))) throw new Error("Unauthorized");
}

/** The repo posted by the form, only if it is one of the console's apps. */
async function appRepo(formData: FormData): Promise<string> {
  const repo = String(formData.get("repo") ?? "");
  if (!(await loadApps()).some((a) => a.repo === repo)) throw new InputError("App không có trong danh sách");
  return repo;
}

function checkKey(key: string): string {
  if (!CONFIG_KEY_PATTERN.test(key)) {
    throw new InputError(`Tên "${key}" không hợp lệ: chỉ chữ IN HOA, số và _, bắt đầu bằng chữ (ví dụ PROD_BASE_URL)`);
  }
  return key;
}

function messageOf(error: unknown): string {
  if (error instanceof GitHubError || error instanceof InputError) return error.message;
  return "Lỗi không xác định";
}

/** Ignores "not found" so removing the other kind of a key is safe when it never existed. */
async function removeIfPresent(remove: () => Promise<void>) {
  try {
    await remove();
  } catch (error) {
    if (!(error instanceof GitHubError && error.status === 404)) throw error;
  }
}

/** Stores one key as a secret or a variable and drops it from the other kind, so a key never lives in both. */
async function writeEntry(store: SecretStore, repo: string, key: string, value: string, secret: boolean): Promise<void> {
  const name = `${CONFIG_PREFIX}${key}`;
  if (!value) throw new InputError("Giá trị không được để trống");
  if (secret) {
    await store.setSecret(repo, name, value);
    await removeIfPresent(() => store.deleteVariable(repo, name));
  } else {
    if (Buffer.byteLength(value) > MAX_VARIABLE_BYTES) throw new InputError("Giá trị quá dài (tối đa 48 KB)");
    await store.setVariable(repo, name, value);
    await removeIfPresent(() => store.deleteSecret(repo, name));
  }
}

export async function saveConfigEntryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuth();
  try {
    const repo = await appRepo(formData);
    const key = checkKey(String(formData.get("key") ?? "").trim());
    // Values are taken as typed; only a trailing newline from a paste is dropped.
    const value = String(formData.get("value") ?? "").replace(/\r\n/g, "\n").replace(/\n$/, "");
    const secret = formData.get("secret") === "on";
    await writeEntry(getStore(), repo, key, value, secret);
    revalidatePath("/config");
    return { results: [{ repo, name: key, ok: true, message: secret ? "Đã lưu (bí mật)" : "Đã lưu" }] };
  } catch (error) {
    return { error: messageOf(error) };
  }
}

export async function deleteConfigEntryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuth();
  try {
    const repo = await appRepo(formData);
    const key = checkKey(String(formData.get("key") ?? ""));
    const name = `${CONFIG_PREFIX}${key}`;
    const store = getStore();
    if (formData.get("secret") === "true") await store.deleteSecret(repo, name);
    else await store.deleteVariable(repo, name);
    revalidatePath("/config");
    return { results: [{ repo, name: key, ok: true, message: "Đã xoá" }] };
  } catch (error) {
    return { error: messageOf(error) };
  }
}

/** Reads a {"KEY": "value"} object, as written by ci-templates or kept by developers. */
function parseConfigJson(raw: string): [string, string][] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new InputError("Nội dung không phải JSON hợp lệ");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new InputError('JSON phải là một object dạng { "KEY": "giá trị" }');
  }
  return Object.entries(parsed).map(([key, value]) => {
    if (value === null || typeof value === "object") throw new InputError(`"${key}" phải là chuỗi, số hoặc true/false`);
    return [key, String(value)];
  });
}

export async function importConfigAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuth();
  try {
    const repo = await appRepo(formData);
    const file = formData.get("file");
    const hasFile = file instanceof File && file.size > 0;
    if (hasFile && file.size > MAX_IMPORT_BYTES) return { error: "File quá lớn (tối đa 256 KB)" };
    const raw = hasFile ? await file.text() : String(formData.get("json") ?? "");
    if (!raw.trim()) return { error: "Dán nội dung app.json hoặc chọn file" };

    const entries = parseConfigJson(raw);
    if (entries.length === 0) return { error: "File không có dòng nào" };
    // Validate every key first so a typo does not leave half a file uploaded.
    entries.forEach(([key]) => checkKey(key));

    const store = getStore();
    const results: RepoResult[] = [];
    for (const [key, value] of entries) {
      const secret = looksSecret(key);
      try {
        await writeEntry(store, repo, key, value, secret);
        results.push({ repo, name: key, ok: true, message: secret ? "Bí mật" : "Thường" });
      } catch (error) {
        results.push({ repo, name: key, ok: false, message: messageOf(error) });
      }
    }
    revalidatePath("/config");
    return { results };
  } catch (error) {
    return { error: messageOf(error) };
  }
}
