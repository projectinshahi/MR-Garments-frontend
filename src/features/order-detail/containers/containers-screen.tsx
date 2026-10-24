import { PageContainer } from "@/components/layout/page-header";
import { Callout, SectionCard } from "@/components/shared/cards";
import { KeyValueList } from "@/components/shared/key-value-list";
import { TermsBadge } from "@/components/shared/status-pill";
import { Journey } from "@/components/shared/timeline";
import { OrderContextStrip } from "@/features/order-detail/shared/order-detail-frame";
import { ReadOnlyField } from "@/features/order-detail/receiving/read-only-field";
import { formatNumber, formatQty, formatShortDate } from "@/lib/formatters";

import type { OrderContainer } from "./data/queries";

/** Order detail, tab e (10_3.1.e_Containers.jpeg): each container with its route, numbers and this order's goods. */
export function ContainersScreen({ po, containers }: { po: string; containers: OrderContainer[] }) {
  const count = containers.length;

  return (
    <PageContainer>
      <OrderContextStrip po={po} fact={`${count} ${count === 1 ? "container" : "containers"}`} />
      <div className="grid gap-(--page-gap) lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-(--page-gap)">
          {containers.map((c, index) => (
            <SectionCard key={c.number} title={`Container ${c.number}`} titleGap="none" className="flex-1">
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                <TermsBadge terms={c.terms} size="md" />
                <span className="text-sm text-muted-foreground">Shipping agent: {c.shippingAgent}</span>
              </div>
              <Journey size="sm"
                align="edges"
                className="mt-2.5"
                steps={c.route.map((point) => ({
                  title: point.place,
                  lines: [`${point.event} ${formatShortDate(point.date)}`],
                  marker: "dot",
                }))}
              />
              <div className="mt-4 grid gap-x-4 gap-y-3 sm:grid-cols-3">
                <ReadOnlyField id={`container-${index}-number`} label="Container number" value={c.number} />
                <ReadOnlyField id={`container-${index}-seal`} label="Seal number" value={c.seal} />
                <ReadOnlyField id={`container-${index}-bl`} label="Bill of lading" value={c.billOfLading} />
              </div>
            </SectionCard>
          ))}
        </div>

        <div className="flex min-w-0 flex-col gap-(--page-gap)">
          {containers.map((c) => (
            <SectionCard key={c.number} title="Goods of this order in the container" titleGap="none">
              <KeyValueList size="sm"
                className="mt-3"
                boldValues
                items={[
                  { label: c.goods.item, value: formatQty(c.goods.pieces, "pcs") },
                  { label: "Bundles", value: formatNumber(c.goods.bundles) },
                ]}
                total={{ label: "Share of this order in container", value: `${c.sharePercent}%` }}
              />
            </SectionCard>
          ))}
          <SectionCard title="Good to know" titleGap="none">
            <Callout size="sm" className="mt-3.5">
              If an order is split into more than one container, each container is listed here with its own quantity. If a
              container holds several orders, they are listed on the container page.
            </Callout>
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  );
}
