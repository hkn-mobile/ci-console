"use client";

import { useActionState, useState } from "react";
import {
  addAppAction,
  ignoreRepoAction,
  removeAppAction,
  renameAppAction,
  unignoreRepoAction,
  type ListState,
} from "@/app/app-actions";
import { ghostButton, inputClass, primaryButton } from "./ui";

const initial: ListState = {};

/** One offered repo: a display name field with Add, and a Hide button. */
export function CandidateRow({ repo, isPrivate, suggestedName }: { repo: string; isPrivate: boolean; suggestedName: string }) {
  const [addState, add, adding] = useActionState(addAppAction, initial);
  const [hideState, hide, hiding] = useActionState(ignoreRepoAction, initial);
  const error = addState.error ?? hideState.error;

  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-0">
      <div className="min-w-48 flex-1">
        <div className="font-mono text-sm text-fg">{repo}</div>
        <div className="text-xs text-fg-faint">{isPrivate ? "Private" : "Public"}</div>
      </div>
      <form action={add} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="repo" value={repo} />
        <input
          name="name"
          defaultValue={suggestedName}
          aria-label={`Tên hiển thị cho ${repo}`}
          maxLength={60}
          className={`${inputClass} w-48 py-1.5`}
        />
        <button type="submit" disabled={adding} className={`${primaryButton} py-1.5`}>
          {adding ? "Đang thêm…" : "Thêm"}
        </button>
      </form>
      <form action={hide}>
        <input type="hidden" name="repo" value={repo} />
        <button type="submit" disabled={hiding} className={ghostButton} title="Không gợi ý repo này nữa">
          Ẩn
        </button>
      </form>
      {error && <p className="w-full text-xs text-bad">{error}</p>}
    </li>
  );
}

export function RemoveAppButton({ repo, name }: { repo: string; name: string }) {
  const [state, remove, pending] = useActionState(removeAppAction, initial);
  return (
    <form
      action={remove}
      onSubmit={(event) => {
        if (!confirm(`Bỏ ${name} khỏi danh sách? Secret trên GitHub vẫn giữ nguyên.`)) event.preventDefault();
      }}
    >
      <input type="hidden" name="repo" value={repo} />
      <button type="submit" disabled={pending} className="text-[11px] text-fg-faint underline-offset-2 hover:text-bad hover:underline">
        {pending ? "Đang bỏ…" : "Bỏ khỏi danh sách"}
      </button>
      {state.error && <span className="block text-[11px] text-bad">{state.error}</span>}
    </form>
  );
}

export function UnhideButton({ repo }: { repo: string }) {
  const [, unhide, pending] = useActionState(unignoreRepoAction, initial);
  return (
    <form action={unhide} className="inline">
      <input type="hidden" name="repo" value={repo} />
      <button type="submit" disabled={pending} className={ghostButton}>
        {pending ? "…" : "Bỏ ẩn"}
      </button>
    </form>
  );
}

/** App name in the table that turns into a field when "Đổi tên" is pressed. */
export function AppName({ repo, name }: { repo: string; name: string }) {
  const [editing, setEditing] = useState(false);
  const [state, rename, pending] = useActionState(async (prev: ListState, formData: FormData) => {
    const result = await renameAppAction(prev, formData);
    if (result.done) setEditing(false);
    return result;
  }, initial);

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-medium">{name}</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-[11px] text-fg-faint underline-offset-2 hover:text-accent hover:underline"
        >
          Đổi tên
        </button>
      </div>
    );
  }

  return (
    <form action={rename} className="space-y-1.5">
      <input type="hidden" name="repo" value={repo} />
      <input
        name="name"
        defaultValue={name}
        autoFocus
        maxLength={60}
        aria-label={`Tên mới cho ${repo}`}
        onKeyDown={(event) => event.key === "Escape" && setEditing(false)}
        className={`${inputClass} py-1`}
      />
      <div className="flex gap-1.5">
        <button type="submit" disabled={pending} className={`${primaryButton} px-2.5 py-1 text-xs`}>
          {pending ? "Đang lưu…" : "Lưu"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className={ghostButton}>
          Huỷ
        </button>
      </div>
      {state.error && <p className="text-[11px] text-bad">{state.error}</p>}
    </form>
  );
}
