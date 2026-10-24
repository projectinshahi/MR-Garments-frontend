import { PageContainer } from "@/components/layout/page-header";
import { SectionCard } from "@/components/shared/cards";
import { KeyValueList, type KeyValueItem } from "@/components/shared/key-value-list";
import { OrderContextStrip } from "@/features/order-detail/shared/order-detail-frame";
import { formatINR, formatShortDate } from "@/lib/formatters";

import type { ClearingTransport, CostLine } from "./data/queries";

/** Tab f (11_3.1.f_Clearing_&_transport.jpeg): clearing in India and transport to the warehouse, each with its costs. */
export function ClearingTransportScreen({ po, data }: { po: string; data: ClearingTransport }) {
  const { clearing, transport } = data;
  return (
    <PageContainer>
      <OrderContextStrip po={po} fact={`Container ${data.container}`} />
      <div className="grid grid-cols-1 gap-(--page-gap) lg:grid-cols-2">
        <CostCard
          title="Clearing in India"
          facts={[
            { label: "Clearing agent", value: clearing.agent },
            { label: "Contact person", value: `${clearing.contactPerson} · ${clearing.contactPhone}` },
            { label: "Bill of entry", value: clearing.billOfEntry },
            { label: "Arrived at port", value: formatShortDate(clearing.arrivedAtPort) },
            { label: "Handed to agent", value: formatShortDate(clearing.handedToAgent) },
            { label: "Duty paid", value: formatShortDate(clearing.dutyPaid) },
            { label: "Cleared", value: formatShortDate(clearing.cleared) },
          ]}
          costs={clearing.costs}
          totalLabel="Total clearing cost"
        />
        <CostCard
          title="Transport to warehouse"
          facts={[
            { label: "Transport", value: transport.company },
            { label: "LR number", value: transport.lrNumber },
            { label: "Vehicle", value: transport.vehicle },
            { label: "Driver", value: `${transport.driver} · ${transport.driverPhone}` },
            { label: `Loaded (${transport.loadedAt})`, value: `${formatShortDate(transport.loadedOn)} · ${transport.loadedBy}` },
            {
              label: "Unloaded at warehouse",
              value: `${formatShortDate(transport.unloadedOn)} · ${transport.bundlesUnloaded} of ${transport.bundlesTotal} bundles`,
            },
          ]}
          costs={transport.costs}
          totalLabel="Total transport cost"
        />
      </div>
    </PageContainer>
  );
}

/** Bold facts, a rule, muted cost rows, then the total under the navy rule. */
function CostCard({ title, facts, costs, totalLabel }: { title: string; facts: KeyValueItem[]; costs: CostLine[]; totalLabel: string }) {
  const total = costs.reduce((sum, cost) => sum + cost.amount, 0);
  return (
    <SectionCard title={title}>
      <KeyValueList size="sm" items={facts} boldValues className="border-b border-border-subtle" />
      <KeyValueList size="sm"
        className="mt-3"
        items={costs.map((cost) => ({ label: cost.label, value: formatINR(cost.amount), muted: true }))}
        total={{ label: totalLabel, value: formatINR(total) }}
      />
    </SectionCard>
  );
}
