"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useId, useState } from "react";

import { useNavigate } from "@/components/layout/navigation-progress";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { RouteTabs } from "@/components/layout/route-tabs";
import { Callout, KpiCard, KpiRow, SectionCard } from "@/components/shared/cards";
import { DataTable } from "@/components/shared/data-table";
import { FilterSelect, type FilterOption, SearchInput } from "@/components/shared/filters";
import { PoLink } from "@/components/shared/po-link";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rowActionClass } from "@/features/orders/delete-order";
import { ReportDownload } from "@/features/reports/report-actions";
import type { AdvanceAccount, AdvanceKind, AdvanceOpenOrder, SupplierAdvanceBalance } from "@/lib/api/deposits-types";
import { currencyLabel, formatDate, formatINR, formatNumber, rateText } from "@/lib/formatters";

import type { AdvanceData } from "./data/queries";
import { AddAdvanceDialog, DeleteAdvanceButton } from "./advance-dialog";
import { ApplyAdvanceButton } from "./apply-advance";
import { advanceFile } from "./deposit-files";
import {
  ADVANCE_KIND_LABEL,
  ADVANCE_KIND_TONE,
  type AdvanceFilters,
  EMPTY_ADVANCE_FILTERS,
  filterAdvanceEntries,
  isAdvanceFiltered,
  isUnusedReceipt,
  signedAdvance,
  summaryTotals,
} from "./advance-logic";
import { DEPOSIT_TABS } from "./deposits-screen";
import { amountList, amountText } from "./deposits-logic";

// Deposits › Supplier advance (backend docs/supplier-advance.md), no reference design: the Deposits tab parts (header,
// RouteTabs, filter row, xs KPI tiles, the list table). Choose a supplier to see its advance account: what was paid in
// advance, applied to orders automatically and returned from deleted or reduced orders, with the balance after each
// entry. Advances are apart from order payments and supplier deposits; nothing here is added to those figures.

const ALL = "all";
const PAGE_SIZE = 10;
const DATE_INPUT = "h-10 w-[150px] bg-card text-sm";
const option = <T extends string>(value: T, label: string): FilterOption => ({ value, label });
const KIND_OPTIONS = [option(ALL, "All transactions"), ...(Object.keys(ADVANCE_KIND_LABEL) as AdvanceKind[]).map((k) => option(k, ADVANCE_KIND_LABEL[k]))];
const orDash = (value: string | null | undefined) => value?.trim() || "–";

type Entry = AdvanceAccount["entries"][number];

function entryColumns(supplier: string, account: AdvanceAccount, linkPo: boolean, canDelete: boolean): ColumnDef<Entry>[] {
  const money = (value: number, row: Entry) => amountText(value, row.currency);
  return [
    { accessorKey: "entryDate", header: "Date", cell: ({ row }) => formatDate(row.original.entryDate) },
    {
      accessorKey: "kind",
      header: "Transaction",
      cell: ({ row }) => <StatusPill tone={ADVANCE_KIND_TONE[row.original.kind]}>{ADVANCE_KIND_LABEL[row.original.kind]}</StatusPill>,
    },
    {
      accessorKey: "reference",
      header: "Reference",
      // An allocation or reversal names the advance it drew from or returned to.
      cell: ({ row }) =>
        row.original.kind === "receipt" ? (
          orDash(row.original.reference)
        ) : (
          <span className="text-muted-foreground">
            Advance of {row.original.advancePaidOn ? formatDate(row.original.advancePaidOn) : "–"}
            {row.original.advanceReference ? ` · ${row.original.advanceReference}` : ""}
          </span>
        ),
    },
    {
      accessorKey: "po",
      header: "Order",
      cell: ({ row }) =>
        row.original.po ? (
          <>
            <PoLink po={row.original.po} linked={linkPo && row.original.orderId !== null} />
            {row.original.orderId === null ? <span className="block text-xs text-muted-foreground">order deleted</span> : null}
          </>
        ) : (
          "–"
        ),
    },
    {
      id: "amount",
      header: "Amount",
      meta: { align: "right" },
      cell: ({ row }) => {
        const value = signedAdvance(row.original);
        return <span className={value < 0 ? "text-danger-strong" : undefined}>{`${value < 0 ? "−" : "+"}${money(Math.abs(value), row.original)}`}</span>;
      },
    },
    { accessorKey: "currency", header: "Currency" },
    { accessorKey: "exchangeRate", header: "Rate", cell: ({ row }) => rateText(row.original.currency, row.original.exchangeRate) },
    { accessorKey: "amountInr", header: "INR", meta: { align: "right" }, cell: ({ row }) => formatINR(row.original.amountInr, 2) },
    { accessorKey: "balance", header: "Balance after", meta: { align: "right", className: "font-bold" }, cell: ({ row }) => money(row.original.balance, row.original) },
    { accessorKey: "mode", header: "Mode", cell: ({ row }) => orDash(row.original.mode) },
    {
      accessorKey: "notes",
      header: "Notes",
      meta: { className: "max-w-[200px] truncate" },
      cell: ({ row }) => (row.original.notes ? <span title={row.original.notes}>{row.original.notes}</span> : "–"),
    },
    { accessorKey: "recordedBy", header: "Recorded by", cell: ({ row }) => orDash(row.original.recordedBy) },
    ...(canDelete
      ? [
          {
            id: "actions",
            header: () => <span className="sr-only">Actions</span>,
            meta: { className: "w-px whitespace-nowrap" },
            cell: ({ row }: { row: { original: Entry } }) =>
              row.original.kind === "receipt" ? <DeleteAdvanceButton entry={row.original} supplier={supplier} used={!isUnusedReceipt(row.original, account)} /> : null,
          } satisfies ColumnDef<Entry>,
        ]
      : []),
  ];
}

const balanceColumns: ColumnDef<SupplierAdvanceBalance>[] = [
  { accessorKey: "supplier", header: "Supplier", meta: { className: "font-bold" } },
  { accessorKey: "currency", header: "Currency" },
  { accessorKey: "availableCny", header: "Available advance", meta: { align: "right", className: "font-bold" }, cell: ({ row }) => amountText(row.original.availableCny, row.original.currency) },
  { accessorKey: "receivedCny", header: "Advance received", meta: { align: "right" }, cell: ({ row }) => amountText(row.original.receivedCny, row.original.currency) },
  { accessorKey: "allocatedCny", header: "Applied to orders", meta: { align: "right" }, cell: ({ row }) => amountText(row.original.allocatedCny, row.original.currency) },
  { accessorKey: "reversedCny", header: "Returned from orders", meta: { align: "right" }, cell: ({ row }) => amountText(row.original.reversedCny, row.original.currency) },
  { accessorKey: "orders", header: "Orders", meta: { align: "right" }, cell: ({ row }) => formatNumber(row.original.orders) },
];

/**
 * The supplier's orders still owing it (ADV-1 `openOrders`, oldest first). New orders draw on the advance by
 * themselves; one placed before the advance was recorded takes it only through Apply advance (ADV-4), offered with
 * payments Enter while advance is available in the order's currency.
 */
function openOrderColumns(account: AdvanceAccount, linkPo: boolean, canEnter: boolean): ColumnDef<AdvanceOpenOrder>[] {
  const availableIn = (currency: string) => account.summary.find((row) => row.currency === currency)?.availableCny ?? 0;
  const money = (key: "orderValueCny" | "paidCny" | "advanceCny" | "balanceCny", header: string): ColumnDef<AdvanceOpenOrder> => ({
    accessorKey: key,
    header,
    meta: { align: "right", className: key === "balanceCny" ? "font-bold" : undefined },
    cell: ({ row }) => amountText(row.original[key], row.original.currency),
  });
  return [
    { accessorKey: "po", header: "Order", cell: ({ row }) => <PoLink po={row.original.po} linked={linkPo} /> },
    { accessorKey: "orderDate", header: "Order date", cell: ({ row }) => formatDate(row.original.orderDate) },
    money("orderValueCny", "Order value"),
    money("paidCny", "Paid to supplier"),
    money("advanceCny", "Advance applied"),
    money("balanceCny", "Balance"),
    {
      id: "apply",
      header: "Actions",
      cell: ({ row }) => {
        const available = availableIn(row.original.currency);
        return canEnter && available > 0 ? <ApplyAdvanceButton po={row.original.po} currency={row.original.currency} availableCny={available} balanceCny={row.original.balanceCny} /> : "–";
      },
    },
  ];
}

export function AdvanceScreen({ data }: { data: AdvanceData }) {
  const navigate = useNavigate();
  const id = useId();
  const { account, suppliers, advances, today, canEnter, canDelete, linkPo } = data;
  const [filters, setFilters] = useState<AdvanceFilters>(EMPTY_ADVANCE_FILTERS);
  const set = <K extends keyof AdvanceFilters>(key: K) => (value: AdvanceFilters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  const choose = (supplierId: string) => {
    setFilters(EMPTY_ADVANCE_FILTERS);
    navigate(supplierId === ALL ? "/deposits/advance" : `/deposits/advance?supplier=${encodeURIComponent(supplierId)}`);
  };
  const supplierOptions = [option(ALL, "Choose a supplier"), ...suppliers.map((s) => option(s.id, s.name))];
  const entries = account ? filterAdvanceEntries(account.entries, filters) : [];
  const describe = [
    filters.kind ? ADVANCE_KIND_LABEL[filters.kind] : null,
    filters.from || filters.to ? `${filters.from ? formatDate(filters.from) : "start"} to ${filters.to ? formatDate(filters.to) : "today"}` : null,
    filters.po.trim() ? `PO contains "${filters.po.trim()}"` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <PageHeader
        title="Deposits"
        actions={
          account ? (
            <>
              <ReportDownload size="header" file={() => advanceFile(account.supplier, { ...account, entries }, describe || "All transactions", today)} />
              {canEnter ? (
                <AddAdvanceDialog supplier={account.supplier}>
                  <Button type="button" size="header">
                    + Add advance
                  </Button>
                </AddAdvanceDialog>
              ) : null}
            </>
          ) : undefined
        }
      />
      <RouteTabs tabs={DEPOSIT_TABS} label="Deposits views" />
      <PageContainer>
        <div className="flex flex-wrap items-center gap-3">
          <FilterSelect label="Supplier" size="sm" value={account?.supplier.id ?? ALL} options={supplierOptions} onValueChange={choose} />
          {account ? (
            <>
              <FilterSelect label="Transaction type" size="sm" value={filters.kind ?? ALL} options={KIND_OPTIONS} onValueChange={(v) => set("kind")(v === ALL ? null : (v as AdvanceKind))} />
              <label htmlFor={`${id}-from`} className="text-xs text-muted-foreground">
                From
              </label>
              <Input id={`${id}-from`} type="date" size="sm" className={DATE_INPUT} value={filters.from} max={filters.to || undefined} onChange={(e) => set("from")(e.target.value)} />
              <label htmlFor={`${id}-to`} className="text-xs text-muted-foreground">
                To
              </label>
              <Input id={`${id}-to`} type="date" size="sm" className={DATE_INPUT} value={filters.to} min={filters.from || undefined} onChange={(e) => set("to")(e.target.value)} />
              <SearchInput label="Search PO" placeholder="PO number" value={filters.po} onValueChange={set("po")} size="md" className="w-[150px] bg-card" />
              {isAdvanceFiltered(filters) ? (
                <button type="button" className={rowActionClass} onClick={() => setFilters(EMPTY_ADVANCE_FILTERS)}>
                  Clear filters
                </button>
              ) : null}
            </>
          ) : null}
        </div>

        {account ? (
          <>
            <SectionCard
              title={account.supplier.name}
              aside={
                <span className="text-sm text-muted-foreground">
                  Preferred currency {currencyLabel(account.supplier.currency)}
                  {account.supplier.exchangeRate != null ? ` · ${rateText(account.supplier.currency, account.supplier.exchangeRate)}` : ""}
                </span>
              }
              titleGap="none"
            >
              <KpiRow gap="sm" className="mt-3">
                <KpiCard size="xs" label="Available advance" value={amountList(summaryTotals(account.summary, (r) => r.availableCny), account.supplier.currency)} sub="ready for new orders" />
                <KpiCard size="xs" label="Advance received" value={amountList(summaryTotals(account.summary, (r) => r.receivedCny), account.supplier.currency)} sub="paid before orders" />
                <KpiCard size="xs" label="Applied to orders" value={amountList(summaryTotals(account.summary, (r) => r.allocatedCny), account.supplier.currency)} sub="on new orders, or applied" />
                <KpiCard size="xs" label="Returned from orders" value={amountList(summaryTotals(account.summary, (r) => r.reversedCny), account.supplier.currency)} sub="deleted or reduced orders" />
                <KpiCard size="xs" label="Related orders" value={formatNumber(account.summary.reduce((sum, r) => sum + r.orders, 0))} sub="POs that used the advance" />
              </KpiRow>
            </SectionCard>
            <Callout size="sm">
              Advances are separate from order payments and supplier deposits. An order&apos;s Payments tab shows the advance applied to it apart from its
              direct payments.
            </Callout>
            {account.openOrders?.length ? (
              <SectionCard title="Orders still to pay" titleGap="none" className="min-w-0">
                <p className="mt-1 text-sm text-muted-foreground">
                  New orders use the advance by themselves. An order placed before the advance was recorded takes it only when you apply it.
                </p>
                <DataTable
                  className="mt-3"
                  variant="embedded"
                  columns={openOrderColumns(account, linkPo, canEnter)}
                  data={account.openOrders}
                  getRowId={(row) => row.po}
                  size="sm"
                  pagination={{ pageSize: PAGE_SIZE, itemLabel: "orders" }}
                />
              </SectionCard>
            ) : null}
            <DataTable
              key={`${account.supplier.id} ${JSON.stringify(filters)}`}
              columns={entryColumns(account.supplier.name, account, linkPo, canDelete)}
              data={entries}
              getRowId={(row) => row.id}
              size="sm"
              header="tall"
              emptyState={account.entries.length === 0 ? "No advance recorded for this supplier yet." : "No transactions match these filters."}
              pagination={{ pageSize: PAGE_SIZE, itemLabel: "transactions" }}
            />
          </>
        ) : (
          <DataTable
            columns={balanceColumns}
            data={advances}
            getRowId={(row) => `${row.supplierId} ${row.currency}`}
            size="sm"
            header="tall"
            onRowClick={(row) => choose(row.supplierId)}
            emptyState="No supplier advances yet. Choose a supplier to add one."
            pagination={{ pageSize: PAGE_SIZE, itemLabel: "accounts" }}
          />
        )}
      </PageContainer>
    </>
  );
}
