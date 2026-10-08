"use client";

import { useActionState, useRef, useState } from "react";
import type { ActionState } from "@/app/actions";
import { deleteConfigEntryAction, importConfigAction, saveConfigEntryAction } from "@/app/config-actions";
import type { ConfigEntry } from "@/lib/app-config";
import { ActionResult } from "@/components/ActionResult";
import { Badge } from "@/components/Badge";
import { FormSection } from "@/components/FormSection";
import { cardClass, ghostButton, hintClass, inputClass, labelClass, primaryButton } from "@/components/ui";

const initialState: ActionState = {};

/** Typed keys become upper case with underscores, the form the app reads them in. */
function normalizeKey(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
}

function SecretToggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-fg">
      <input type="checkbox" name="secret" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--accent)]" />
      Bí mật
      <span className={hintClass}>(lưu vào Secrets, không xem lại được)</span>
    </label>
  );
}

export function EntryRow({ repo, entry, updatedAt }: { repo: string; entry: ConfigEntry; updatedAt: string }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [secret, setSecret] = useState(entry.secret);
  const [saveState, saveAction, saving] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await saveConfigEntryAction(prev, formData);
    if (!result.error) setEditing(false);
    return result;
  }, initialState);
  const [deleteState, deleteAction, deleting] = useActionState(deleteConfigEntryAction, initialState);

  return (
    <li className="border-b border-line px-5 py-3 last:border-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <code className="min-w-0 font-mono text-sm font-medium text-fg [overflow-wrap:anywhere]">{entry.key}</code>
        {entry.secret ? <Badge tone="warn">Bí mật</Badge> : <Badge tone="neutral">Thường</Badge>}
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-fg-muted" title={entry.value}>
          {entry.secret ? "••••••••" : entry.value}
        </span>
        <span className="text-[11px] text-fg-faint">{updatedAt}</span>
        <div className="flex gap-1.5">
          <button type="button" className={ghostButton} onClick={() => setEditing((v) => !v)}>
            {editing ? "Đóng" : "Sửa"}
          </button>
          {confirming ? (
            <form action={deleteAction} className="flex gap-1.5">
              <input type="hidden" name="repo" value={repo} />
              <input type="hidden" name="key" value={entry.key} />
              <input type="hidden" name="secret" value={String(entry.secret)} />
              <button type="submit" disabled={deleting} className="rounded-md bg-bad px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60">
                {deleting ? "Đang xoá…" : "Xoá thật"}
              </button>
              <button type="button" className={ghostButton} onClick={() => setConfirming(false)}>
                Huỷ
              </button>
            </form>
          ) : (
            <button type="button" className={`${ghostButton} hover:border-bad hover:text-bad`} onClick={() => setConfirming(true)}>
              Xoá
            </button>
          )}
        </div>
      </div>

      {editing && (
        <form action={saveAction} className="mt-3 space-y-3 rounded-lg border border-line bg-surface-2/50 p-4">
          <input type="hidden" name="repo" value={repo} />
          <input type="hidden" name="key" value={entry.key} />
          <label className="block space-y-1.5">
            <span className={labelClass}>Giá trị mới</span>
            <textarea
              name="value"
              rows={2}
              required
              spellCheck={false}
              autoComplete="off"
              defaultValue={entry.value ?? ""}
              placeholder={entry.secret ? "Giá trị bí mật không xem lại được, nhập giá trị mới để ghi đè" : ""}
              className={`${inputClass} font-mono text-xs`}
            />
          </label>
          <SecretToggle checked={secret} onChange={setSecret} />
          <div>
            <button type="submit" disabled={saving} className={primaryButton}>
              {saving ? "Đang lưu…" : "Lưu"}
            </button>
          </div>
          <ActionResult state={saveState} />
        </form>
      )}
      {deleteState.error && (
        <div className="mt-2">
          <ActionResult state={deleteState} />
        </div>
      )}
    </li>
  );
}

export function AddEntryForm({ repo }: { repo: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [key, setKey] = useState("");
  const [secret, setSecret] = useState(false);
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await saveConfigEntryAction(prev, formData);
    if (!result.error) {
      formRef.current?.reset();
      setKey("");
      setSecret(false);
    }
    return result;
  }, initialState);

  return (
    <form ref={formRef} action={formAction} className={cardClass}>
      <input type="hidden" name="repo" value={repo} />
      <FormSection step={1} title="Thêm dòng" hint="Trùng tên với dòng đã có thì ghi đè. Trong code đọc bằng String.fromEnvironment('TÊN').">
        <div className="grid gap-3 md:grid-cols-[minmax(0,240px)_1fr]">
          <label className="block space-y-1.5">
            <span className={labelClass}>Tên</span>
            <input
              name="key"
              required
              autoComplete="off"
              spellCheck={false}
              placeholder="PROD_BASE_URL"
              value={key}
              onChange={(e) => setKey(normalizeKey(e.target.value))}
              className={`${inputClass} font-mono`}
            />
          </label>
          <label className="block space-y-1.5">
            <span className={labelClass}>Giá trị</span>
            <textarea name="value" rows={1} required spellCheck={false} autoComplete="off" className={`${inputClass} font-mono text-xs`} />
          </label>
        </div>
        <SecretToggle checked={secret} onChange={setSecret} />
      </FormSection>
      <div className="flex flex-col gap-3 p-5">
        <div>
          <button type="submit" disabled={pending} className={primaryButton}>
            {pending ? "Đang lưu…" : "Thêm vào app"}
          </button>
        </div>
        <ActionResult state={state} />
      </div>
    </form>
  );
}

export function ImportForm({ repo }: { repo: string }) {
  const [state, formAction, pending] = useActionState(importConfigAction, initialState);

  return (
    <details className={`${cardClass} group`}>
      <summary className="flex cursor-pointer list-none items-center justify-between p-5 text-sm font-medium">
        Dán nội dung app.json
        <span className="text-fg-faint transition group-open:rotate-180" aria-hidden="true">
          ⌄
        </span>
      </summary>
      <form action={formAction} className="space-y-4 border-t border-line p-5">
        <input type="hidden" name="repo" value={repo} />
        <p className={hintClass}>
          Mỗi key thành một dòng Thường, trùng tên thì ghi đè; dòng nào không có trong nội dung thì giữ nguyên.
        </p>
        <label className="block space-y-1.5">
          <span className={labelClass}>Dán nội dung</span>
          <textarea
            name="json"
            rows={6}
            spellCheck={false}
            autoComplete="off"
            placeholder={'{\n  "PROD_BASE_URL": "https://…",\n  "PROD_API_KEY": "…"\n}'}
            className={`${inputClass} font-mono text-xs leading-relaxed`}
          />
        </label>
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Đang gửi lên GitHub…" : "Nhập vào app"}
        </button>
        <ActionResult state={state} />
      </form>
    </details>
  );
}

/** Header button: pick an app.json and it is imported straight away. */
export function QuickImportButton({ repo }: { repo: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await importConfigAction(prev, formData);
    formRef.current?.reset();
    return result;
  }, initialState);
  const failed = state.results?.filter((r) => !r.ok) ?? [];

  return (
    <form ref={formRef} action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="repo" value={repo} />
      <label className={`${ghostButton} cursor-pointer ${pending ? "pointer-events-none opacity-60" : ""}`}>
        {pending ? "Đang nhập…" : "Nhập app.json"}
        <input
          type="file"
          name="file"
          accept=".json,application/json"
          className="sr-only"
          onChange={(e) => e.currentTarget.files?.length && formRef.current?.requestSubmit()}
        />
      </label>
      {state.error && <span role="alert" className="text-xs text-bad">{state.error}</span>}
      {state.results && (
        <span role="status" className={`text-xs ${failed.length ? "text-bad" : "text-ok"}`}>
          {failed.length
            ? `Lỗi ${failed.length}/${state.results.length}: ${failed.map((r) => `${r.name} (${r.message})`).join(", ")}`
            : `Đã nhập ${state.results.length} dòng`}
        </span>
      )}
    </form>
  );
}
