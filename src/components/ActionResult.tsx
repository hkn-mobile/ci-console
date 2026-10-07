import type { ActionState } from "@/app/actions";

/** Per-app outcome of the last submit, or the validation error that stopped it. */
export function ActionResult({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-lg border border-bad/30 bg-bad-soft px-3 py-2 text-sm text-bad">
        {state.error}
      </p>
    );
  }
  if (!state.results?.length) return null;

  const failed = state.results.filter((r) => !r.ok).length;
  return (
    <div role="status" className="space-y-2">
      <p className={`text-sm font-medium ${failed ? "text-bad" : "text-ok"}`}>
        {failed ? `${failed}/${state.results.length} thao tác lỗi` : `Xong · ${state.results.length} thao tác thành công`}
      </p>
      <ul className="overflow-hidden rounded-lg border border-line text-xs">
        {state.results.map((r) => (
          <li key={`${r.repo}/${r.name}`} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-line px-3 py-2 last:border-0">
            <span className={`size-1.5 rounded-full ${r.ok ? "bg-ok" : "bg-bad"}`} aria-hidden="true" />
            <span className="font-mono text-fg">{r.repo}</span>
            <span className="font-mono text-fg-faint">{r.name}</span>
            <span className={`ml-auto ${r.ok ? "text-ok" : "text-bad"}`}>{r.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
