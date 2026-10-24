import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Callout, KpiCard, KpiRow, SectionCard } from "@/components/shared/cards";
import { LegendSwatch, StackedBar, type StackedSegment } from "@/components/shared/progress";
import { StatusPill } from "@/components/shared/status-pill";
import { formatINR, formatNumber } from "@/lib/formatters";

import { shareOfTotal, summarizeOrders } from "./cost-math";
import type { CostPartKey, LandedCostData } from "./data/queries";
import { GoodsCostTable, LandedCostFilters, OrdersCostCard } from "./landed-cost-client";

const PART_COLORS: Record<CostPartKey, StackedSegment["color"]> = { goods: "chart-1", duty: "chart-4", transport: "chart-2" };

/** Landed Cost (31_12_Landed_Cost.jpeg): KPIs, landed cost by order, and PO-2028's breakdown and goods payments. */
export function LandedCostScreen({ data }: { data: LandedCostData }) {
  const { orders, breakdown } = data;
  const kpis = summarizeOrders(orders);
  const { total, percents } = shareOfTotal(breakdown.parts.map((part) => part.value));

  return (
    <>
      <PageHeader
        title="Landed Cost"
        titleAddon={<StatusPill tone="neutral">Management only</StatusPill>}
        actions={<LandedCostFilters suppliers={data.suppliers} teams={data.teams} />}
      />
      <PageContainer>
        <KpiRow gap="sm">
          <KpiCard
            size="xs"
            label="Total landed cost, finished orders"
            value={formatINR(kpis.finishedTotal)}
            sub={`${kpis.finishedPOs.length} orders, all costs entered`}
          />
          <KpiCard
            size="xs"
            label="Goods costed"
            value={`${formatNumber(kpis.finishedPieces)} pcs`}
            sub={kpis.finishedPOs.join(" and ")}
          />
          <KpiCard
            size="xs"
            label="Still an estimate"
            value={`${kpis.estimatePOs.length} order${kpis.estimatePOs.length === 1 ? "" : "s"}`}
            sub={`${kpis.estimatePOs.join(", ")}, ${data.estimateReason}`}
          />
        </KpiRow>

        <OrdersCostCard orders={orders} selectedPo={breakdown.po} />

        <div className="grid gap-(--page-gap) lg:grid-cols-2">
          <SectionCard title={`${breakdown.po} · ${breakdown.item}: where the ${formatINR(total)} goes`} titleGap="none" className="min-w-0 pt-[17px]">
            <StackedBar
              className="mt-[13px]"
              segments={breakdown.parts.map((part) => ({ label: part.label, value: part.value, color: PART_COLORS[part.key] }))}
            />
            <ul className="mt-3.5">
              {breakdown.parts.map((part, index) => (
                <li key={part.key} className="flex min-h-[35px] items-center border-b border-border-subtle text-sm">
                  <LegendSwatch color={PART_COLORS[part.key]} />
                  {/* Inline runs, so the label and qualifier (and the amount and share) sit on one baseline. */}
                  <span className="ml-2.5 min-w-0">
                    {part.label}
                    {part.qualifier ? <span className="ml-1.5 text-[12.5px] text-muted-foreground">{part.qualifier}</span> : null}
                  </span>
                  <span className="ml-auto pl-3">
                    <span className="text-[14.5px] font-bold">{formatINR(part.value)}</span>
                    <span className="ml-2.5 text-[12.5px] font-bold text-muted-foreground">{percents[index]}%</span>
                  </span>
                </li>
              ))}
              <li className="flex min-h-[35px] items-center justify-between gap-3 text-sm text-muted-foreground">
                <span>{breakdown.excluded.label}</span>
                <span>{formatINR(breakdown.excluded.value)}</span>
              </li>
            </ul>
          </SectionCard>

          <SectionCard title="Goods cost, changed to INR on each payment date" className="min-w-0 pb-[17px]">
            <GoodsCostTable payments={data.goodsPayments} />
            <Callout size="sm" className="mt-3">
              Each payment uses the rate of its own date, so the goods cost is the real amount paid.
            </Callout>
          </SectionCard>
        </div>
      </PageContainer>
    </>
  );
}
