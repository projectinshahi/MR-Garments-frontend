"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useId, useState } from "react";

import { useNavigate } from "@/components/layout/navigation-progress";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { RouteTabs, type RouteTab } from "@/components/layout/route-tabs";
import { KpiCard, KpiRow } from "@/components/shared/cards";
import { DataTable } from "@/components/shared/data-table";
import { FilterSelect, type FilterOption, SearchInput } from "@/components/shared/filters";
import { PoLink } from "@/components/shared/po-link";
import { StatusPill } from "@/components/shared/status-pill";
import { Input } from "@/components/ui/input";
import { rowActionClass } from "@/features/orders/delete-order";
import { ExportActions } from "@/features/reports/report-actions";
import { formatNumber, formatShortDate } from "@/lib/formatters";
import { type Currency, CURRENCIES, type MoneyTotal } from "@/types/domain";

import type { DepositsData } from "./data/queries";
import { depositsFile, filterLabel, suppliersFile } from "./deposit-files";
import {
  amountList,
  amountText,
  type DepositFilters,
  type DepositKind,
  type DepositRow,
  type DepositStatus,
  type DepositView,
  EMPTY_FILTERS,
  filterDeposits,
  inView,
  isFiltered,
  KIND_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  supplierSummaries,
  type SupplierSummary,
  totals,
  VIEW_STATUSES,
} from "./deposits-logic";

// Deposits (docs/phase2-contracts.md 3.3), no reference design: the list pages' parts (header, RouteTabs, filter row,
// xs KPI tiles, the list table). Every deposit is loaded once (DEP-1); the tabs and filters run on the client.

const TABS: RouteTab[] = [
  { href: "/deposits", label: "All deposits", chip: "a" },
  { href: "/deposits/pending", label: "Pending", chip: "b" },
  { href: "/deposits/paid", label: "Paid", chip: "c" },
  { href: "/deposits/suppliers", label: "Suppliers", chip: "d" },
];
const ALL = "all";
const PAGE_SIZE = 10;
const option = <T extends string>(value: T, label: string): FilterOption => ({ value, label });
const statusOptions = (statuses: DepositStatus[]) => [option(ALL, "All statuses"), ...statuses.map((s) => option(s, STATUS_LABEL[s]))];
const CURRENCY_OPTIONS = [option(ALL, "All currencies"), ...CURRENCIES.map((c) => option(c, c))];
const KIND_OPTIONS = [option(ALL, "All kinds"), ...(Object.keys(KIND_LABEL) as DepositKind[]).map((k) => option(k, KIND_LABEL[k]))];
const plural = (count: number, noun: string) => `${formatNumber(count)} ${noun}${count === 1 ? "" : "s"}`;

/** Per currency, or "–" when there is nothing (a supplier with no deposits in a direction). */
const list = (amounts: MoneyTotal[]) => (amounts.length ? amountList(amounts) : "–");

// Columns: supplier, PO when applicable, kind, paid to, amount, currency, paid/settled, pending, date, mode, reference, notes, status.
function depositColumns(linkPo: boolean): ColumnDef<DepositRow>[] {
  const money = (pick: (row: DepositRow) => number) => ({ row }: { row: { original: DepositRow } }) => amountText(pick(row.original), row.original.currency);
  return [
    { accessorKey: "supplier", header: "Supplier", meta: { className: "font-bold" } },
    {
      accessorKey: "po",
      header: "PO",
      cell: ({ row }) =>
        row.original.po ? (
          <span onClick={(event) => event.stopPropagation()}>
            <PoLink po={row.original.po} linked={linkPo} />
          </span>
        ) : (
          "–"
        ),
    },
    {
      accessorKey: "kind",
      header: "Kind",
      // An obligation row says how many deposit payments it sums.
      cell: ({ row }) => (
        <>
          {KIND_LABEL[row.original.kind]}
          {row.original.payments === undefined ? null : <span className="block text-xs text-muted-foreground">{plural(row.original.payments, "payment")}</span>}
        </>
      ),
    },
    { accessorKey: "payee", header: "Paid to", cell: ({ row }) => row.original.payee || "–" },
    { accessorKey: "amount", header: "Amount", meta: { align: "right" }, cell: money((r) => r.amount) },
    { accessorKey: "currency", header: "Currency" },
    { accessorKey: "paid", header: "Paid / settled", meta: { align: "right" }, cell: money((r) => r.paid) },
    { accessorKey: "pending", header: "Pending", meta: { align: "right" }, cell: money((r) => r.pending) },
    { accessorKey: "date", header: "Date", cell: ({ row }) => (row.original.date ? formatShortDate(row.original.date) : "–") },
    { accessorKey: "mode", header: "Mode", cell: ({ row }) => row.original.mode || "–" },
    { accessorKey: "reference", header: "Reference", cell: ({ row }) => row.original.reference || "–" },
    {
      accessorKey: "notes",
      header: "Notes",
      meta: { className: "max-w-[200px] truncate" },
      cell: ({ row }) => (row.original.notes ? <span title={row.original.notes}>{row.original.notes}</span> : "–"),
    },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusPill tone={STATUS_TONE[row.original.status]}>{STATUS_LABEL[row.original.status]}</StatusPill> },
    {
      id: "details",
      header: () => <span className="sr-only">Details</span>,
      meta: { className: "w-px whitespace-nowrap" },
      // None for an order deposit when the user can't open orders (href null), as PoLink stays plain text.
      cell: ({ row }) =>
        row.original.href ? (
          <Link href={row.original.href} className={rowActionClass} onClick={(event) => event.stopPropagation()}>
            Details
          </Link>
        ) : null,
    },
  ];
}

const supplierColumns: ColumnDef<SupplierSummary>[] = [
  { accessorKey: "supplier", header: "Supplier", meta: { className: "font-bold" } },
  { id: "give", header: "To give", meta: { align: "right" }, cell: ({ row }) => list(row.original.give.amount) },
  { id: "given", header: "Given", meta: { align: "right" }, cell: ({ row }) => list(row.original.give.paid) },
  { id: "givePending", header: "Pending to give", meta: { align: "right" }, cell: ({ row }) => list(row.original.give.pending) },
  { id: "receive", header: "To receive", meta: { align: "right" }, cell: ({ row }) => list(row.original.receive.amount) },
  { id: "received", header: "Received", meta: { align: "right" }, cell: ({ row }) => list(row.original.receive.paid) },
  { id: "receivePending", header: "Pending to receive", meta: { align: "right" }, cell: ({ row }) => list(row.original.receive.pending) },
  {
    id: "statement",
    header: () => <span className="sr-only">Statement</span>,
    meta: { className: "w-px whitespace-nowrap" },
    cell: ({ row }) => (
      <Link href={row.original.href} className={rowActionClass} aria-label={`Statement of ${row.original.supplier}`} onClick={(event) => event.stopPropagation()}>
        Statement
      </Link>
    ),
  },
];

const DATE_INPUT = "h-10 w-[150px] bg-card text-sm";

/**
 * The four Deposits tabs. `view`: which rows the table shows (All, Pending, Paid) or `suppliers` (one line per supplier
 * with supplier deposits). The overview cards and the export follow the rows shown after the filters.
 */
export function DepositsScreen({ data, view }: { data: DepositsData; view: DepositView | "suppliers" }) {
  const navigate = useNavigate();
  const id = useId();
  const [filters, setFilters] = useState<DepositFilters>(EMPTY_FILTERS);
  const set = <K extends keyof DepositFilters>(key: K) => (value: DepositFilters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  const fromSelect = <T extends string>(set: (value: T | null) => void) => (value: string) => set(value === ALL ? null : (value as T));

  const scoped = data.rows.filter((row) => (view === "suppliers" ? row.kind !== "order" : inView(row, view)));
  const rows = filterDeposits(scoped, filters);
  const summaries = view === "suppliers" ? supplierSummaries(rows) : [];
  const { pay, receive } = totals(rows);
  const supplierOptions = [option(ALL, "All suppliers"), ...data.suppliers.map((s) => option(s.id, s.name))];
  const label = filterLabel(filters, data.suppliers);
  const empty = scoped.length === 0 ? (view === "pending" ? "No pending deposits." : view === "paid" ? "No paid deposits." : "No deposits yet.") : "No deposits match these filters.";

  return (
    <>
      <PageHeader
        title="Deposits"
        actions={
          <ExportActions
            size="header"
            formats={["xlsx", "pdf"]}
            file={() => (view === "suppliers" ? suppliersFile(summaries, label, data.today) : depositsFile(view, rows, label, data.today))}
          />
        }
      />
      <RouteTabs tabs={TABS} label="Deposits views" />
      <PageContainer>
        <div className="flex flex-wrap items-center gap-3">
          <FilterSelect label="Supplier" size="sm" value={filters.supplierId ?? ALL} options={supplierOptions} onValueChange={fromSelect(set("supplierId"))} />
          {view === "suppliers" ? null : (
            <SearchInput label="Search PO" placeholder="PO number" value={filters.po} onValueChange={set("po")} size="md" className="w-[150px] bg-card" />
          )}
          <label htmlFor={`${id}-from`} className="text-xs text-muted-foreground">
            From
          </label>
          <Input id={`${id}-from`} type="date" size="sm" className={DATE_INPUT} value={filters.from} max={filters.to || undefined} onChange={(e) => set("from")(e.target.value)} />
          <label htmlFor={`${id}-to`} className="text-xs text-muted-foreground">
            To
          </label>
          <Input id={`${id}-to`} type="date" size="sm" className={DATE_INPUT} value={filters.to} min={filters.from || undefined} onChange={(e) => set("to")(e.target.value)} />
          {view === "suppliers" ? null : (
            <FilterSelect label="Status" size="sm" value={filters.status ?? ALL} options={statusOptions(VIEW_STATUSES[view])} onValueChange={fromSelect(set("status"))} />
          )}
          <FilterSelect label="Currency" size="sm" value={filters.currency ?? ALL} options={CURRENCY_OPTIONS} onValueChange={fromSelect<Currency>(set("currency"))} />
          <FilterSelect
            label="Kind"
            size="sm"
            value={filters.kind ?? ALL}
            options={view === "suppliers" ? KIND_OPTIONS.filter((o) => o.value !== "order") : KIND_OPTIONS}
            onValueChange={fromSelect<DepositKind>(set("kind"))}
          />
          {isFiltered(filters) ? (
            <button type="button" className={rowActionClass} onClick={() => setFilters(EMPTY_FILTERS)}>
              Clear filters
            </button>
          ) : null}
        </div>
        {/* Payables (order deposits and deposits to give) and receivables apart, never netted; each figure per currency,
            from the rows shown; amounts in different currencies are never added together. */}
        <KpiRow gap="sm">
          <KpiCard size="xs" label="Deposits to pay" value={amountList(pay.amount)} sub={plural(pay.count, "deposit")} />
          <KpiCard size="xs" label="Paid" value={amountList(pay.paid)} sub="of deposits to pay" />
          <KpiCard size="xs" label="Pending to pay" value={amountList(pay.pending)} sub="due order deposits and deposits to give" />
          <KpiCard
            size="xs"
            label="To receive"
            value={amountList(receive.pending)}
            sub={`received ${amountList(receive.paid)} of ${amountList(receive.amount)} · ${plural(receive.count, "deposit")}`}
          />
        </KpiRow>
        {view === "suppliers" ? (
          <DataTable
            key={JSON.stringify(filters)}
            columns={supplierColumns}
            data={summaries}
            getRowId={(row) => row.supplierId}
            size="sm"
            header="tall"
            onRowClick={(row) => navigate(row.href)}
            emptyState={scoped.length === 0 ? "No supplier deposits yet." : "No suppliers match these filters."}
            pagination={{ pageSize: PAGE_SIZE, itemLabel: "suppliers" }}
          />
        ) : (
          <DataTable
            // Remount on a filter change so the pager returns to page 1.
            key={JSON.stringify(filters)}
            columns={depositColumns(data.linkPo)}
            data={rows}
            getRowId={(row) => row.id}
            size="sm"
            header="tall"
            onRowClick={(row) => (row.href ? navigate(row.href) : undefined)}
            emptyState={empty}
            pagination={{ pageSize: PAGE_SIZE, itemLabel: "deposits" }}
          />
        )}
      </PageContainer>
    </>
  );
}
