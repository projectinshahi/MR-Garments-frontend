import { PageContainer } from "@/components/layout/page-header";
import { SectionCard } from "@/components/shared/cards";
import { KeyValueList } from "@/components/shared/key-value-list";
import { ProgressBar } from "@/components/shared/progress";
import { TermsBadge } from "@/components/shared/status-pill";
import { OrderContextStrip } from "@/features/order-detail/shared/order-detail-frame";
import { formatDate, formatNumber, formatQty } from "@/lib/formatters";

import type { OrderItems } from "./data/queries";
import { ItemsTable } from "./items-table";

/** Order detail, tab b (07_3.1.b_Items.jpeg): items table and sizes on the left, terms and notes on the right. */
export function ItemsScreen({ po, data }: { po: string; data: OrderItems }) {
  const maxSize = Math.max(...data.sizes.map((s) => s.pieces));
  const sizeSum = `${data.sizes.map((s) => formatNumber(s.pieces)).join(" + ")} = ${formatQty(data.sizeTotal, "pcs")}`;

  return (
    <PageContainer>
      <OrderContextStrip po={po} fact={`Order date ${formatDate(data.orderDate)}`} />
      <div className="grid gap-(--page-gap) lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-(--page-gap)">
          <SectionCard title="Items ordered" bottomGap="tight">
            <ItemsTable rows={data.lines} totals={data.totals} />
          </SectionCard>
          <SectionCard title="Quantity by size" titleGap="none">
            <ul className="mt-3">
              {data.sizes.map((s) => (
                <li key={s.size} className="grid h-[34px] grid-cols-[72px_1fr_88px] items-center text-sm sm:grid-cols-[82px_1fr_123px]">
                  <span>Size {s.size}</span>
                  <ProgressBar value={s.pieces} max={maxSize} label={`Size ${s.size}`} />
                  <span className="text-right font-bold">{formatQty(s.pieces, "pcs")}</span>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[12.5px] leading-[18px] text-muted-foreground">
              {sizeSum} · {data.piecesPerBundle} pcs in each bundle
            </p>
          </SectionCard>
        </div>

        <div className="flex min-w-0 flex-col gap-(--page-gap)">
          <SectionCard title="Order terms" titleGap="none">
            <KeyValueList
              className="mt-3"
              boldValues
              items={[
                { label: "Supplier", value: data.supplier },
                { label: "Contact", value: data.contact },
                { label: "Terms", value: <TermsBadge terms={data.terms} size="md" /> },
                { label: "Order date", value: formatDate(data.orderDate) },
                { label: "Delivery date", value: formatDate(data.deliveryDate) },
                { label: "Currency", value: data.currency },
              ]}
            />
          </SectionCard>
          <SectionCard title="Notes" titleGap="none">
            <p className="mt-3 min-h-[84px] rounded-lg border border-input bg-input-background px-3 py-2.5 text-sm leading-[21px]">
              {data.notes}
            </p>
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  );
}
