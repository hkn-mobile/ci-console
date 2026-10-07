"use client";

import { useActionState } from "react";
import { setKeystoreAction, type ActionState } from "@/app/actions";
import { AppPicker, type PickableApp } from "@/components/AppPicker";
import { ActionResult } from "@/components/ActionResult";
import { FormSection } from "@/components/FormSection";
import { cardClass, fileClass, hintClass, inputClass, labelClass, primaryButton } from "@/components/ui";

const initialState: ActionState = {};

export function KeystoreForm({ apps }: { apps: PickableApp[] }) {
  const [state, formAction, pending] = useActionState(setKeystoreAction, initialState);

  return (
    <form action={formAction} className={cardClass}>
      <FormSection step={1} title="File keystore" hint="File .jks dùng để ký bản phát hành (upload key).">
        <label className="block space-y-1.5">
          <span className={labelClass}>Keystore (.jks)</span>
          <input type="file" name="keystore" required accept=".jks,.keystore" className={fileClass} />
        </label>
      </FormSection>
      <FormSection step={2} title="Mật khẩu và alias" hint="Chọn key.properties để tự điền, hoặc nhập tay. Ô nhập tay được ưu tiên.">
        <label className="block space-y-1.5">
          <span className={labelClass}>key.properties</span>
          <input type="file" name="properties" accept=".properties" className={fileClass} />
          <span className={hintClass}>Lấy storePassword, keyAlias, keyPassword từ file.</span>
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block space-y-1.5">
            <span className={labelClass}>storePassword</span>
            <input type="password" name="storePassword" autoComplete="off" className={inputClass} />
          </label>
          <label className="block space-y-1.5">
            <span className={labelClass}>keyAlias</span>
            <input type="text" name="keyAlias" autoComplete="off" className={inputClass} />
          </label>
          <label className="block space-y-1.5">
            <span className={labelClass}>keyPassword</span>
            <input type="password" name="keyPassword" autoComplete="off" className={inputClass} />
          </label>
        </div>
      </FormSection>
      <FormSection step={3} title="Chọn app" hint="Mặc định chọn các app còn thiếu ít nhất một trong 4 secret.">
        <AppPicker apps={apps} />
      </FormSection>
      <div className="flex flex-col gap-3 p-5">
        <div>
          <button type="submit" disabled={pending} className={primaryButton}>
            {pending ? "Đang gửi lên GitHub…" : "Lưu 4 secret vào các app đã chọn"}
          </button>
        </div>
        <ActionResult state={state} />
      </div>
    </form>
  );
}
