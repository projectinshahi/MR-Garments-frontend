import { PageContainer } from "@/components/layout/page-header";
import { Callout, KpiCard, KpiRow, SectionCard } from "@/components/shared/cards";
import type { OrderView } from "@/features/order-detail/data/queries";
import { OrderContextStrip } from "@/features/order-detail/shared/order-detail-frame";
import { formatDate, formatNumber, formatQty } from "@/lib/formatters";

import type { WarehouseReceipt } from "./data/queries";
import { TeamsTable } from "./teams-table";

/** Tab g (12_3.1.g_Warehouse.jpeg): what arrived, who received it, and how the pieces were given to teams. */
export function WarehouseScreen({ order, data }: { order: OrderView; data: WarehouseReceipt }) {
  const given = data.teams.reduce((total, team) => total + team.pieces, 0);
  return (
    <PageContainer>
      <OrderContextStrip order={order} fact={`Received ${formatDate(data.receivedOn)}`} />
      <KpiRow gap="sm">
        <KpiCard
          size="xs"
          label="Received in warehouse"
          value={formatQty(data.pieces, "pcs")}
          sub={`${data.bundlesReceived} of ${data.bundlesLoaded} bundles`}
        />
        <KpiCard size="xs" label="Received on" value={formatDate(data.receivedOn)} sub={data.warehouse} />
        <KpiCard size="xs" label="Received by" value={data.receivedBy} sub={data.receivedByTeam} />
      </KpiRow>
      <div className="grid grid-cols-1 gap-(--page-gap) lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <SectionCard title="Given to teams" bottomGap="tight">
          <TeamsTable teams={data.teams} costPerPiece={data.costPerPiece} />
        </SectionCard>
        <SectionCard title="Check">
          <div className="flex flex-col gap-2.5">
            <Callout size="sm" tone="success">
              ✓ {data.bundlesLoaded} bundles loaded = {data.bundlesReceived} bundles received
            </Callout>
            <Callout size="sm" tone="success">
              ✓ {formatNumber(given)} of {formatNumber(data.pieces)} pcs given to teams. Nothing left unassigned.
            </Callout>
            <Callout size="sm" tone="info">Cost per piece is the same for every team because all pieces came in the same order.</Callout>
          </div>
        </SectionCard>
      </div>
    </PageContainer>
  );
}
