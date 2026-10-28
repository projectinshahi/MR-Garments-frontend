import Link from "next/link";

import { PageContainer } from "@/components/layout/page-header";
import { Callout, SectionCard } from "@/components/shared/cards";
import { KeyValueList } from "@/components/shared/key-value-list";
import { EmptyState } from "@/components/shared/states";
import { TermsBadge } from "@/components/shared/status-pill";
import { Journey, type JourneyStep } from "@/components/shared/timeline";
import type { OrderContainer, OrderView } from "@/features/order-detail/data/queries";
import { OrderContextStrip } from "@/features/order-detail/shared/order-detail-frame";
import { ReadOnlyField } from "@/features/order-detail/receiving/read-only-field";
import { formatNumber, formatQty, formatShortDate } from "@/lib/formatters";

const linkClass = "rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50";

// Loading port, sea, arrival port: a dot once the container has reached the point, a ring before.
function route(c: OrderContainer): JourneyStep[] {
  const sailed = c.status !== "loading";
  return [
    { title: "Loading port", lines: c.loadedOn ? [`Loaded ${formatShortDate(c.loadedOn)}`] : [], marker: "dot" },
    { title: "On the sea", lines: c.sailedOn ? [`Sailed ${formatShortDate(c.sailedOn)}`] : [], marker: sailed ? "dot" : "ring" },
    { title: "Arrival port", lines: [`ETA ${formatShortDate(c.eta)}`], marker: c.status === "arrived" ? "dot" : "ring" },
  ];
}

/**
 * Order detail, tab e (10_3.1.e_Containers.jpeg) from ORD-4: each container carrying this order (oldest first) with its
 * route and this order's goods in it. Ports, seal and bill of lading aren't part of ORD-4, so they are left out.
 * `linkContainers`: the user may open the container page.
 */
export function ContainersScreen({ order, containers, linkContainers }: { order: OrderView; containers: OrderContainer[]; linkContainers: boolean }) {
  const count = containers.length;
  const fact = `${count} ${count === 1 ? "container" : "containers"}`;
  if (count === 0) {
    return (
      <PageContainer>
        <OrderContextStrip order={order} fact={fact} />
        <EmptyState title="Not loaded into a container yet." />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <OrderContextStrip order={order} fact={fact} />
      <div className="grid gap-(--page-gap) lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-(--page-gap)">
          {containers.map((c, index) => (
            <SectionCard
              key={c.id}
              title={
                <>
                  Container{" "}
                  {linkContainers ? (
                    <Link href={`/containers/${c.id}`} className={linkClass}>
                      {c.number}
                    </Link>
                  ) : (
                    c.number
                  )}
                </>
              }
              titleGap="none"
              className="flex-1"
            >
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                <TermsBadge terms={c.terms} size="md" />
                <span className="text-sm text-muted-foreground">Shipping agent: {c.agent.name}</span>
              </div>
              <Journey size="sm" align="edges" className="mt-2.5" steps={route(c)} />
              <div className="mt-4 grid gap-x-4 gap-y-3 sm:grid-cols-3">
                <ReadOnlyField id={`container-${index}-number`} label="Container number" value={c.number} />
              </div>
            </SectionCard>
          ))}
        </div>

        <div className="flex min-w-0 flex-col gap-(--page-gap)">
          {containers.map((c) => (
            <SectionCard key={c.id} title={count === 1 ? "Goods of this order in the container" : `Goods of this order in ${c.number}`} titleGap="none">
              <KeyValueList
                size="sm"
                className="mt-3"
                boldValues
                items={[
                  ...c.lines.map((line) => ({ label: line.item, value: formatQty(line.quantity, line.unit) })),
                  { label: "Bundles", value: formatNumber(c.lines.reduce((sum, line) => sum + line.bundles, 0)) },
                ]}
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
