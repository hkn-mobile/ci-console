import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { readBuild, resolveBuildFile } from "@/lib/archive";

/** Streams an archived APK or AAB under a readable file name. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ key: string; run: string; name: string }> }) {
  if (!isAuthorized(request.headers.get("authorization"))) return new Response("Unauthorized", { status: 401 });

  const { key, run, name } = await params;
  const file = await resolveBuildFile(key, run, name);
  const build = await readBuild(key, run);
  // Only the APK/AAB the archive recorded; never build.json or anything else in the folder.
  if (!file || !build || !build.files.some((f) => f.name === name)) return new Response("Not found", { status: 404 });

  const extension = name.toLowerCase().endsWith(".apk") ? "apk" : "aab";
  const label = [build.repo.split("/")[1], build.flavor, build.versionName, build.versionCode ?? `run${build.runNumber}`]
    .filter(Boolean)
    .join("-")
    .replace(/[^A-Za-z0-9._-]/g, "_");

  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
    headers: {
      "Content-Type": extension === "apk" ? "application/vnd.android.package-archive" : "application/octet-stream",
      "Content-Length": String((await stat(file)).size),
      "Content-Disposition": `attachment; filename="${label}.${extension}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
