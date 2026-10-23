import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { BarChart } from "@/components/shared/bar-chart";
import { Callout, CardLink, CardNote, KpiCard, KpiRow, SectionCard, TodayPill } from "@/components/shared/cards";
import { KeyValueList } from "@/components/shared/key-value-list";
import { LegendSwatch, ProgressBar, StackedBar } from "@/components/shared/progress";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { StatusPill, TermsBadge } from "@/components/shared/status-pill";
import { Journey, Timeline } from "@/components/shared/timeline";
import { formatINR, formatLakh } from "@/lib/formatters";

import { previewDeliveries, previewDeliveriesPerDay, previewOrders, previewStages } from "./preview-data";
import { DeliveriesTable, DialogPreview, FormKitPreview, HeaderActions, OrdersPreview } from "./preview-sections";

export const metadata: Metadata = { title: "Component preview" };

// Orchestrator-owned living reference for the shared components and tokens (docs/component-contract.md).
// Not a product screen and not in the navigation.
export default function PreviewPage() {
  const maxStage = Math.max(...previewStages.map((s) => s.value));
  return (
    <>
      <PageHeader title="Component preview" actions={<><HeaderActions /><TodayPill /></>} />
      <PageContainer>
        <KpiRow>
          <KpiCard label="Active orders" value="50" sub="across 6 stages" />
          <KpiCard label="Due in next 7 days" value="8" sub="from 5 suppliers" />
          <KpiCard label="Late deliveries" value="3" sub="need follow-up" tone="danger" />
          <KpiCard label="Containers on the way" value="6" sub="2 arriving this week" />
          <KpiCard label="Payments due (INR)" value={formatLakh(4260000)} sub="next 30 days" />
        </KpiRow>

        <div className="grid gap-(--page-gap) lg:grid-cols-2">
          <SectionCard title="Orders by stage" aside={<CardLink href="/orders">View all orders</CardLink>}>
            <ul className="flex flex-col gap-[22px]">
              {previewStages.map((stage) => (
                <li key={stage.label} className="grid grid-cols-[180px_1fr_40px] items-center gap-4 text-[15px]">
                  <span>{stage.label}</span>
                  <ProgressBar value={stage.value} max={maxStage} label={stage.label} />
                  <span className="text-right font-bold">{stage.value}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
          <SectionCard title="Late and upcoming deliveries" aside={<CardLink href="/calendar">Open calendar</CardLink>}>
            <DeliveriesTable rows={previewDeliveries} />
          </SectionCard>
        </div>

        <SectionCard title="Filters, list table, stage progress, totals, selection, pagination">
          <OrdersPreview rows={previewOrders} />
        </SectionCard>

        <div className="grid gap-(--page-gap) lg:grid-cols-3">
          <SectionCard title="Money">
            <KeyValueList
              items={[
                { label: "Goods, paid ¥80,000", value: formatINR(980000) },
                { label: "Duty, taxes and clearing", value: formatINR(370500) },
                { label: "Transport in India", value: formatINR(26500) },
              ]}
              total={{ label: "Landed cost", value: formatINR(1377000) }}
            />
          </SectionCard>
          <SectionCard title="Clearing progress">
            <Timeline
              items={[
                { title: "Arrived at port", detail: "28 Sep", marker: "check" },
                { title: "Duty calculated", detail: "30 Sep · ₹3,70,500", marker: "check" },
                { title: "Duty paid", detail: "Waiting", marker: "current", number: 4 },
                { title: "Cleared from port", marker: "pending", number: 5 },
              ]}
            />
          </SectionCard>
          <SectionCard title="Where the money goes" aside={<CardNote>Management only</CardNote>}>
            <StackedBar
              segments={[
                { label: "Goods", value: 980000, color: "chart-1" },
                { label: "Duty, taxes and clearing", value: 370500, color: "chart-2" },
                { label: "Transport in India", value: 26500, color: "chart-3" },
              ]}
            />
            <ul className="mt-4 flex flex-col gap-2 text-[15px]">
              <li className="flex items-center gap-2.5"><LegendSwatch color="chart-1" />Goods</li>
              <li className="flex items-center gap-2.5"><LegendSwatch color="chart-2" />Duty, taxes and clearing</li>
              <li className="flex items-center gap-2.5"><LegendSwatch color="chart-3" />Transport in India</li>
            </ul>
          </SectionCard>
        </div>

        <SectionCard title="Journey of this order">
          <Journey
            steps={[
              { title: "1. Order and deposit", lines: ["5 Aug", "¥70,000 deposit paid"], marker: "check" },
              { title: "2. Receiving in China", lines: ["26 Aug"], marker: "check" },
              { title: "3. Container loading", lines: ["9 Sep"], marker: "check" },
              { title: "4. Clearing in India", lines: ["1 Oct"], marker: "check" },
              { title: "5. Transport", lines: ["1 Oct"], marker: "check" },
              { title: "6. India warehouse", lines: ["3 Oct"], marker: "check" },
            ]}
          />
        </SectionCard>

        <div className="grid gap-(--page-gap) lg:grid-cols-2">
          <SectionCard title="Container CAIU 2298076">
            <div className="mb-4 flex items-center gap-3">
              <TermsBadge terms="CNF" size="md" />
              <TermsBadge terms="FOB" />
            </div>
            <Journey
              align="edges"
              steps={[
                { title: "Guangzhou (Nansha)", lines: ["Loaded 9 Sep"], marker: "dot" },
                { title: "On the sea", lines: ["Sailed 12 Sep"], marker: "dot" },
                { title: "Kochi port", lines: ["Arrived 28 Sep"], marker: "dot" },
              ]}
            />
          </SectionCard>
          <SectionCard title="Deliveries per day" aside={<CardNote>next 7 days</CardNote>}>
            <BarChart data={previewDeliveriesPerDay} label="Deliveries due per day, next 7 days" className="h-48" />
          </SectionCard>
        </div>

        <div className="grid gap-(--page-gap) lg:grid-cols-2">
          <SectionCard title="Status pills and callouts">
            <div className="mb-4 flex flex-wrap gap-2">
              <StatusPill tone="danger">Late 4 days</StatusPill>
              <StatusPill tone="warning">Due in 1 day</StatusPill>
              <StatusPill tone="success">On track</StatusPill>
              <StatusPill tone="info">In clearing</StatusPill>
              <StatusPill tone="purple">Management</StatusPill>
              <StatusPill tone="neutral">Management only</StatusPill>
            </div>
            <div className="flex flex-col gap-3">
              <Callout>Each payment is changed to INR at the rate on the day it was paid.</Callout>
              <Callout tone="success">✓ 50 bundles loaded = 50 bundles received</Callout>
              <Callout tone="warning">
                <strong>Late from before this week:</strong> PO-2041 Guangzhou Textile Co. (due 26 Sep, 4 days late)
              </Callout>
            </div>
          </SectionCard>
          <SectionCard title="Dialog and prototype action (D5)">
            <DialogPreview />
          </SectionCard>
        </div>

        <SectionCard title="Form kit">
          <FormKitPreview />
        </SectionCard>

        <div className="grid gap-(--page-gap) lg:grid-cols-3">
          <SectionCard title="Loading state"><LoadingState /></SectionCard>
          <SectionCard title="Empty state"><EmptyState description="No orders match this view." /></SectionCard>
          <SectionCard title="Error state"><ErrorState /></SectionCard>
        </div>
      </PageContainer>
    </>
  );
}
