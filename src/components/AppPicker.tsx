"use client";

import { useState } from "react";
import { ghostButton } from "./ui";

export type PickableApp = { name: string; repo: string; has: boolean; updatedAt?: string; error?: string };

/** Checkbox list posted as `repos`; by default starts on the apps that still miss the secret. */
export function AppPicker({ apps, initial = "missing" }: { apps: PickableApp[]; initial?: "missing" | "none" }) {
  const usable = apps.filter((a) => !a.error);
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(initial === "none" ? [] : usable.filter((a) => !a.has).map((a) => a.repo)),
  );

  const toggle = (repo: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(repo)) next.delete(repo);
      else next.add(repo);
      return next;
    });

  return (
    <fieldset className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <legend className="text-sm font-medium text-fg">
          Áp dụng cho app <span className="font-normal text-fg-muted">· đã chọn {picked.size}/{usable.length}</span>
        </legend>
        <div className="flex gap-1.5">
          <button type="button" className={ghostButton} onClick={() => setPicked(new Set(usable.map((a) => a.repo)))}>
            Tất cả
          </button>
          <button type="button" className={ghostButton} onClick={() => setPicked(new Set(usable.filter((a) => !a.has).map((a) => a.repo)))}>
            Đang thiếu
          </button>
          <button type="button" className={ghostButton} onClick={() => setPicked(new Set())}>
            Bỏ chọn
          </button>
        </div>
      </div>
      <ul className="overflow-hidden rounded-lg border border-line">
        {apps.map((app) => {
          const checked = picked.has(app.repo);
          return (
            <li key={app.repo} className="border-b border-line last:border-0">
              <label
                className={`flex items-center gap-3 px-3 py-2.5 transition ${
                  app.error ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-surface-2"
                } ${checked ? "bg-accent-soft" : ""}`}
              >
                <input
                  type="checkbox"
                  name="repos"
                  value={app.repo}
                  disabled={Boolean(app.error)}
                  checked={checked}
                  onChange={() => toggle(app.repo)}
                  className="size-4 accent-[var(--accent)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-fg">{app.name}</span>
                  <span className="ml-2 font-mono text-[11px] text-fg-faint">{app.repo}</span>
                </span>
                <span className={`shrink-0 text-xs ${app.error ? "text-bad" : app.has ? "text-ok" : "text-warn"}`}>
                  {app.error ?? (app.has ? `Đã có${app.updatedAt ? ` · ${app.updatedAt}` : ""}` : "Thiếu")}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
