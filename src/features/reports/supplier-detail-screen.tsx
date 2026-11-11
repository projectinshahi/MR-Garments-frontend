import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { KpiCard, KpiRow, SectionCard } from "@/components/shared/cards";
import { KeyValueList } from "@/components/shared/key-value-list";
import { StatusPill } from "@/components/shared/status-pill";
import { CURRENCY_NAME, formatDateTime, formatINR, formatMoneyList, formatNumber, rateText } from "@/lib/formatters";

import { filterLabel } from "./data/filters";
import type { SupplierDetailPage, SupplierPaymentDetail } from "./data/queries";
import { CardSubtitle, Footnote } from "./report-screens";
import {
  DetailUrlProvider,
  OrderStageFilter,
  PaymentDateFilter,
  SupplierLinesList,
  SupplierOrdersList,
  SupplierPaymentsList,
} from "./supplier-detail-tables";

// Payments per supplier, one supplier (RPT-5D, docs/supplier-payment-detail-contract.md). Not in the references: built
// from the Reports parts (header with the period pill, xs KPI tiles, cards with bordered tables, footnote).

type Totals = SupplierPaymentDetail["summary"]["byCurrency"][number];

const plural = (count: number, noun: string) => `${formatNumber(count)} ${noun}${count === 1 ? "" : "s"}`;
const orDash = (value: string) => value.trim() || "–";

/**
 * `parent` and `base`: the Suppliers page shows the same detail as its View action (/suppliers/<id>, back to the
 * Suppliers list) with its own header `actions`; the report leaves them out.
 */
export function SupplierDetailScreen({
  page,
  linkPos,
  parent,
  base,
  actions,
}: {
  page: SupplierDetailPage;
  linkPos: boolean;
  parent?: { label: string; href: string };
  base?: string;
  actions?: React.ReactNode;
}) {
  const { data } = page;
  const { supplier, summary } = data;
  const params = new URLSearchParams(page.search);
  const period = filterLabel({ from: data.filter.from, supplier: null });
  // One amount per order currency ("¥5,800 · $200"), never added together; INR amounts add up.
  const each = (pick: (total: Totals) => number) =>
    formatMoneyList(summary.byCurrency.map((total) => ({ currency: total.currency, amount: pick(total) })), {}, supplier.currency);
  const paidInr = summary.byCurrency.reduce((sum, total) => sum + total.paidInr, 0);
  const inPeriod = period ? " in this period" : "";

  const details = [
    { label: "Name", value: supplier.name },
    { label: "Supplier code", value: orDash(supplier.code) },
    { label: "Supplier ID", value: <span className="break-all">{supplier.id}</span> },
    { label: "Country", value: orDash(supplier.country) },
    { label: "Contact person", value: orDash(supplier.contactPerson) },
    { label: "Email", value: orDash(supplier.email) },
    { label: "Phone", value: orDash(supplier.phone) },
    { label: "Address", value: orDash(supplier.address) },
    { label: "City", value: orDash(supplier.city) },
    { label: "State / Province", value: orDash(supplier.state) },
    { label: "Postal code", value: orDash(supplier.postalCode) },
    { label: "Payment terms", value: orDash(supplier.paymentTerms) },
    // Currency information (docs/supplier-currency.md): the one currency of new orders and deposits, and its INR rate now.
    { label: "Preferred currency", value: CURRENCY_NAME[supplier.currency] },
    { label: "Exchange rate", value: supplier.exchangeRate === null ? <span className="text-muted-foreground">Not set</span> : rateText(supplier.currency, supplier.exchangeRate) },
    { label: "Rate last updated", value: supplier.rateUpdatedAt ? formatDateTime(supplier.rateUpdatedAt) : "–" },
    { label: "INR equivalent", value: supplier.currency === "INR" ? "Amounts are in INR already." : "Amount × rate. Each order, payment and deposit keeps the rate saved on it." },
    { label: "Tax / registration number", value: orDash(supplier.taxNumber) },
    { label: "Notes", value: orDash(supplier.notes) },
    { label: "Status", value: <StatusPill tone={supplier.status === "Active" ? "success" : "neutral"}>{supplier.status}</StatusPill> },
  ];
  const half = Math.ceil(details.length / 2);

  return (
    <>
      <PageHeader
        title={supplier.name}
        parent={parent ?? { label: "Payments per supplier", href: `/reports/payments-per-supplier${page.query}` }}
        titleAddon={period ? <StatusPill tone="neutral">{period}</StatusPill> : undefined}
        actions={actions}
      />
      <PageContainer>
        <SectionCard title="Supplier overview">
          <div className="grid gap-x-10 lg:grid-cols-2">
            <KeyValueList boldValues items={details.slice(0, half)} />
            <KeyValueList boldValues items={details.slice(half)} className="border-t border-border-subtle lg:border-t-0" />
          </div>
        </SectionCard>
        <KpiRow gap="sm">
          <KpiCard size="xs" label="Orders" value={formatNumber(summary.orders)} sub={`${formatNumber(summary.openOrders)} open`} />
          <KpiCard size="xs" label="Payment transactions" value={formatNumber(summary.payments)} sub="paid and due" />
          <KpiCard size="xs" label="Line items" value={formatNumber(summary.lineItems)} sub={plural(summary.products, "product")} />
        </KpiRow>
        {/* Stacked until lg: three side by side at 768 px leave ~106 px per value, and "¥12,51,66,500 · $12,34,500"
            pushed the page sideways. */}
        <KpiRow gap="sm" className="md:grid-flow-row lg:grid-flow-col">
          <KpiCard size="xs" label="Order value" value={each((t) => t.orderValueCny)} sub="all stages" />
          <KpiCard
            size="xs"
            label="Paid so far"
            value={each((t) => t.paidCny)}
            sub={
              <>
                of which deposits {each((t) => t.depositsCny)}
                <br />
                {formatINR(paidInr)} at payment-day rates
              </>
            }
          />
          <KpiCard size="xs" label="Balance to pay" value={each((t) => t.balanceCny)} sub="order value less paid" />
        </KpiRow>

        <DetailUrlProvider base={base ?? `/reports/payments-per-supplier/${supplier.id}`} search={page.search}>
          <SectionCard title="Payments" titleGap="none" className="min-w-0">
            <CardSubtitle>Payments to the supplier on these orders, newest first</CardSubtitle>
            <div className="mt-3 flex flex-col gap-3">
              <PaymentDateFilter />
              <SupplierPaymentsList
                list={data.payments}
                linkPos={linkPos}
                empty={params.has("paymentFrom") || params.has("paymentTo") ? "No payments in these dates." : `No payments${inPeriod || " yet"}.`}
              />
            </div>
          </SectionCard>
          <SectionCard title="Orders" titleGap="none" className="min-w-0">
            <CardSubtitle>Every order{inPeriod}, finished ones too, newest first</CardSubtitle>
            <div className="mt-3 flex flex-col gap-3">
              <div>
                <OrderStageFilter />
              </div>
              <SupplierOrdersList
                list={data.orders}
                linkPos={linkPos}
                today={page.today}
                empty={params.has("stage") && summary.orders > 0 ? "No orders at this stage." : `No orders${inPeriod || " yet"}.`}
              />
            </div>
          </SectionCard>
          <div className="flex min-w-0 flex-col gap-2">
            <SectionCard title="Products" titleGap="none" className="min-w-0">
              <div className="mt-3">
                <SupplierLinesList list={data.lines} linkPos={linkPos} empty={`No order lines${inPeriod || " yet"}.`} />
              </div>
            </SectionCard>
            <Footnote>One row per order line: the same product in several orders stays on separate rows.</Footnote>
          </div>
        </DetailUrlProvider>

        <Footnote>
          Supplier payments only: payments to shipping agents (sea freight) on these orders are not included. Every order is
          counted here, finished ones too; the Payments per supplier report counts open orders only.
        </Footnote>
      </PageContainer>
    </>
  );
}
