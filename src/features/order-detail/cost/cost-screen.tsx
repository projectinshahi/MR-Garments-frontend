import { PageContainer } from "@/components/layout/page-header";
import { SectionCard } from "@/components/shared/cards";
import { KeyValueList } from "@/components/shared/key-value-list";
import { LegendSwatch, StackedBar, type StackedSegment } from "@/components/shared/progress";
import { StatusPill } from "@/components/shared/status-pill";
import type { OrderView } from "@/features/order-detail/data/queries";
import { OrderContextStrip } from "@/features/order-detail/shared/order-detail-frame";
import { formatINR } from "@/lib/formatters";

import { CostTable } from "./cost-table";
import { summarizeCost } from "./cost-summary";
import type { CostGroup, OrderCost } from "./data/queries";

const GROUP_UI: Record<CostGroup, { label: string; color: StackedSegment["color"] }> = {
  goods: { label: "Goods", color: "chart-1" },
  duty: { label: "Duty, taxes and clearing", color: "chart-2" },
  transport: { label: "Transport in India", color: "chart-3" },
};

/** Tab h (13_3.1.h_Cost.jpeg): the landed-cost breakdown, where the money goes, and the cost per piece. */
export function CostScreen({ order, data }: { order: OrderView; data: OrderCost }) {
  const { total, perPiece, groups } = summarizeCost(data);
  const [goods, duty, transport] = groups;
  return (
    <PageContainer>
      <OrderContextStrip order={order} fact={`Landed cost ${formatINR(total)}`} />
      <div className="grid grid-cols-1 items-start gap-(--page-gap) lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <SectionCard title="Cost breakdown" bottomGap="tight">
          <CostTable lines={data.lines} pieces={data.pieces} total={total} />
        </SectionCard>
        <div className="flex flex-col gap-(--page-gap)">
          <SectionCard title="Where the money goes">
            <StackedBar segments={groups.map((g) => ({ label: GROUP_UI[g.group].label, value: g.value, color: GROUP_UI[g.group].color }))} />
            <KeyValueList
              boldValues
              className="mt-3.5"
              items={groups.map((g) => ({
                label: (
                  <>
                    <LegendSwatch color={GROUP_UI[g.group].color} />
                    <span className="ml-2.5">{GROUP_UI[g.group].label}</span>
                    <span className="ml-1.5 text-xs text-muted-foreground">{g.percent}%</span>
                  </>
                ),
                value: formatINR(g.value),
              }))}
            />
          </SectionCard>
          <SectionCard title="Per piece">
            <p className="text-[34px] leading-10 font-bold">{formatINR(perPiece, 2)}</p>
            <p className="text-[12.5px] leading-[18px] text-muted-foreground">
              Goods {formatINR(goods.perPiece, 2)} + duty and clearing {formatINR(duty.perPiece, 2)} + transport{" "}
              {formatINR(transport.perPiece, 2)}
            </p>
            <div className="mt-2 flex">
              <StatusPill tone="neutral">Management only</StatusPill>
            </div>
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  );
}
