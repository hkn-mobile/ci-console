import { cardClass } from "@/components/ui";

/** Shown at once while a page waits on GitHub, so switching tabs never looks frozen. */
export default function Loading() {
  return (
    <div className="space-y-8" role="status" aria-label="Đang tải">
      <div className="space-y-3">
        <div className="h-7 w-56 animate-pulse rounded-md bg-surface-2" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded bg-surface-2" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className={`${cardClass} space-y-3 p-5`}>
          <div className="h-5 w-40 animate-pulse rounded bg-surface-2" />
          <div className="h-4 w-full animate-pulse rounded bg-surface-2" />
          <div className="h-4 w-4/5 animate-pulse rounded bg-surface-2" />
          <div className="h-4 w-3/5 animate-pulse rounded bg-surface-2" />
        </div>
      ))}
    </div>
  );
}
