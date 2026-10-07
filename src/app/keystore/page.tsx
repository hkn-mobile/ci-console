import { connection } from "next/server";
import { KEYSTORE_SECRETS } from "@/lib/catalog";
import { formatDate, loadStatus } from "@/lib/status";
import type { PickableApp } from "@/components/AppPicker";
import { PageHeader } from "@/components/PageHeader";
import { KeystoreForm } from "./KeystoreForm";

export default async function KeystorePage() {
  await connection();
  const { apps, error } = await loadStatus();
  const pickable: PickableApp[] = apps.map((app) => {
    const present = KEYSTORE_SECRETS.map((name) => app.secrets.get(name));
    const latest = present
      .filter((s) => s !== undefined)
      .map((s) => s.updatedAt)
      .sort()
      .at(-1);
    return {
      name: app.name,
      repo: app.repo,
      has: present.every(Boolean),
      updatedAt: latest ? formatDate(latest) : undefined,
      error: app.error ?? error,
    };
  });

  return (
    <div className="space-y-8">
      <PageHeader title="Bộ keystore" back>
        Điền một lần cả 4 secret dùng để ký app. Chọn file <code className="font-mono text-fg">.jks</code> và{" "}
        <code className="font-mono text-fg">key.properties</code>, hoặc nhập tay phần mật khẩu.
        <span className="mt-3 flex flex-wrap gap-1.5">
          {KEYSTORE_SECRETS.map((n) => (
            <code key={n} className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-fg-muted">
              {n}
            </code>
          ))}
        </span>
      </PageHeader>
      <KeystoreForm apps={pickable} />
    </div>
  );
}
