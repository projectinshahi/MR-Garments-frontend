import { PageContainer } from "@/components/layout/page-header";

/** The shape of a history tab while its data loads: a filter row, a figures strip and table rows (no figures shown). */
export function HistorySkeleton() {
  const bar = "animate-pulse rounded-lg bg-muted motion-reduce:animate-none";
  return (
    <PageContainer>
      <div role="status" aria-label="Loading supplier history" className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-3">
          <div className={`${bar} h-10 w-64`} />
          <div className={`${bar} h-10 w-40`} />
          <div className={`${bar} h-10 w-40`} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className={`${bar} h-[76px]`} />
          <div className={`${bar} h-[76px]`} />
          <div className={`${bar} h-[76px]`} />
        </div>
        <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className={`${bar} h-9`} />
          ))}
        </div>
        <span className="sr-only">Loading…</span>
      </div>
    </PageContainer>
  );
}
