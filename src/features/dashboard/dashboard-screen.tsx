import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { CardLink, KpiCard, KpiRow, SectionCard, TodayPill } from "@/components/shared/cards";
import { ProgressBar } from "@/components/shared/progress";
import { formatCNY } from "@/lib/formatters";
import { STAGES } from "@/types/domain";

import type { DashboardData } from "./data/queries";
import { isAvailable, type Source } from "./dashboard-logic";
import { DashboardSearch } from "./dashboard-search";
import { ContainersTable, DeliveriesTable, PaymentsDueTable, Unavailable } from "./dashboard-tables";

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

/** A KPI from a source the user can't see, or that failed to load: "–" and why (proposed wording). */
const missing = (source: "denied" | "failed") => ({ value: "–", sub: source === "denied" ? "not in your access" : "couldn't load" });
const kpi = <T,>(source: Source<T>, show: (value: T) => { value: React.ReactNode; sub: string }) =>
  isAvailable(source) ? show(source) : missing(source);

/** Management dashboard (04_2_Dashboard.jpeg): KPI row and a 2 × 2 grid of cards filling the viewport. */
export function DashboardScreen({ data }: { data: DashboardData }) {
  const { orders, deliveries, paymentsDue, containers } = data;
  const maxCount = isAvailable(orders) ? Math.max(1, ...orders.byStage.map((s) => s.count)) : 1;

  return (
    <>
      <PageHeader
        title="Dashboard"
        actions={
          <>
            <DashboardSearch />
            <TodayPill size="sm" today={data.today} />
          </>
        }
      />
      <PageContainer className="pb-[28px]">
        <KpiRow gap="sm">
          <KpiCard size="sm" label="Active orders" {...kpi(orders, (o) => ({ value: o.active, sub: `across ${plural(o.stages, "stage")}` }))} />
          <KpiCard
            size="sm"
            label="Due in next 7 days"
            {...kpi(deliveries, (d) => ({ value: d.dueNext7, sub: `from ${plural(d.dueSuppliers, "supplier")}` }))}
          />
          <KpiCard size="sm" label="Late deliveries" tone="danger" {...kpi(deliveries, (d) => ({ value: d.late, sub: "need follow-up" }))} />
          <KpiCard
            size="sm"
            label="Containers on the way"
            {...kpi(containers, (c) => ({ value: c.onTheWay, sub: `${c.arrivingThisWeek} arriving this week` }))}
          />
          {/* The reference shows INR; due payments carry no exchange rate until paid, so the API has CNY only. */}
          <KpiCard
            size="sm"
            label="Payments due (CNY)"
            {...kpi(paymentsDue, (p) => ({ value: formatCNY(p.amountCny), sub: `next ${p.windowDays} days` }))}
          />
        </KpiRow>

        <div className="grid grid-cols-1 gap-(--page-gap) lg:flex-1 lg:grid-cols-2 lg:grid-rows-[1fr_1fr]">
          <SectionCard
            title="Orders by stage"
            titleGap="none"
            aside={<CardLink size="sm" href="/orders">View all orders</CardLink>}
          >
            {isAvailable(orders) ? (
              <ul className="mt-[11px] flex flex-col gap-[11px]">
                {orders.byStage.map(({ stage, count }) => {
                  const label = `${stage}. ${STAGES[stage - 1]}`;
                  return (
                    <li key={stage} className="grid h-[18px] grid-cols-[184px_1fr_46px] items-center text-sm">
                      <span>{label}</span>
                      <ProgressBar value={count} max={maxCount} label={label} />
                      <span className="text-right font-bold">{count}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Unavailable source={orders} />
            )}
          </SectionCard>
          <SectionCard
            title="Late and upcoming deliveries"
            titleGap="none"
            aside={data.links.calendar ? <CardLink size="sm" href="/calendar">Open calendar</CardLink> : null}
          >
            {isAvailable(deliveries) ? <DeliveriesTable rows={deliveries.rows} /> : <Unavailable source={deliveries} />}
          </SectionCard>
          <SectionCard title="Payments due" titleGap="none" aside={data.links.payments ? <CardLink size="sm" href="/payments">All payments</CardLink> : null}>
            {isAvailable(paymentsDue) ? <PaymentsDueTable rows={paymentsDue.rows} /> : <Unavailable source={paymentsDue} />}
          </SectionCard>
          <SectionCard
            title="Containers on the way"
            titleGap="none"
            aside={data.links.containers ? <CardLink size="sm" href="/containers">All containers</CardLink> : null}
          >
            {isAvailable(containers) ? <ContainersTable rows={containers.rows} /> : <Unavailable source={containers} />}
          </SectionCard>
        </div>
      </PageContainer>
    </>
  );
}
