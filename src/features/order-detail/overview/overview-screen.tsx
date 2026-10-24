import { PageContainer } from "@/components/layout/page-header";
import { SectionCard } from "@/components/shared/cards";
import { KeyValueList } from "@/components/shared/key-value-list";
import { StatusPill } from "@/components/shared/status-pill";
import { Journey, Timeline } from "@/components/shared/timeline";
import { formatDate, formatINR, formatNumber, formatQty, formatShortDate } from "@/lib/formatters";
import { STAGES } from "@/types/domain";

import type { OrderOverview } from "./data/queries";

/** Order detail, tab a (06_3.1.a_Overview.jpeg): header card, journey, then money, teams and activity. */
export function OverviewScreen({ data }: { data: OrderOverview }) {
  const facts = [
    { label: "Order date", value: formatDate(data.orderDate) },
    { label: "Delivery date", value: formatDate(data.deliveryDate) },
    { label: "Quantity", value: `${formatQty(data.pieces, "pcs")} · ${formatNumber(data.bundles)} bundles` },
    { label: "Terms", value: data.terms },
    { label: "Entered by", value: data.enteredBy },
  ];

  return (
    <PageContainer>
      <SectionCard aria-labelledby="order-overview-title" className="pt-[19px] pb-[17px]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-3.5">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="order-overview-title" className="text-[22px] leading-7 font-bold">
                {data.header.item}
              </h2>
              <StatusPill tone={data.header.status.tone}>{data.header.status.label}</StatusPill>
            </div>
            <p className="mt-px text-sm leading-5 text-muted-foreground">
              {data.header.supplier} · Contact: {data.contact}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11.5px] leading-4 text-muted-foreground">Landed cost</p>
            <p className="text-2xl leading-7 font-bold">{formatINR(data.landedCost)}</p>
            <p className="text-xs leading-[18px] text-muted-foreground">{formatINR(data.costPerPiece, 2)} per piece</p>
          </div>
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
          <Journey size="sm"
            className="mt-3 min-w-[720px]"
            steps={data.journey.map((step) => ({
              title: `${step.stage}. ${STAGES[step.stage - 1]}`,
              lines: [formatShortDate(step.date), step.detail],
              marker: "check",
            }))}
          />
        </div>
      </SectionCard>

      <div className="grid gap-(--page-gap) lg:grid-cols-3">
        <SectionCard title="Money" titleGap="none">
          <KeyValueList size="sm"
            className="mt-3"
            items={data.money.map((row) => ({ label: row.label, value: formatINR(row.inr) }))}
            total={{ label: "Landed cost", value: formatINR(data.landedCost) }}
          />
        </SectionCard>
        <SectionCard title="Given to teams" titleGap="none">
          <KeyValueList size="sm"
            className="mt-3"
            items={data.teams.map((row) => ({ label: row.team, value: formatQty(row.pieces, "pcs") }))}
            total={{ label: "Total", value: formatQty(data.teamTotal, "pcs") }}
          />
        </SectionCard>
        <SectionCard title="Latest activity" titleGap="none">
          <Timeline size="sm" className="mt-2.5" items={data.activity.map((item) => ({ ...item, marker: "dot" }))} />
        </SectionCard>
      </div>
    </PageContainer>
  );
}
