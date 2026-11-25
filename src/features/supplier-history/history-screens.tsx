import { PageContainer } from "@/components/layout/page-header";
import { KpiCard, KpiRow, SectionCard } from "@/components/shared/cards";
import { EmptyState } from "@/components/shared/states";
import { dollarCostTotalText } from "@/features/reports/dollar-cost";
import { STATUS_OPTIONS as ORDER_STATUS_OPTIONS } from "@/features/reports/order-reports/params";
import { Footnote } from "@/features/reports/report-screens";
import { DetailUrlProvider } from "@/features/reports/supplier-detail-tables";
import { DepositsArchive } from "@/features/supplier-ledger/deposits-archive";
import { slug } from "@/features/supplier-ledger/ledger-files";
import type { SupplierHistoryOverview } from "@/lib/api/supplier-history-types";
import { formatDate, formatINR, formatMoney, formatMoneyList, formatNumber } from "@/lib/formatters";
import type { Currency } from "@/types/domain";

import { HistoryDownload } from "./history-download";
import { HistoryFilters } from "./history-filters";
import { DERIVED_NOTE, HISTORY_NOTE, historyFilterLabel, historyQuery, STATUS_OPTIONS, TYPE_OPTIONS } from "./history-logic";
import { ArchiveAdvancesTable, HistoryEventsList, HistoryLandedCostList, HistoryOrdersList, HistoryPaymentsList, HistoryReceiptsList } from "./history-tables";
import type { getHistoryArchive, getHistoryEvents, getHistoryLandedCost, getHistoryOrders, getHistoryPayments, getHistoryReceipts } from "./queries";
import { LiveBalances, supplierHref } from "./supplier-frame";

// The supplier profile's history tabs (Supplier 360°, backend docs/supplier-history.md). Each tab is one server call;
// its filters and page live in the URL. Figures are the API's; nothing is added across currencies.

type PageOf<F extends (...args: never[]) => Promise<unknown>> = Awaited<ReturnType<F>>;
const each = (totals: { currency: Currency; amount: number }[]) => (totals.length ? formatMoneyList(totals) : "–");

/** The Overview's history card: live balances apart from the historical totals per currency. */
export function HistoryTotals({ overview }: { overview: SupplierHistoryOverview }) {
  const { totals, activity } = overview;
  return (
    <SectionCard title="Supplier history at a glance">
      <div className="flex flex-col gap-4">
        <LiveBalances overview={overview} />
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[720px] text-[13.5px]">
            <caption className="sr-only">Historical totals per currency</caption>
            <thead className="bg-muted/50 text-left text-[12px] text-muted-foreground uppercase">
              <tr>
                {["Currency", "Orders", "PO value", "Order value (received)", "Paid (settled)", "Outstanding", "Payments recorded", "Voided", "Adjustments"].map((h) => (
                  <th key={h} className="px-3 py-2 font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {totals.map((t) => (
                <tr key={t.currency} className="border-t">
                  <td className="px-3 py-2 font-bold">{t.held ? `${t.currency} (on hold)` : t.currency}</td>
                  <td className="px-3 py-2">{formatNumber(t.orders)}</td>
                  <td className="px-3 py-2">{formatMoney(t.poValue, t.currency, { decimals: 2 })}</td>
                  <td className="px-3 py-2">{formatMoney(t.orderValue, t.currency, { decimals: 2 })}</td>
                  <td className="px-3 py-2">{formatMoney(t.settled, t.currency, { decimals: 2 })}</td>
                  <td className="px-3 py-2">{formatMoney(t.outstanding, t.currency, { decimals: 2 })}</td>
                  <td className="px-3 py-2">{t.paymentsActive === null ? "–" : `${formatMoney(t.paymentsActive, t.currency, { decimals: 2 })} (${t.paymentsRecorded})`}</td>
                  <td className="px-3 py-2">{formatNumber(t.paymentsVoided)}</td>
                  <td className="px-3 py-2">{t.adjustments === null ? "–" : formatMoney(t.adjustments, t.currency, { decimals: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[13px] text-muted-foreground">
          {`Activity ${activity.first ? formatDate(activity.first) : "–"} to ${activity.last ? formatDate(activity.last) : "–"} · Dollar Cost ${dollarCostTotalText(overview.dollarCost)} · Landed cost so far ${formatINR(overview.landedCostInr)}. Payments recorded are less their voids; a voided payment counts in no total. Totals are history; the balance above is the ledger now.`}
        </p>
      </div>
    </SectionCard>
  );
}

export function HistoryOrdersScreen({ id, page, linkPos }: { id: string; page: PageOf<typeof getHistoryOrders>; linkPos: boolean }) {
  const { data, search, today } = page;
  return (
    <DetailUrlProvider base={supplierHref(id, "/orders")} search={search}>
      <PageContainer>
        <HistoryFilters searchLabel="PO" placeholder="Any part of it" selects={[{ param: "status", label: "Order status", options: ORDER_STATUS_OPTIONS }]} />
        <KpiRow gap="sm">
          <KpiCard size="xs" label="Orders" value={formatNumber(data.orders.total)} sub="matching the filters" />
          <KpiCard size="xs" label="Order value (received)" value={each(data.byCurrency.map((t) => ({ currency: t.currency, amount: t.orderValueCny })))} sub={`PO value ${each(data.byCurrency.map((t) => ({ currency: t.currency, amount: t.poValueCny })))}`} />
          <KpiCard size="xs" label="Outstanding" value={each(data.byCurrency.map((t) => ({ currency: t.currency, amount: t.outstandingCny })))} sub={`paid (settled) ${each(data.byCurrency.map((t) => ({ currency: t.currency, amount: t.settledCny })))}`} />
          <KpiCard size="xs" label="Dollar Cost" value={data.dollarCost.usd === null ? "–" : dollarCostTotalText(data.dollarCost)} sub={data.dollarCost.usd === null ? dollarCostTotalText(data.dollarCost) : "order value in USD"} />
        </KpiRow>
        <SectionCard title="Orders" titleGap="none" className="min-w-0">
          <HistoryOrdersList list={data.orders} today={today} linkPos={linkPos} />
        </SectionCard>
        <Footnote>Order value is the received quantity × rate (India warehouse quantities never count); PO value the ordered quantity × rate. Paid (settled) and outstanding are the ledger&apos;s live FIFO settlement. Each PO opens the order and its full report.</Footnote>
      </PageContainer>
    </DetailUrlProvider>
  );
}

export function HistoryPaymentsScreen({ id, page, linkPos }: { id: string; page: PageOf<typeof getHistoryPayments>; linkPos: boolean }) {
  const { data, search } = page;
  return (
    <DetailUrlProvider base={supplierHref(id, "/payments")} search={search}>
      <PageContainer>
        <HistoryFilters
          searchLabel="Reference"
          placeholder="Reference, PO or mode"
          selects={[{ param: "status", label: "Payment status", options: [{ value: "all", label: "All payments" }, { value: "active", label: "Active" }, { value: "voided", label: "Voided" }] }]}
        />
        <KpiRow gap="sm">
          <KpiCard size="xs" label="Payments recorded" value={each(data.totals.map((t) => ({ currency: t.currency, amount: t.active })))} sub="less their voids; matching the filters" />
          <KpiCard size="xs" label="Active payments" value={formatNumber(data.totals.reduce((n, t) => n + t.count, 0))} sub="in no held account" />
          <KpiCard size="xs" label="Voided" value={formatNumber(data.totals.reduce((n, t) => n + t.voided, 0))} sub="listed, counted in no total" />
        </KpiRow>
        <SectionCard title="Payments" titleGap="none" className="min-w-0">
          <HistoryPaymentsList list={data.payments} linkPos={linkPos} />
        </SectionCard>
        <Footnote>{`${DERIVED_NOTE} Sea-freight (agent) payments are in Landed cost: they are never the supplier's money.`}</Footnote>
      </PageContainer>
    </DetailUrlProvider>
  );
}

export function HistoryReceiptsScreen({ id, page, linkPos }: { id: string; page: PageOf<typeof getHistoryReceipts>; linkPos: boolean }) {
  const { data, search } = page;
  return (
    <DetailUrlProvider base={supplierHref(id, "/receiving")} search={search}>
      <PageContainer>
        <HistoryFilters searchLabel="Search" placeholder="PO, delivery note, received by" />
        <KpiRow gap="sm">
          <KpiCard size="xs" label="Goods receipts (China)" value={formatNumber(data.receipts.total)} sub="matching the filters" />
        </KpiRow>
        <SectionCard title="Goods receiving" titleGap="none" className="min-w-0">
          <HistoryReceiptsList list={data.receipts} linkPos={linkPos} />
        </SectionCard>
        <Footnote>Recorded by is the user who entered the receipt (the order page shows the same person as Received by). A deleted receipt is not stored anywhere, so it is not listed: its value change stays in Activity.</Footnote>
      </PageContainer>
    </DetailUrlProvider>
  );
}

export function HistoryLandedCostScreen({ id, page, linkPos }: { id: string; page: PageOf<typeof getHistoryLandedCost>; linkPos: boolean }) {
  const { data, search } = page;
  return (
    <DetailUrlProvider base={supplierHref(id, "/landed-cost")} search={search}>
      <PageContainer>
        <HistoryFilters
          searchLabel="PO"
          placeholder="Any part of it"
          selects={[{ param: "status", label: "Landed cost", options: [{ value: "all", label: "Any landed cost" }, { value: "final", label: "Final" }, { value: "estimate", label: "Estimate" }, { value: "none", label: "No cost yet" }] }]}
        />
        <KpiRow gap="sm">
          <KpiCard size="xs" label="Landed cost so far" value={formatINR(data.landedCostInr)} sub="orders not held" />
          <KpiCard size="xs" label="Sea-freight payments" value={formatNumber(data.agentPayments.count)} sub={`${formatNumber(data.agentPayments.voided)} voided · not in the supplier's ledger`} />
        </KpiRow>
        <SectionCard title="Landed cost" titleGap="none" className="min-w-0">
          <HistoryLandedCostList list={data.orders} linkPos={linkPos} />
        </SectionCard>
        <Footnote>Landed cost is the one calculation every report uses: goods at the settling payments&apos; rates, sea freight (FOB), and each order&apos;s share of its containers&apos; clearing and transport. The container charges shown are the container&apos;s own records, shared by every order in it.</Footnote>
      </PageContainer>
    </DetailUrlProvider>
  );
}

export function HistoryActivityScreen({ id, page, linkPos }: { id: string; page: PageOf<typeof getHistoryEvents>; linkPos: boolean }) {
  const { data, search, today } = page;
  const params = new URLSearchParams(search);
  const filters = historyFilterLabel({ supplier: data.supplier.name, from: params.get("from"), to: params.get("to"), types: params.get("type") ? [params.get("type") as never] : [], status: params.get("status"), q: params.get("q") });
  return (
    <DetailUrlProvider base={supplierHref(id, "/activity")} search={search}>
      <PageContainer>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <HistoryFilters searchLabel="Search" placeholder="PO, reference, container" selects={[{ param: "type", label: "Event type", options: TYPE_OPTIONS }, { param: "status", label: "Status", options: STATUS_OPTIONS }]} />
          <HistoryDownload
            apiPath={`/suppliers/${encodeURIComponent(id)}/history/events${historyQuery(params, { statuses: ["active", "voided", "held", "migrated"], events: true })}`}
            title={`Supplier history: ${data.supplier.name}`}
            filename={`supplier-history-${slug(data.supplier.name)}-${today}`}
            filters={filters ?? data.supplier.name}
            withSupplier={false}
          />
        </div>
        <KpiRow gap="sm">
          <KpiCard size="xs" label="Events" value={formatNumber(data.events.total)} sub="matching the filters" />
        </KpiRow>
        <SectionCard title="Activity" titleGap="none" className="min-w-0">
          <HistoryEventsList list={data.events} linkPos={linkPos} />
        </SectionCard>
        <Footnote>{HISTORY_NOTE}</Footnote>
      </PageContainer>
    </DetailUrlProvider>
  );
}

export function HistoryArchiveScreen({ archive }: { archive: PageOf<typeof getHistoryArchive> }) {
  const { advances, deposits } = archive;
  return (
    <PageContainer>
      <SectionCard title="Legacy supplier advances (archive)" titleGap="none" className="min-w-0">
        {advances === null ? (
          <EmptyState title="The advance archive could not be loaded." />
        ) : advances.entries.length === 0 ? (
          <EmptyState title="No legacy advances with this supplier." />
        ) : (
          <ArchiveAdvancesTable entries={advances.entries} />
        )}
      </SectionCard>
      <SectionCard title="Legacy supplier deposits (archive)" titleGap="none" className="min-w-0">
        {deposits === null ? <EmptyState title="The deposit archive could not be loaded." /> : <DepositsArchive statement={deposits} />}
      </SectionCard>
      <Footnote>Read-only archives from before the supplier ledger. Their receipts that count are already in the ledger as payments; nothing here changes the balance.</Footnote>
    </PageContainer>
  );
}
