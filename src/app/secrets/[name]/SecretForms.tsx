"use client";

import { useActionState } from "react";
import { deleteSecretAction, setSecretAction, type ActionState } from "@/app/actions";
import type { SecretSpec } from "@/lib/catalog";
import { AppPicker, type PickableApp } from "@/components/AppPicker";
import { ActionResult } from "@/components/ActionResult";
import { FormSection } from "@/components/FormSection";
import { cardClass, dangerButton, fileClass, hintClass, inputClass, labelClass, primaryButton } from "@/components/ui";

const initialState: ActionState = {};

export function SetSecretForm({ spec, apps }: { spec: SecretSpec; apps: PickableApp[] }) {
  const [state, formAction, pending] = useActionState(setSecretAction, initialState);

  return (
    <form action={formAction} className={cardClass}>
      <input type="hidden" name="name" value={spec.name} />
      <FormSection step={1} title="Giá trị" hint="Được mã hoá và gửi thẳng lên GitHub; web không lưu lại.">
        <ValueInput spec={spec} />
      </FormSection>
      <FormSection step={2} title="Chọn app" hint="Mặc định chọn các app đang thiếu secret này.">
        <AppPicker apps={apps} />
      </FormSection>
      <div className="flex flex-col gap-3 p-5">
        <div>
          <button type="submit" disabled={pending} className={primaryButton}>
            {pending ? "Đang gửi lên GitHub…" : "Lưu vào các app đã chọn"}
          </button>
        </div>
        <ActionResult state={state} />
      </div>
    </form>
  );
}

function ValueInput({ spec }: { spec: SecretSpec }) {
  switch (spec.kind) {
    case "file-base64":
      return (
        <label className="block space-y-1.5">
          <span className={labelClass}>File</span>
          <input type="file" name="file" required className={fileClass} />
          <span className={hintClass}>Web tự chuyển sang base64 trước khi gửi.</span>
        </label>
      );
    case "json":
    case "multiline":
      return (
        <>
          <label className="block space-y-1.5">
            <span className={labelClass}>Dán nội dung</span>
            <textarea
              name="value"
              rows={7}
              spellCheck={false}
              autoComplete="off"
              placeholder={spec.kind === "json" ? '{ "type": "service_account", … }' : "-----BEGIN OPENSSH PRIVATE KEY-----"}
              className={`${inputClass} font-mono text-xs leading-relaxed`}
            />
          </label>
          <label className="block space-y-1.5">
            <span className={hintClass}>hoặc chọn file</span>
            <input type="file" name="file" className={fileClass} />
          </label>
        </>
      );
    default:
      return (
        <label className="block max-w-md space-y-1.5">
          <span className={labelClass}>Giá trị</span>
          <input type={spec.kind === "password" ? "password" : "text"} name="value" required autoComplete="off" className={inputClass} />
        </label>
      );
  }
}

export function DeleteSecretForm({ spec, apps }: { spec: SecretSpec; apps: PickableApp[] }) {
  const [state, formAction, pending] = useActionState(deleteSecretAction, initialState);
  const holders = apps.filter((a) => a.has);
  if (holders.length === 0) return null;

  return (
    <details className={`${cardClass} group`}>
      <summary className="flex cursor-pointer list-none items-center justify-between p-5 text-sm font-medium text-bad">
        Xoá secret khỏi app
        <span className="text-fg-faint transition group-open:rotate-180" aria-hidden="true">
          ⌄
        </span>
      </summary>
      <form action={formAction} className="space-y-4 border-t border-line p-5">
        <input type="hidden" name="name" value={spec.name} />
        <AppPicker apps={holders} initial="none" />
        <label className="block max-w-md space-y-1.5">
          <span className={labelClass}>
            Gõ <code className="rounded bg-surface-2 px-1 font-mono text-xs">{spec.name}</code> để xác nhận
          </span>
          <input type="text" name="confirm" autoComplete="off" className={inputClass} />
        </label>
        <button type="submit" disabled={pending} className={dangerButton}>
          {pending ? "Đang xoá…" : "Xoá khỏi các app đã chọn"}
        </button>
        <ActionResult state={state} />
      </form>
    </details>
  );
}
