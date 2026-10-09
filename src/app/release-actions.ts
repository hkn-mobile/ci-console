"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { isAuthorized } from "@/lib/auth";
import { appId, loadApps } from "@/lib/config";
import { getStore, GitHubError } from "@/lib/github";
import { RELEASE_WORKFLOW } from "@/lib/releases";

export type ReleaseState = { error?: string; done?: string };

const BRANCH_PATTERN = /^[A-Za-z0-9._/-]{1,100}$/;
const VERSION_CODE_PATTERN = /^[1-9][0-9]*$/;
const VERSION_NAME_PATTERN = /^[0-9A-Za-z.+-]{1,40}$/;
const MAX_VERSION_CODE = 2_100_000_000;

async function requireAuth() {
  if (!isAuthorized((await headers()).get("authorization"))) throw new Error("Unauthorized");
}

/** Starts android-release.yml with the same inputs as the Run workflow form on GitHub. */
export async function runReleaseAction(_prev: ReleaseState, formData: FormData): Promise<ReleaseState> {
  await requireAuth();

  const repo = String(formData.get("repo") ?? "");
  const app = (await loadApps()).find((a) => appId(a) === repo);
  if (!app) return { error: "App không có trong danh sách" };

  const ref = String(formData.get("ref") ?? "").trim();
  if (!BRANCH_PATTERN.test(ref) || ref.includes("..")) return { error: "Tên nhánh không hợp lệ" };

  const versionCode = String(formData.get("versionCode") ?? "").trim();
  if (versionCode && (!VERSION_CODE_PATTERN.test(versionCode) || Number(versionCode) > MAX_VERSION_CODE)) {
    return { error: "versionCode phải là số nguyên từ 1 đến 2100000000" };
  }

  const versionName = String(formData.get("versionName") ?? "").trim();
  if (versionName && !VERSION_NAME_PATTERN.test(versionName)) {
    return { error: "versionName chỉ gồm chữ, số và . + - (ví dụ 1.0.1)" };
  }

  const upload = formData.get("upload") === "on";
  if (upload && formData.get("confirmUpload") !== "on") {
    return { error: "Tick xác nhận trước khi đẩy lên Google Play" };
  }

  try {
    await getStore().dispatchRelease(app.repo, RELEASE_WORKFLOW, ref, { upload, versionCode, versionName });
  } catch (error) {
    return { error: error instanceof GitHubError ? error.message : "Không chạy được workflow" };
  }

  // GitHub lists a dispatched run a moment after accepting it.
  await new Promise((resolve) => setTimeout(resolve, 2500));
  revalidatePath("/releases");
  return {
    done: upload
      ? `Đã chạy Android Release cho ${app.name}, có đẩy lên Google Play`
      : `Đã chạy thử Android Release cho ${app.name} (không gửi lên Play)`,
  };
}
