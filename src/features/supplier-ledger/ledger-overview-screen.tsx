"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useState } from "react";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { RouteTabs } from "@/components/layout/route-tabs";
import { KpiCard, KpiRow, SectionCard } from "@/components/shared/cards";
import { DataTable } from "@/components/shared/data-table";
import { FilterSelect, SearchInput, type FilterOption } from "@/components/shared/filters";
import { StatusPill } from "@/components/shared/status-pill";
import { BalanceFigure, DASH, moneyOrDash } from "@/features/payments/money";
import { ReportDownload } from "@/features/reports/report-actions";
import { describeFilters } from "@/features/reports/report-files";
import { formatDate, formatMoney, formatMoneyList } from "@/lib/formatters";
import { orderedCurrencies } from "@/lib/currencies";

import type { LedgerOverviewData } from "./data/queries";
import { ledgerOverviewFile } from "./ledger-files";
import { type BalanceState, filterOverview, ledgerHref, type OverviewRow, overviewRows } from "./ledger-logic";

export const LEDGER_TABS = [
  { href: "/supplier-ledger", label: "Supplier accounts" },
  { href: "/supplier-ledger/milestones", label: "Deposit milestones" },
];

const STATES: FilterOption[] = [
  { value: "all", label: "All balances" },
  { value: "payable", label: "Payable to supplier" },
  { value: "available", label: "Available with supplier" },
  { value: "settled", label: "Settled" },
  { value: "held", label: "Pending review" },
];
const ALL = "all";
const right = { align: "right" } as const;

const columns: ColumnDef<OverviewRow>[] = [
  {
    accessorKey: "supplier",
    header: "Supplier",
    cell: ({ row }) => (
      <span onClick={(event) => event.stopPropagation()}>
        <Link href={ledgerHref(row.original.supplierId)} className="font-bold text-primary hover:underline">
          {row.original.supplier}
        </Link>
        {row.original.code ? <span className="block text-xs text-muted-foreground">{row.original.code}</span> : null}
        {row.original.status === "Inactive" ? <StatusPill tone="neutral" className="mt-1">Inactive</StatusPill> : null}
      </span>
    ),
  },
  { id: "currency", header: "Currency", cell: ({ row }) => row.original.account?.currency ?? DASH },
  {
    id: "balance",
    header: "Balance",
    meta: right,
    cell: ({ row }) => {
      const a = row.original.account;
      if (!a) return <span className="text-muted-foreground">No entries yet</span>;
      return <BalanceFigure balance={a.balanceCny} currency={a.currency} held={a.held} className="font-bold" />;
    },
  },
  ...(["creditsCny", "debitsCny", "outstandingCny"] as const).map(
    (key): ColumnDef<OverviewRow> => ({
      id: key,
      header: { creditsCny: "Credits", debitsCny: "Debits", outstandingCny: "Outstanding" }[key],
      meta: right,
      cell: ({ row }) => {
        const a = row.original.account;
        return a ? moneyOrDash(a[key], (v) => formatMoney(v, a.currency, { decimals: 2 })) : DASH;
      },
    }),
  ),
  { id: "openOrders", header: "Open orders", meta: right, cell: ({ row }) => row.original.account?.openOrders ?? DASH },
  { id: "lastPayment", header: "Last payment", cell: ({ row }) => (row.original.account?.lastPaymentOn ? formatDate(row.original.account.lastPaymentOn) : DASH) },
];

/** Supplier ledger (D14, LED-2): every supplier account per currency, signed, with the per-currency totals (held left out). */
export function LedgerOverviewScreen({ data }: { data: LedgerOverviewData }) {
  const { overview, today } = data;
  const [query, setQuery] = useState("");
  const [state, setState] = useState<string>(ALL);
  const [currency, setCurrency] = useState<string>(ALL);
  const rows = overviewRows(overview);
  const filters = { query, state: state as BalanceState, currency: currency === ALL ? null : currency };
  const shown = filterOverview(rows, filters);
  const currencies = orderedCurrencies(overview.accounts.map((a) => a.currency));
  const held = overview.accounts.filter((a) => a.held).length;
  const each = (key: "payableCny" | "availableCny" | "outstandingCny") => formatMoneyList(overview.totals.map((t) => ({ currency: t.currency, amount: t[key] })));
  const label = describeFilters([
    query.trim() && `Search: "${query.trim()}"`,
    state !== ALL && `Balance: ${STATES.find((s) => s.value === state)?.label}`,
    currency !== ALL && `Currency: ${currency}`,
  ]);

  return (
    <>
      <PageHeader title="Supplier ledger" actions={<ReportDownload file={() => ledgerOverviewFile(shown, label, today)} />} />
      <RouteTabs tabs={LEDGER_TABS} label="Supplier ledger views" />
      <PageContainer>
        <KpiRow gap="sm">
          <KpiCard size="xs" label="Payable to suppliers" value={each("payableCny")} sub="accounts below zero" />
          <KpiCard size="xs" label="Available with suppliers" value={each("availableCny")} sub="accounts above zero" />
          <KpiCard size="xs" label="Outstanding on open orders" value={each("outstandingCny")} sub="settled oldest first" />
          <KpiCard size="xs" label="Accounts" value={overview.accounts.length - held} sub={held ? `${held} pending review, not counted` : "one per supplier and currency"} />
        </KpiRow>
        <SectionCard title="Supplier accounts" titleGap="none">
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <SearchInput label="Search supplier" placeholder="Search supplier or code" value={query} onValueChange={setQuery} className="w-full sm:w-auto sm:max-w-[290px] sm:flex-[1_1_200px]" />
            <FilterSelect label="Balance" showLabel size="sm" value={state} options={STATES} onValueChange={setState} />
            {currencies.length > 1 ? (
              <FilterSelect
                label="Currency"
                showLabel
                size="sm"
                value={currency}
                options={[{ value: ALL, label: "All currencies" }, ...currencies.map((c) => ({ value: c, label: c }))]}
                onValueChange={setCurrency}
              />
            ) : null}
          </div>
          <DataTable
            key={JSON.stringify(filters)}
            columns={columns}
            data={shown}
            getRowId={(row) => `${row.supplierId}|${row.account?.currency ?? ""}`}
            size="sm"
            header="tall"
            emptyState={rows.length ? "No accounts match these filters." : "No suppliers yet."}
            pagination={{ pageSize: 15, itemLabel: "accounts" }}
            className="mt-3"
          />
        </SectionCard>
      </PageContainer>
    </>
  );
}
