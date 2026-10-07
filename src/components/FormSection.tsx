/** Numbered block of a form, so long forms read as steps. */
export function FormSection({ step, title, hint, children }: { step: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-b border-line p-5 last:border-0 md:grid-cols-[220px_1fr]">
      <div className="flex gap-3">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">{step}</span>
        <div>
          <h2 className="text-sm font-medium text-fg">{title}</h2>
          {hint && <p className="mt-1 text-xs leading-relaxed text-fg-muted">{hint}</p>}
        </div>
      </div>
      <div className="min-w-0 space-y-3">{children}</div>
    </section>
  );
}
