import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { CardLink, KpiCard, KpiRow, SectionCard, TodayPill } from "@/components/shared/cards";
import { ProgressBar } from "@/components/shared/progress";
import { formatLakh } from "@/lib/formatters";
import { STAGES } from "@/types/domain";

import type { DashboardData } from "./data/queries";
import { DashboardSearch } from "./dashboard-search";
import { ContainersTable, DeliveriesTable, PaymentsDueTable } from "./dashboard-tables";

/** Management dashboard (04_2_Dashboard.jpeg): KPI row and a 2 × 2 grid of cards filling the viewport. */
export function DashboardScreen({ data }: { data: DashboardData }) {
  const { kpis, ordersByStage } = data;
  const maxCount = Math.max(...ordersByStage.map((s) => s.count));

  return (
    <>
      <PageHeader
        title="Dashboard"
        actions={
          <>
            <DashboardSearch />
            <TodayPill size="sm" />
          </>
        }
      />
      <PageContainer className="pb-[28px]">
        <KpiRow gap="sm">
          <KpiCard size="sm" label="Active orders" value={kpis.activeOrders} sub={`across ${kpis.stageCount} stages`} />
          <KpiCard size="sm" label="Due in next 7 days" value={kpis.dueNext7Days} sub={`from ${kpis.dueSupplierCount} suppliers`} />
          <KpiCard size="sm" label="Late deliveries" value={kpis.lateDeliveries} sub="need follow-up" tone="danger" />
          <KpiCard
            size="sm"
            label="Containers on the way"
            value={kpis.containersOnTheWay}
            sub={`${kpis.containersArrivingThisWeek} arriving this week`}
          />
          <KpiCard size="sm" label="Payments due (INR)" value={formatLakh(kpis.paymentsDue)} sub={`next ${kpis.paymentsWindowDays} days`} />
        </KpiRow>

        <div className="grid grid-cols-1 gap-(--page-gap) lg:flex-1 lg:grid-cols-2 lg:grid-rows-[1fr_1fr]">
          <SectionCard
            title="Orders by stage"
            titleGap="none"
            aside={<CardLink size="sm" href="/orders">View all orders</CardLink>}
          >
            <ul className="mt-[11px] flex flex-col gap-[11px]">
              {ordersByStage.map(({ stage, count }) => {
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
          </SectionCard>
          <SectionCard
            title="Late and upcoming deliveries"
            titleGap="none"
            aside={data.links.calendar ? <CardLink size="sm" href="/calendar">Open calendar</CardLink> : null}
          >
            <DeliveriesTable rows={data.deliveries} />
          </SectionCard>
          <SectionCard title="Payments due" titleGap="none" aside={data.links.payments ? <CardLink size="sm" href="/payments">All payments</CardLink> : null}>
            <PaymentsDueTable rows={data.paymentsDue} />
          </SectionCard>
          <SectionCard
            title="Containers on the way"
            titleGap="none"
            aside={data.links.containers ? <CardLink size="sm" href="/containers">All containers</CardLink> : null}
          >
            <ContainersTable rows={data.containersOnTheWay} />
          </SectionCard>
        </div>
      </PageContainer>
    </>
  );
}
