import { ClipboardList, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Callout, SectionCard } from "@/components/shared/cards";
import { EmptyState } from "@/components/shared/states";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { formatINR, formatMoneyList, formatNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";

import type { ReportsHubData, ReportsSummary } from "./data/queries";
import { OrderReportsDownloads } from "./order-reports/order-reports-downloads";
import { CardDownloads, UrlSelect } from "./report-actions";
import type { ReportName } from "./report-files";

const plural = (count: number, noun: string) => `${formatNumber(count)} ${noun}${count === 1 ? "" : "s"}`;

type ReportCard = { category: string; title: string; description: string; stat: (s: ReportsSummary) => string; /** Drawn beside the title; the whole card then opens the report. */ icon?: LucideIcon } & (
  | { name: ReportName }
  /** A report outside the GET /reports/<name> family, with its own download buttons. */
  | { href: string; Downloads: typeof OrderReportsDownloads }
);

// The Order Report card (RPT-O2 list and the per-PO report, docs/order-report.md) in the first slot, where the Order
// status card of 32_13_Reports.jpeg was (its report page stays at /reports/order-status), then the other five cards
// of the reference; the stat strip of each comes from GET /reports/summary with the hub's filters. Open report,
// Excel and PDF all carry those filters (a card's file is its report as Open report shows it).
const CARDS: ReportCard[] = [
  {
    category: "Orders",
    title: "Order Report",
    description: "View comprehensive purchase order reports, supplier details, item-wise breakdowns, payments, shipping, customs and landed costs.",
    icon: ClipboardList,
    href: "/reports/orders",
    Downloads: OrderReportsDownloads,
    stat: (s) => `${plural(s.orders.total, "order")} · ${formatNumber(s.orders.atStage1)} pending`,
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
    description: "Paid and due amounts for each supplier.",
    name: "payments-per-supplier",
    // Due payments have no exchange rate yet: each order currency apart, never added together (DEF-25: not INR).
    stat: (s) => `${formatMoneyList(s.payments.dueNext30ByCurrency)} due in next 30 days`,
  },
  {
    category: "Cost",
    title: "Landed cost",
    description: "Final cost per item, per order and per team.",
    name: "landed-cost-by-month",
    stat: (s) => `${plural(s.landedCost.finishedOrders, "order")} finished · ${formatINR(s.landedCost.finishedTotalInr)}`,
  },
];

/** Reports hub (32_13_Reports.jpeg): the report cards, recent downloads (none are kept) and the access note. */
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
            <ReportCardItem key={card.title} card={card} stat={card.stat(summary)} query={query} />
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
  const href = "name" in card ? `/reports/${card.name}` : card.href;
  const buttonClass = "h-[32.5px] px-[11px] text-[13.5px] text-label";
  const Icon = card.icon;
  return (
    // With an icon, the title's link stretches over the card (its ::after), so clicking anywhere opens the report; the
    // buttons sit above it. The card keeps the reference geometry: 15 px top, two-line description, stat strip, buttons.
    <li className={cn("flex flex-col rounded-xl border bg-card px-5 pt-[15px] pb-[19px]", Icon && "relative transition-colors hover:border-primary/40 has-[[data-cover]:focus-visible]:ring-3 has-[[data-cover]:focus-visible]:ring-ring/50")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11.5px] leading-4 font-bold tracking-[0.12em] text-primary uppercase">{card.category}</p>
          <h2 className="mt-[2.5px] text-[17.5px] leading-6 font-bold">
            {Icon ? (
              <Link href={`${href}${query}`} data-cover className="outline-none after:absolute after:inset-0 after:rounded-xl">
                {card.title}
              </Link>
            ) : (
              card.title
            )}
          </h2>
        </div>
        {Icon ? (
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-info-soft text-primary">
            <Icon className="size-[18px]" />
          </span>
        ) : null}
      </div>
      <p className="mt-1 min-h-10 text-[13.5px] leading-5 text-muted-foreground">{card.description}</p>
      <p className="mt-[15px] flex h-[35px] items-center rounded-lg bg-background px-3 text-[13.5px] font-bold text-label">{stat}</p>
      {/* Accessible names add the report, so the six identical button rows stay distinguishable. */}
      <div className="relative z-10 mt-[14.5px] flex flex-wrap gap-2">
        <Button asChild size="sm" className="h-[32.5px] px-[15px] text-[13.5px]">
          <Link href={`${href}${query}`} aria-label={`Open report: ${card.title}`}>
            Open report
          </Link>
        </Button>
        {"name" in card ? <CardDownloads name={card.name} title={card.title} query={query} className={buttonClass} /> : <card.Downloads query={query} className={buttonClass} />}
      </div>
    </li>
  );
}
