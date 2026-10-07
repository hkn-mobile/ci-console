import Link from "next/link";

export function PageHeader({
  title,
  code,
  back,
  children,
}: {
  title: string;
  code?: string;
  back?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      {back && (
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-fg-muted transition hover:text-accent">
          <span aria-hidden="true">←</span> Tổng quan
        </Link>
      )}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {code && <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-fg-muted">{code}</code>}
      </div>
      {children && <div className="max-w-3xl text-sm leading-relaxed text-fg-muted">{children}</div>}
    </div>
  );
}
