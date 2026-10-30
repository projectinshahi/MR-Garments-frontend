import Link from "next/link";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Callout, SectionCard } from "@/components/shared/cards";
import { EmptyState } from "@/components/shared/states";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { formatCNY, formatINR, formatNumber } from "@/lib/formatters";

import type { ReportsHubData, ReportsSummary } from "./data/queries";
import { CardDownloads, UrlSelect } from "./report-actions";
import type { ReportName } from "./report-files";

const plural = (count: number, noun: string) => `${formatNumber(count)} ${noun}${count === 1 ? "" : "s"}`;

type ReportCard = { category: string; title: string; description: string; name: ReportName; stat: (s: ReportsSummary) => string };

// The six cards of 32_13_Reports.jpeg; the stat strip of each comes from GET /reports/summary with the hub's filters.
// Open report, Excel and PDF all carry those filters (a card's file is its report as Open report shows it).
const CARDS: ReportCard[] = [
  {
    category: "Orders",
    title: "Order status",
    description: "See which of the six stages every order is in.",
    name: "order-status",
    stat: (s) => `${plural(s.orders.total, "order")} · ${formatNumber(s.orders.atStage1)} waiting at stage 1`,
  },
  {
    category: "Deliveries",
    title: "Deliveries due by date",
    description: "What is due each day, with late ones marked in red.",
    name: "deliveries-per-day",
    stat: (s) => `${formatNumber(s.deliveries.dueNext7)} due in next 7 days · ${formatNumber(s.deliveries.late)} late`,
  },
  {
    category: "Receiving",
    title: "Ordered against received",
    description: "Shortages and remarks for every order received in China.",
    name: "ordered-vs-received",
    stat: ({ receiving: r }) =>
      [`${plural(r.shortOrders, "order")} short`, `${formatNumber(r.shortPcs)} pcs missing`, ...(r.shortM ? [`${formatNumber(r.shortM)} m missing`] : [])].join(" · "),
  },
  {
    category: "Shipping",
    title: "Containers and arrival dates",
    description: "What is inside each container, its agent and when it arrives.",
    name: "containers-timeline",
    stat: (s) => `${formatNumber(s.containers.onTheWay)} on the way · ${formatNumber(s.containers.arrivingIn7Days)} arrive this week`,
  },
  {
    category: "Payments",
    title: "Payments and balance due",
    description: "Paid and due amounts for each supplier, in INR.",
    name: "payments-per-supplier",
    // Due payments have no exchange rate yet, so the amount stays in yuan.
    stat: (s) => `${formatCNY(s.payments.dueNext30Cny)} due in next 30 days`,
  },
  {
    category: "Cost",
    title: "Landed cost",
    description: "Final cost per item, per order and per team.",
    name: "landed-cost-by-month",
    stat: (s) => `${plural(s.landedCost.finishedOrders, "order")} finished · ${formatINR(s.landedCost.finishedTotalInr)}`,
  },
];

/** Reports hub (32_13_Reports.jpeg): six report cards, recent downloads (none are kept) and the access note. */
export function ReportsHub({ data }: { data: ReportsHubData }) {
  const { summary, query } = data;
  const suppliers = [{ value: "all", label: "All suppliers" }, ...summary.suppliers.map((s) => ({ value: s.id, label: s.name }))];
  return (
    <>
      <PageHeader
        title="Reports"
        titleAddon={<StatusPill tone="neutral">Management only</StatusPill>}
        actions={
          <>
            <UrlSelect param="period" size="sm" showLabel label="Period" options={data.periods} className="h-[37px]" />
            <UrlSelect param="supplier" size="sm" label="Supplier" options={suppliers} className="h-[37px]" />
          </>
        }
      />
      <PageContainer>
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CARDS.map((card) => (
            <ReportCardItem key={card.name} card={card} stat={card.stat(summary)} query={query} />
          ))}
        </ul>
        <SectionCard title="Recently downloaded" titleGap="none" className="px-[18px] pt-[13px] pb-[15.5px]">
          <EmptyState title="No downloads to show." description="Exports are saved straight to your computer and are not listed here." />
        </SectionCard>
        <Callout size="xs">
          Data-entry staff, the clearing and transport staff included, cannot open this page. They can only add and
          update their own stage.
        </Callout>
      </PageContainer>
    </>
  );
}

// Card geometry from the reference: 15 px top, a two-line description slot, the 35 px stat strip, 32.5 px buttons; 219.5 px in all (the reference rows measure 219 and 220).
function ReportCardItem({ card, stat, query }: { card: ReportCard; stat: string; query: string }) {
  return (
    <li className="flex flex-col rounded-xl border bg-card px-5 pt-[15px] pb-[19px]">
      <p className="text-[11.5px] leading-4 font-bold tracking-[0.12em] text-primary uppercase">{card.category}</p>
      <h2 className="mt-[2.5px] text-[17.5px] leading-6 font-bold">{card.title}</h2>
      <p className="mt-1 min-h-10 text-[13.5px] leading-5 text-muted-foreground">{card.description}</p>
      <p className="mt-[15px] flex h-[35px] items-center rounded-lg bg-background px-3 text-[13.5px] font-bold text-label">{stat}</p>
      {/* Accessible names add the report, so the six identical button rows stay distinguishable. */}
      <div className="mt-[14.5px] flex flex-wrap gap-2">
        <Button asChild size="sm" className="h-[32.5px] px-[15px] text-[13.5px]">
          <Link href={`/reports/${card.name}${query}`} aria-label={`Open report: ${card.title}`}>
            Open report
          </Link>
        </Button>
        <CardDownloads name={card.name} title={card.title} query={query} className="h-[32.5px] px-[11px] text-[13.5px] text-label" />
      </div>
    </li>
  );
}
