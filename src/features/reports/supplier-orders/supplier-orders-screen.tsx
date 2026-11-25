import { ChevronRight } from "lucide-react";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { KpiCard, KpiRow } from "@/components/shared/cards";
import { EmptyState } from "@/components/shared/states";
import { StatusPill } from "@/components/shared/status-pill";
import type { CurrencyTotals, SupplierOrdersResponse } from "@/lib/api/reports-types";
import { formatINR, formatMoneyList, formatNumber } from "@/lib/formatters";

import { dollarCostTotalText } from "../dollar-cost";
import { OrderReportsFilters } from "../order-reports/order-reports-filters";
import { orderReportsFilterLabel } from "../order-reports/params";
import { ReportDownload } from "../report-actions";
import { Footnote } from "../report-screens";
import type { SupplierOrdersPage } from "./queries";
import { supplierOrdersFile } from "./supplier-orders-file";
import { SupplierOrdersTable } from "./supplier-orders-table";

// Supplier order details (RPT-S1, owner request of 2026-11-24): the Order reports filters, the KPI tiles, then one
// collapsible card per supplier (by name) with its totals in the summary line and its orders in full below. The files
// hold what the page shows. No reference screenshot: the Reports frame of the Order reports page.

const plural = (count: number, noun: string) => `${formatNumber(count)} ${noun}${count === 1 ? "" : "s"}`;
/** One amount per order currency ("¥5,800 · $200"), never added together. */
const each = (totals: CurrencyTotals[], pick: (total: CurrencyTotals) => number) => formatMoneyList(totals.map((total) => ({ currency: total.currency, amount: pick(total) })));

export function SupplierOrdersScreen({ page, linkPos }: { page: SupplierOrdersPage; linkPos: boolean }) {
  const { data, today } = page;
  const { summary } = data;
  const label = orderReportsFilterLabel(data.filter);
  const currencies = data.suppliers.flatMap((group) => group.rows.map((row) => row.currency));
  return (
    <>
      <PageHeader
        title="Supplier order details"
        parent={{ label: "Reports", href: `/reports${page.query}` }}
        titleAddon={label ? <StatusPill tone="neutral">{label}</StatusPill> : undefined}
        actions={<ReportDownload file={supplierOrdersFile(data, today)} />}
      />
      <PageContainer>
        <OrderReportsFilters options={data.options} currencies={currencies} />
        <KpiRow gap="sm" className="md:grid-flow-row lg:grid-flow-col">
          <KpiCard size="xs" label="Suppliers" value={formatNumber(summary.suppliers)} sub={`${plural(summary.orders, "order")}${label ? " matching the filters" : ""}`} />
          <KpiCard size="xs" label="Order value (received)" value={each(summary.byCurrency, (t) => t.orderValueCny)} sub={`PO value ${each(summary.byCurrency, (t) => t.poValueCny)}`} />
          <KpiCard
            size="xs"
            label="Dollar cost"
            value={summary.dollarCost.usd === null ? "–" : dollarCostTotalText(summary.dollarCost)}
            sub={summary.dollarCost.usd === null ? dollarCostTotalText(summary.dollarCost) : "order value in USD"}
          />
          <KpiCard size="xs" label="Outstanding" value={each(summary.byCurrency, (t) => t.outstandingCny)} sub={`paid (settled) ${each(summary.byCurrency, (t) => t.settledCny)}`} />
          <KpiCard size="xs" label="Landed cost" value={formatINR(summary.landedCostInr)} sub="orders with a cost so far" />
        </KpiRow>
        {data.suppliers.length ? (
          <div className="flex flex-col gap-4">
            {data.suppliers.map((group) => (
              <SupplierGroup key={group.supplier.id} group={group} today={today} linkPos={linkPos} />
            ))}
          </div>
        ) : (
          <EmptyState title="No orders match these filters." description="Suppliers with no matching order are not listed." />
        )}
        <Footnote>
          Order value is the received quantity × rate; PO value the ordered quantity × rate. Paid (settled) and outstanding come from the supplier ledger:
          each supplier&apos;s payments settle its orders oldest first. Dollar Cost is the order value in USD: an order in another currency at the two rates saved when it was placed (its INR rate and the USD
          rate of that day); one with no USD rate saved shows &quot;No USD rate saved&quot; and adds to no total; today&apos;s rate is never used. Landed cost is
          the order&apos;s share so far, final or estimate. A held account&apos;s orders (pending review) count in no total.
        </Footnote>
      </PageContainer>
    </>
  );
}

/** A supplier's card: name, order count and its totals on the summary line (click to fold), its orders below. */
function SupplierGroup({ group, today, linkPos }: { group: SupplierOrdersResponse["suppliers"][number]; today: string; linkPos: boolean }) {
  const figure = (label: string, value: string) => (
    <span className="flex flex-col">
      <span className="text-[11.5px] leading-4 font-bold tracking-[0.06em] text-muted-foreground uppercase">{label}</span>
      <span className="text-[13.5px] leading-5 font-bold text-label">{value}</span>
    </span>
  );
  return (
    <details open className="group/supplier rounded-xl border bg-card">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-6 gap-y-2 px-[18px] py-[13px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-open/supplier:rotate-90" />
          <h2 className="text-[16.5px] leading-6 font-bold">{group.supplier.name}</h2>
          <span className="text-[13.5px] whitespace-nowrap text-muted-foreground">{plural(group.orders, "order")}</span>
        </span>
        <span className="flex flex-wrap gap-x-6 gap-y-2 md:ml-auto">
          {figure("Order value", each(group.byCurrency, (t) => t.orderValueCny))}
          {figure("Dollar cost", dollarCostTotalText(group.dollarCost))}
          {figure("Paid (settled)", each(group.byCurrency, (t) => t.settledCny))}
          {figure("Outstanding", each(group.byCurrency, (t) => t.outstandingCny))}
          {figure("Landed cost", formatINR(group.landedCostInr))}
        </span>
      </summary>
      <div className="border-t">
        <SupplierOrdersTable rows={group.rows} today={today} linkPos={linkPos} supplier={group.supplier.name} />
      </div>
    </details>
  );
}
