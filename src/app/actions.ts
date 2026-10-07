"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { findSecret, KEYSTORE_SECRETS, type SecretSpec } from "@/lib/catalog";
import { loadApps } from "@/lib/config";
import { getStore, GitHubError } from "@/lib/github";
import { isAuthorized } from "@/lib/auth";

export type RepoResult = { repo: string; name: string; ok: boolean; message: string };
export type ActionState = { error?: string; results?: RepoResult[] };

const MAX_FILE_BYTES = 512 * 1024;

/** Re-checks auth inside the action: an action is a public POST endpoint, not just a button. */
async function requireAuth() {
  if (!isAuthorized((await headers()).get("authorization"))) throw new Error("Unauthorized");
}

/** Keeps only repos listed in console.config.json; the form's list is never trusted. */
async function selectedRepos(formData: FormData): Promise<string[]> {
  const allowed = new Set((await loadApps()).map((a) => a.repo));
  const picked = formData.getAll("repos").map(String);
  return [...new Set(picked)].filter((repo) => allowed.has(repo));
}

async function readFile(formData: FormData, field: string): Promise<Buffer | null> {
  const file = formData.get(field);
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > MAX_FILE_BYTES) throw new InputError("File quá lớn (tối đa 512 KB)");
  return Buffer.from(await file.arrayBuffer());
}

class InputError extends Error {}

/** Builds the value to store from whichever input the secret's kind uses. */
async function valueFor(spec: SecretSpec, formData: FormData): Promise<string> {
  const text = String(formData.get("value") ?? "");

  switch (spec.kind) {
    case "file-base64": {
      const file = await readFile(formData, "file");
      if (!file) throw new InputError("Chọn file keystore");
      return file.toString("base64");
    }
    case "json": {
      const file = await readFile(formData, "file");
      const raw = file ? file.toString("utf8") : text;
      try {
        const parsed = JSON.parse(raw) as { type?: string };
        if (parsed.type !== "service_account") throw new InputError("JSON không phải service account (thiếu \"type\": \"service_account\")");
      } catch (error) {
        if (error instanceof InputError) throw error;
        throw new InputError("Nội dung không phải JSON hợp lệ");
      }
      return raw.trim();
    }
    case "multiline": {
      const file = await readFile(formData, "file");
      const raw = (file ? file.toString("utf8") : text).replace(/\r\n/g, "\n").trim();
      if (!raw) throw new InputError("Chưa nhập giá trị");
      return `${raw}\n`;
    }
    default:
      if (!text) throw new InputError("Chưa nhập giá trị");
      return text;
  }
}

async function writeAll(repos: string[], entries: [string, string][]): Promise<RepoResult[]> {
  const store = getStore();
  const results: RepoResult[] = [];
  for (const repo of repos) {
    for (const [name, value] of entries) {
      try {
        await store.setSecret(repo, name, value);
        results.push({ repo, name, ok: true, message: "Đã lưu" });
      } catch (error) {
        results.push({ repo, name, ok: false, message: messageOf(error) });
      }
    }
  }
  return results;
}

function messageOf(error: unknown): string {
  if (error instanceof GitHubError || error instanceof InputError) return error.message;
  return "Lỗi không xác định";
}

export async function setSecretAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuth();
  const spec = findSecret(String(formData.get("name")));
  if (!spec) return { error: "Secret không có trong danh mục" };

  const repos = await selectedRepos(formData);
  if (repos.length === 0) return { error: "Chọn ít nhất một app" };

  try {
    const value = await valueFor(spec, formData);
    const results = await writeAll(repos, [[spec.name, value]]);
    revalidatePath("/");
    return { results };
  } catch (error) {
    return { error: messageOf(error) };
  }
}

export async function deleteSecretAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuth();
  const spec = findSecret(String(formData.get("name")));
  if (!spec) return { error: "Secret không có trong danh mục" };
  if (formData.get("confirm") !== spec.name) return { error: `Gõ đúng ${spec.name} để xác nhận xoá` };

  const repos = await selectedRepos(formData);
  if (repos.length === 0) return { error: "Chọn ít nhất một app" };

  const store = getStore();
  const results: RepoResult[] = [];
  for (const repo of repos) {
    try {
      await store.deleteSecret(repo, spec.name);
      results.push({ repo, name: spec.name, ok: true, message: "Đã xoá" });
    } catch (error) {
      results.push({ repo, name: spec.name, ok: false, message: messageOf(error) });
    }
  }
  revalidatePath("/");
  return { results };
}

/** Reads storePassword, keyPassword and keyAlias from a key.properties file. */
function parseKeyProperties(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z]+)\s*=\s*(.*?)\s*$/);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

export async function setKeystoreAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuth();
  const repos = await selectedRepos(formData);
  if (repos.length === 0) return { error: "Chọn ít nhất một app" };

  try {
    const keystore = await readFile(formData, "keystore");
    if (!keystore) return { error: "Chọn file keystore (.jks)" };

    const propertiesFile = await readFile(formData, "properties");
    const fromFile = propertiesFile ? parseKeyProperties(propertiesFile.toString("utf8")) : {};
    const field = (name: string) => String(formData.get(name) ?? "") || fromFile[name] || "";

    const storePassword = field("storePassword");
    const keyAlias = field("keyAlias");
    const keyPassword = field("keyPassword");
    if (!storePassword || !keyAlias || !keyPassword) {
      return { error: "Thiếu storePassword, keyAlias hoặc keyPassword (nhập tay hoặc chọn key.properties)" };
    }

    const values: Record<(typeof KEYSTORE_SECRETS)[number], string> = {
      ANDROID_KEYSTORE_BASE64: keystore.toString("base64"),
      ANDROID_KEYSTORE_PASSWORD: storePassword,
      ANDROID_KEY_ALIAS: keyAlias,
      ANDROID_KEY_PASSWORD: keyPassword,
    };
    const results = await writeAll(repos, Object.entries(values));
    revalidatePath("/");
    return { results };
  } catch (error) {
    return { error: messageOf(error) };
  }
}
