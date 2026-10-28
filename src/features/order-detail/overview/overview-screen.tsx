import { PageContainer } from "@/components/layout/page-header";
import { SectionCard } from "@/components/shared/cards";
import { KeyValueList } from "@/components/shared/key-value-list";
import { StatusPill } from "@/components/shared/status-pill";
import { Journey } from "@/components/shared/timeline";
import type { OrderView } from "@/features/order-detail/data/queries";
import { formatCNY, formatDate, formatINR, formatQty } from "@/lib/formatters";

import { journeySteps } from "./journey";

/**
 * Order detail, tab a (06_3.1.a_Overview.jpeg) from ORD-4: header card, journey and money. Nothing records landed
 * cost, bundles, terms, who entered the order, team hand-outs or an activity log yet, so those parts are left out.
 */
export function OverviewScreen({ order }: { order: OrderView }) {
  const facts = [
    { label: "Order date", value: formatDate(order.orderDate) },
    { label: "Delivery date", value: formatDate(order.deliveryDate) },
    { label: "Quantity", value: formatQty(order.quantity, order.unit) },
  ];
  const contact = order.supplier.contactPerson;

  return (
    <PageContainer>
      <SectionCard aria-labelledby="order-overview-title" className="pt-[19px] pb-[17px]">
        <div className="border-b pb-3.5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="order-overview-title" className="text-[22px] leading-7 font-bold">
              {order.item}
            </h2>
            <StatusPill tone={order.status.tone}>{order.status.label}</StatusPill>
          </div>
          <p className="mt-px text-sm leading-5 text-muted-foreground">
            {order.supplier.name}
            {contact ? ` · Contact: ${contact}` : null}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-3.5 gap-y-3 pt-3.5 sm:grid-cols-5">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt className="text-[12.5px] leading-[18px] text-muted-foreground">{fact.label}</dt>
              <dd className="text-base leading-5 font-bold">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </SectionCard>

      <SectionCard title="Journey of this order" titleGap="none">
        <div className="overflow-x-auto">
          <Journey size="sm" className="mt-3 min-w-[720px]" steps={journeySteps(order)} />
        </div>
      </SectionCard>

      <div className="grid gap-(--page-gap) lg:grid-cols-3">
        <SectionCard title="Money" titleGap="none">
          <KeyValueList
            size="sm"
            className="mt-3"
            items={[{ label: `Goods, paid ${formatCNY(order.paidCny)}`, value: formatINR(order.paidInr) }]}
          />
        </SectionCard>
      </div>
    </PageContainer>
  );
}
