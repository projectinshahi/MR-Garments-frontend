import { PageContainer } from "@/components/layout/page-header";
import { KpiCard, KpiRow, SectionCard } from "@/components/shared/cards";
import { EmptyState } from "@/components/shared/states";
import { Timeline } from "@/components/shared/timeline";
import type { OrderReceipt, OrderView } from "@/features/order-detail/data/queries";
import { OrderContextStrip } from "@/features/order-detail/shared/order-detail-frame";
import { formatDate, formatNumber, formatQty, formatShortDate } from "@/lib/formatters";

import { ReadOnlyField } from "./read-only-field";
import { ReceivingTable } from "./receiving-table";

/**
 * Order detail, tab d (09_3.1.d_Receiving.jpeg) from ORD-4: KPIs (the main line, as in the orders list), the latest
 * receipt with every line's totals, and each receipt in the history. No photos or papers are recorded, so that card
 * is left out.
 */
export function ReceivingScreen({ order, receipts }: { order: OrderView; receipts: OrderReceipt[] }) {
  const latest = receipts.at(-1);
  if (!latest) {
    return (
      <PageContainer>
        <OrderContextStrip order={order} fact="Not received in China yet" />
        <EmptyState title="No receipts recorded yet." />
      </PageContainer>
    );
  }

  const short = order.quantity - order.received;
  const bundles = receipts.reduce((sum, r) => sum + r.bundles, 0);
  const fields = [
    { id: "receipt-received-on", label: "Received on", value: formatDate(latest.receivedOn) },
    { id: "receipt-office", label: "Office", value: latest.office },
    { id: "receipt-received-by", label: "Received by", value: latest.receivedBy },
    { id: "receipt-bundles", label: "Bundles received", value: formatNumber(latest.bundles) },
    { id: "receipt-delivery-note", label: "Delivery note", value: latest.deliveryNote },
  ];
  const received = (receipt: OrderReceipt) =>
    receipt.lines
      .filter((line) => line.quantity > 0)
      .map((line) => `${formatQty(line.quantity, line.unit)} ${line.item}`)
      .join(", ");

  return (
    <PageContainer>
      <OrderContextStrip order={order} fact={`Received in China ${formatDate(latest.receivedOn)}`} />
      <KpiRow gap="sm">
        <KpiCard size="xs" label="Ordered" value={formatQty(order.quantity, order.unit)} />
        <KpiCard size="xs" label="Received in China" value={formatQty(order.received, order.unit)} sub={`${formatNumber(bundles)} bundles`} />
        <KpiCard size="xs" label="Short" value={formatQty(short, order.unit)} tone={short > 0 ? "danger" : "default"} />
      </KpiRow>

      <div className="grid items-start gap-(--page-gap) lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <SectionCard title={receipts.length > 1 ? "Latest receipt in China" : "Receipt in China"} titleGap="none" className="min-w-0">
          <div className="mt-3 grid gap-x-4 gap-y-3 sm:grid-cols-3">
            {fields.map((field) => (
              <ReadOnlyField key={field.id} {...field} />
            ))}
          </div>
          <ReceivingTable lines={order.lines} className="mt-4.5" />
          {latest.shortRemark ? (
            <>
              <p className="mt-4.5 text-[12.5px] leading-[18px] font-bold text-label">Remark</p>
              <p className="mt-1 min-h-[60px] rounded-lg border border-input bg-input-background px-3 py-2.5 text-sm leading-[21px]">
                {latest.shortRemark}
              </p>
            </>
          ) : null}
        </SectionCard>

        <div className="flex min-w-0 flex-col gap-(--page-gap)">
          <SectionCard title="Receiving history" titleGap="none">
            <Timeline
              size="sm"
              className="mt-2.5"
              items={receipts.toReversed().map((receipt, index) => ({
                title: `Received ${received(receipt)}`,
                detail: [formatShortDate(receipt.receivedOn), receipt.office, receipt.receivedBy].filter(Boolean).join(" · "),
                marker: index === 0 ? "dot" : "ring",
              }))}
            />
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  );
}
