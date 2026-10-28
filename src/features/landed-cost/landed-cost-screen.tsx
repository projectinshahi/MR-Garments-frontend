import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { KpiCard, KpiRow } from "@/components/shared/cards";
import { StatusPill } from "@/components/shared/status-pill";
import { UrlSelect } from "@/features/reports/report-actions";
import { formatINR, formatNumber } from "@/lib/formatters";

import { listPos } from "./cost-math";
import type { LandedCostData } from "./data/queries";
import { LandedCostBody } from "./landed-cost-client";

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;
const options = (all: string, named: { id: string; name: string }[]) => [{ value: "all", label: all }, ...named.map((n) => ({ value: n.id, label: n.name }))];

/** Landed Cost (31_12_Landed_Cost.jpeg): KPIs, landed cost by order or team, and the selected order's breakdown. */
export function LandedCostScreen({ data }: { data: LandedCostData }) {
  const { kpis } = data;
  const waiting = kpis.estimateWaitingFor ? `, waiting for ${kpis.estimateWaitingFor}` : "";
  return (
    <>
      <PageHeader
        title="Landed Cost"
        titleAddon={<StatusPill tone="neutral">Management only</StatusPill>}
        actions={
          // Hidden on phones (an undesigned width), where they would squeeze the page title out of the header.
          <div className="hidden items-center gap-3.5 sm:flex">
            <UrlSelect param="supplier" label="Supplier" size="sm" options={options("All suppliers", data.suppliers)} />
            <UrlSelect param="team" label="Team" size="sm" options={options("All teams", data.teams)} />
          </div>
        }
      />
      <PageContainer>
        <KpiRow gap="sm">
          <KpiCard
            size="xs"
            label="Total landed cost, finished orders"
            value={formatINR(kpis.finishedTotalInr)}
            sub={`${plural(kpis.finishedPos.length, "order")}, all costs entered`}
          />
          <KpiCard
            size="xs"
            label="Goods costed"
            value={`${formatNumber(kpis.finishedPieces)} pcs`}
            sub={kpis.finishedPos.length ? listPos(kpis.finishedPos) : "no finished orders yet"}
          />
          <KpiCard
            size="xs"
            label="Still an estimate"
            value={plural(kpis.estimatePos.length, "order")}
            sub={kpis.estimatePos.length ? `${listPos(kpis.estimatePos)}${waiting}` : "every order is final"}
          />
        </KpiRow>
        <LandedCostBody orders={data.orders} teams={data.teams} />
      </PageContainer>
    </>
  );
}
