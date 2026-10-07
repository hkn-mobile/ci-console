"use client";

import { useActionState, useState } from "react";
import { runReleaseAction, type ReleaseState } from "@/app/release-actions";
import { hintClass, inputClass, labelClass, primaryButton } from "@/components/ui";

const initial: ReleaseState = {};

export function ReleaseForm({ repo, defaultBranch }: { repo: string; defaultBranch: string }) {
  const [state, run, pending] = useActionState(runReleaseAction, initial);
  const [upload, setUpload] = useState(false);

  return (
    <form action={run} className="space-y-4">
      <input type="hidden" name="repo" value={repo} />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block space-y-1.5">
          <span className={labelClass}>Nhánh</span>
          <input name="ref" defaultValue={defaultBranch} required autoComplete="off" className={`${inputClass} font-mono`} />
        </label>
        <label className="block space-y-1.5">
          <span className={labelClass}>versionCode</span>
          <input name="versionCode" inputMode="numeric" placeholder="Tự động" autoComplete="off" className={inputClass} />
        </label>
        <label className="block space-y-1.5">
          <span className={labelClass}>versionName</span>
          <input name="versionName" placeholder="Theo pubspec.yaml" autoComplete="off" className={inputClass} />
        </label>
      </div>
      <p className={hintClass}>Để trống versionCode thì lấy số lần chạy + 100. Số mới phải lớn hơn mọi bản đã tải lên Play.</p>

      <div className={`space-y-2 rounded-lg border p-3 ${upload ? "border-warn/40 bg-warn-soft" : "border-line"}`}>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="upload"
            checked={upload}
            onChange={(event) => setUpload(event.target.checked)}
            className="mt-0.5 size-4 accent-[var(--accent)]"
          />
          <span>
            <span className="text-sm font-medium text-fg">Đẩy lên Google Play</span>
            <span className={`block ${hintClass}`}>
              Không tick là chạy thử: ký và build AAB, lưu trong Artifacts, không tốn versionCode.
            </span>
          </span>
        </label>
        {upload && (
          <label className="flex cursor-pointer items-start gap-3 pl-7">
            <input type="checkbox" name="confirmUpload" required className="mt-0.5 size-4 accent-[var(--accent)]" />
            <span className="text-sm text-warn">Tôi hiểu lần này sẽ dùng hết một versionCode trên Google Play.</span>
          </label>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Đang gửi lệnh…" : upload ? "Chạy và đẩy lên Play" : "Chạy thử"}
        </button>
        {state.done && <span className="text-sm text-ok">{state.done}</span>}
        {state.error && (
          <span role="alert" className="text-sm text-bad">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
