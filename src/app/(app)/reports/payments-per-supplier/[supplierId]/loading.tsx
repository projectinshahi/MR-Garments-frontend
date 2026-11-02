import { PageContainer } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";

// The supplier detail's shape while it loads: header, overview, two rows of KPI tiles and the three list cards.
// A page or filter change keeps the current page instead (same segment), with the progress bar.
export default function Loading() {
  const tiles = (
    <div className="grid gap-4 md:grid-cols-3">
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} className="h-[91.5px] rounded-xl" />
      ))}
    </div>
  );
  return (
    <div role="status" aria-label="Loading supplier" className="flex flex-1 flex-col">
      <div className="flex h-(--header-height) shrink-0 items-center gap-3 border-b bg-card px-4 md:px-(--page-padding)">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-6 w-48" />
      </div>
      <PageContainer>
        <Skeleton className="h-[190px] rounded-xl" />
        {tiles}
        {tiles}
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-[280px] rounded-xl" />
        ))}
      </PageContainer>
    </div>
  );
}
