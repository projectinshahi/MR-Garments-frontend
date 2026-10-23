import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/states";

/**
 * Orchestrator placeholder for a registered route whose screen is not built yet. The owning screen agent
 * replaces the whole page.tsx (see docs/proposed-build-plan.md §6).
 */
export function RoutePlaceholder({
  title,
  references,
  withHeader = true,
}: {
  title: string;
  references: string;
  /** false inside a layout that already renders the header (order-detail tabs). */
  withHeader?: boolean;
}) {
  return (
    <>
      {withHeader ? <PageHeader title={title} /> : null}
      <PageContainer>
        <EmptyState title={`${title}: screen not built yet`} description={`Reference: ${references}`} />
      </PageContainer>
    </>
  );
}
