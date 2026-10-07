import { notFound } from "next/navigation";
import { connection } from "next/server";
import { findSecret } from "@/lib/catalog";
import { formatDate, loadStatus } from "@/lib/status";
import type { PickableApp } from "@/components/AppPicker";
import { PageHeader } from "@/components/PageHeader";
import { DeleteSecretForm, SetSecretForm } from "./SecretForms";

export default async function SecretPage({ params }: { params: Promise<{ name: string }> }) {
  await connection();
  const { name } = await params;
  const spec = findSecret(name);
  if (!spec) notFound();

  const { apps, error } = await loadStatus();
  const pickable: PickableApp[] = apps.map((app) => {
    const info = app.secrets.get(spec.name);
    return {
      name: app.name,
      repo: app.repo,
      has: Boolean(info),
      updatedAt: info ? formatDate(info.updatedAt) : undefined,
      error: app.error ?? error,
    };
  });

  return (
    <div className="space-y-8">
      <PageHeader title={spec.label} code={spec.name} back>
        {spec.help}
        {spec.shared && " Secret này thường giống nhau cho mọi app: điền một lần rồi chọn tất cả."}
      </PageHeader>
      <SetSecretForm spec={spec} apps={pickable} />
      <DeleteSecretForm spec={spec} apps={pickable} />
    </div>
  );
}
