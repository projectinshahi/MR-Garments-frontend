import { PageContainer } from "@/components/layout/page-header";
import { KpiCard, KpiRow, SectionCard } from "@/components/shared/cards";
import { Timeline } from "@/components/shared/timeline";
import { OrderContextStrip } from "@/features/order-detail/shared/order-detail-frame";
import { formatDate, formatNumber, formatQty } from "@/lib/formatters";

import type { OrderReceiving } from "./data/queries";
import { ReadOnlyField } from "./read-only-field";
import { ReceivingTable } from "./receiving-table";

/** Order detail, tab d (09_3.1.d_Receiving.jpeg): KPIs, the receipt in China, photos and receiving history. */
export function ReceivingScreen({ po, data }: { po: string; data: OrderReceiving }) {
  const fields = [
    { id: "receipt-received-on", label: "Received on", value: formatDate(data.receivedOn) },
    { id: "receipt-office", label: "Office", value: data.office },
    { id: "receipt-received-by", label: "Received by", value: data.receivedBy },
    { id: "receipt-bundles", label: "Bundles received", value: formatNumber(data.received.bundles) },
    { id: "receipt-pieces", label: "Pieces received", value: formatNumber(data.received.pieces) },
    { id: "receipt-short", label: "Short pieces", value: formatNumber(data.shortPieces) },
  ];

  return (
    <PageContainer>
      <OrderContextStrip po={po} fact={`Received in China ${formatDate(data.receivedOn)}`} />
      <KpiRow gap="sm">
        <KpiCard size="xs" label="Ordered" value={formatQty(data.ordered.pieces, "pcs")} sub={`${formatNumber(data.ordered.bundles)} bundles`} />
        <KpiCard size="xs"
          label="Received in China"
          value={formatQty(data.received.pieces, "pcs")}
          sub={`${formatNumber(data.received.bundles)} bundles`}
        />
        <KpiCard size="xs"
          label="Short"
          value={formatQty(data.shortPieces, "pcs")}
          sub={data.shortNote}
          tone={data.shortPieces > 0 ? "danger" : "default"}
        />
      </KpiRow>

      <div className="grid items-start gap-(--page-gap) lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <SectionCard title="Receipt in China" titleGap="none" className="min-w-0">
          <div className="mt-3 grid gap-x-4 gap-y-3 sm:grid-cols-3">
            {fields.map((field) => (
              <ReadOnlyField key={field.id} {...field} />
            ))}
          </div>
          <ReceivingTable rows={data.lines} className="mt-4.5" />
          <p className="mt-4.5 text-[12.5px] leading-[18px] font-bold text-label">Remark</p>
          <p className="mt-1 min-h-[60px] rounded-lg border border-input bg-input-background px-3 py-2.5 text-sm leading-[21px]">
            {data.remark}
          </p>
        </SectionCard>

        <div className="flex min-w-0 flex-col gap-(--page-gap)">
          <SectionCard title="Photos and papers" titleGap="none">
            <div className="mt-3.5 grid grid-cols-2 gap-2.5">
              {data.files.map((file) => (
                <div
                  key={file}
                  role="img"
                  aria-label={`Photo: ${file}`}
                  className="h-[54px] rounded-lg bg-[repeating-linear-gradient(135deg,var(--chart-track)_0_8px,var(--table-head)_8px_17px)]"
                />
              ))}
            </div>
            <p className="mt-1.5 text-[12.5px] leading-[18px] text-muted-foreground">{data.files.join(" · ")}</p>
          </SectionCard>
          <SectionCard title="Receiving history" titleGap="none">
            <Timeline size="sm"
              className="mt-2.5"
              items={data.history.map((event, index) => ({ ...event, marker: index === 0 ? "dot" : "ring" }))}
            />
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  );
}
