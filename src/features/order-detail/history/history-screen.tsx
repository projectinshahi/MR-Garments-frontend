import { PageContainer } from "@/components/layout/page-header";
import { OrderContextStrip } from "@/features/order-detail/shared/order-detail-frame";

import type { HistoryEvent } from "./data/queries";
import { HistoryTable } from "./history-table";

/** Tab i (14_3.1.i_History.jpeg): everything that happened to the order, newest first. */
export function HistoryScreen({ po, events }: { po: string; events: HistoryEvent[] }) {
  return (
    <PageContainer>
      <OrderContextStrip po={po} fact="Everything that happened, newest first" />
      <HistoryTable events={events} />
    </PageContainer>
  );
}
