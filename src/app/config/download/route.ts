import type { NextRequest } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { loadAppConfig } from "@/lib/app-config-store";
import { loadApps } from "@/lib/config";
import { GitHubError } from "@/lib/github";

/**
 * config/app.json for a developer machine. Secrets cannot be read back from
 * GitHub, so their keys are listed with empty values to be filled in by hand.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request.headers.get("authorization"))) return new Response("Unauthorized", { status: 401 });

  const repo = request.nextUrl.searchParams.get("app") ?? "";
  if (!(await loadApps()).some((a) => a.repo === repo)) return new Response("Not found", { status: 404 });

  try {
    const entries = await loadAppConfig(repo);
    const json = Object.fromEntries(entries.map((e) => [e.key, e.value ?? ""]));
    return new Response(`${JSON.stringify(json, null, 2)}\n`, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="app.json"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return new Response(error instanceof GitHubError ? error.message : "Không đọc được config", { status: 502 });
  }
}
