"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useId, useState } from "react";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Callout, KpiCard, KpiRow, SectionCard } from "@/components/shared/cards";
import { DataTable } from "@/components/shared/data-table";
import { FilterSelect, type FilterOption, SearchInput } from "@/components/shared/filters";
import { KeyValueList } from "@/components/shared/key-value-list";
import { PoLink } from "@/components/shared/po-link";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rowActionClass } from "@/features/orders/delete-order";
import { ReportDownload } from "@/features/reports/report-actions";
import type { AdvanceAccount, AdvanceEntry, AdvanceHistoryKind, AdvanceOpenOrder, AdvanceSummary } from "@/lib/api/deposits-types";
import { currencyLabel, currencyTitle, formatDate, formatINR, formatNumber, rateText } from "@/lib/formatters";

import type { AdvanceSupplierData } from "./data/queries";
import { AddAdvanceDialog, DeleteAdvanceButton } from "./advance-dialog";
import { ApplyAdvanceButton } from "./apply-advance";
import { advanceFile } from "./deposit-files";
import {
  ADVANCE_KIND_LABEL,
  ADVANCE_KIND_TONE,
  type AdvanceFilters,
  advanceHistory,
  type AdvanceHistoryRow,
  depositsOf,
  EMPTY_ADVANCE_FILTERS,
  excessOf,
  filterAdvanceEntries,
  isAdvanceFiltered,
  isUnusedReceipt,
  netApplied,
  recordedOf,
  signedAdvance,
  summaryTotals,
} from "./advance-logic";
import { amountList, amountText } from "./deposits-logic";

// One supplier's advance (backend docs/supplier-advance.md), opened from the supplier-wise overview: the supplier, its
// account per currency (ADV-1: added as advance, order deposits, applied, available), the orders still owing it with
// Apply advance (ADV-4), and its history (every ledger entry and order deposit, with the available balance after it),
// filtered and sortable. Add advance (ADV-2) records money paid before any order. A deposit paid with an order is part of
// the advance already (applied in full to that order), counted once; balance payments and supplier deposits are not.

const ALL = "all";
const PAGE_SIZE = 10;
const DATE_INPUT = "h-10 w-[150px] bg-card text-sm";
const option = <T extends string>(value: T, label: string): FilterOption => ({ value, label });
const KIND_OPTIONS = [option(ALL, "All transactions"), ...(Object.keys(ADVANCE_KIND_LABEL) as AdvanceHistoryKind[]).map((k) => option(k, ADVANCE_KIND_LABEL[k]))];
const orDash = (value: string | null | undefined) => value?.trim() || "–";

type Entry = AdvanceHistoryRow;

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
      id: "reference",
      accessorFn: (row) => row.po || row.reference,
      header: "Reference / order",
      // A receipt: its reference and payment mode. An order deposit: its order, paid with it. An allocation or reversal:
      // its order, and the advance it drew from or returned to.
      cell: ({ row }) =>
        row.original.kind === "excess" || row.original.kind === "excess_return" ? (
          <span className="flex flex-col">
            <span>
              <PoLink po={row.original.po} linked={linkPo && row.original.orderId !== null} />
              {row.original.orderId === null ? <span className="ml-1 text-xs text-muted-foreground">(order deleted)</span> : null}
            </span>
            <span className="text-xs text-muted-foreground">
              {row.original.kind === "excess"
                ? ["Paid beyond the order value", row.original.reference, row.original.mode].filter(Boolean).join(" · ")
                : "Payment deleted or order value raised"}
            </span>
          </span>
        ) : row.original.kind === "deposit" ? (
          <span className="flex flex-col">
            <PoLink po={row.original.po} linked={linkPo} />
            <span className="text-xs text-muted-foreground">
              {["Paid with the order", row.original.reference, row.original.mode].filter(Boolean).join(" · ")}
            </span>
          </span>
        ) : row.original.kind === "receipt" ? (
          <span className="flex flex-col">
            {orDash(row.original.reference)}
            <span className="text-xs text-muted-foreground">{orDash(row.original.mode)}</span>
          </span>
        ) : (
          <span className="flex flex-col">
            <span>
              <PoLink po={row.original.po} linked={linkPo && row.original.orderId !== null} />
              {row.original.orderId === null ? <span className="ml-1 text-xs text-muted-foreground">(order deleted)</span> : null}
            </span>
            <span className="text-xs text-muted-foreground">
              Advance of {row.original.advancePaidOn ? formatDate(row.original.advancePaidOn) : "–"}
              {row.original.advanceReference ? ` · ${row.original.advanceReference}` : ""}
            </span>
          </span>
        ),
    },
    {
      id: "amount",
      accessorFn: (row) => signedAdvance(row),
      header: "Amount",
      meta: { align: "right" },
      cell: ({ row }) => {
        // An order deposit is recorded and applied at once: its amount, unsigned (the balance does not move).
        if (row.original.kind === "deposit") return money(row.original.amount, row.original);
        const value = signedAdvance(row.original);
        return <span className={value < 0 ? "text-danger-strong" : undefined}>{`${value < 0 ? "−" : "+"}${money(Math.abs(value), row.original)}`}</span>;
      },
    },
    { accessorKey: "currency", header: "Currency" },
    // The rate of the advance the entry belongs to (saved when it was recorded), never the supplier's rate now.
    { accessorKey: "exchangeRate", header: "Exchange rate", cell: ({ row }) => rateText(row.original.currency, row.original.exchangeRate) },
    { accessorKey: "amountInr", header: "INR", meta: { align: "right" }, cell: ({ row }) => formatINR(row.original.amountInr, 2) },
    { accessorKey: "balance", header: "Remaining balance", meta: { align: "right", className: "font-bold" }, cell: ({ row }) => money(row.original.balance, row.original) },
    {
      accessorKey: "notes",
      header: "Notes",
      enableSorting: false,
      meta: { className: "max-w-[200px] truncate" },
      cell: ({ row }) => (row.original.notes ? <span title={row.original.notes}>{row.original.notes}</span> : "–"),
    },
    { accessorKey: "recordedBy", header: "Recorded by", cell: ({ row }) => orDash(row.original.recordedBy) },
    ...(canDelete
      ? [
          {
            id: "actions",
            enableSorting: false,
            header: () => <span className="sr-only">Actions</span>,
            meta: { className: "w-px whitespace-nowrap" },
            cell: ({ row }: { row: { original: Entry } }) =>
              row.original.kind === "receipt" ? (
                <DeleteAdvanceButton entry={row.original as AdvanceEntry} supplier={supplier} used={!isUnusedReceipt(row.original as AdvanceEntry, account)} />
              ) : null,
          } satisfies ColumnDef<Entry>,
        ]
      : []),
  ];
}

/** Per currency: added, order deposits, applied from the added advance, returned, applied net, available and the orders. */
const currencyColumns: ColumnDef<AdvanceSummary>[] = [
  { accessorKey: "currency", header: "Currency", cell: ({ row }) => currencyLabel(row.original.currency) },
  { accessorKey: "receivedCny", header: "Added as advance", meta: { align: "right" }, cell: ({ row }) => amountText(row.original.receivedCny, row.original.currency) },
  { id: "excess", header: "Excess payments", meta: { align: "right" }, cell: ({ row }) => amountText(excessOf(row.original), row.original.currency) },
  { id: "deposits", header: "Order deposits", meta: { align: "right" }, cell: ({ row }) => amountText(depositsOf(row.original), row.original.currency) },
  { accessorKey: "allocatedCny", header: "Applied from added advance", meta: { align: "right" }, cell: ({ row }) => amountText(row.original.allocatedCny, row.original.currency) },
  { accessorKey: "reversedCny", header: "Returned from orders", meta: { align: "right" }, cell: ({ row }) => amountText(row.original.reversedCny, row.original.currency) },
  { id: "net", header: "Applied to orders (net)", meta: { align: "right" }, cell: ({ row }) => amountText(netApplied(row.original), row.original.currency) },
  { accessorKey: "availableCny", header: "Available balance", meta: { align: "right", className: "font-bold" }, cell: ({ row }) => amountText(row.original.availableCny, row.original.currency) },
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

export function AdvanceSupplierScreen({ data }: { data: AdvanceSupplierData }) {
  const id = useId();
  const { account, details, today, canEnter, canDelete, linkPo } = data;
  const { supplier } = account;
  const [filters, setFilters] = useState<AdvanceFilters>(EMPTY_ADVANCE_FILTERS);
  const set = <K extends keyof AdvanceFilters>(key: K) => (value: AdvanceFilters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  const history = advanceHistory(account);
  const entries = filterAdvanceEntries(history, filters);
  const totals = (pick: (row: AdvanceSummary) => number) => amountList(summaryTotals(account.summary, pick), supplier.currency);
  const reversed = account.summary.some((row) => row.reversedCny > 0);
  const hasDeposits = account.summary.some((row) => depositsOf(row) > 0);
  const hasExcess = account.summary.some((row) => excessOf(row) > 0);
  const recordedParts = [
    `${totals((r) => r.receivedCny)} added`,
    hasExcess ? `${totals(excessOf)} excess` : null,
    hasDeposits ? `${totals(depositsOf)} order deposits` : null,
  ];
  const describe = [
    filters.kind ? ADVANCE_KIND_LABEL[filters.kind] : null,
    filters.from || filters.to ? `${filters.from ? formatDate(filters.from) : "start"} to ${filters.to ? formatDate(filters.to) : "today"}` : null,
    filters.po.trim() ? `Reference or PO contains "${filters.po.trim()}"` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const addAdvance = canEnter ? (
    <AddAdvanceDialog supplier={supplier}>
      <Button type="button" size="header">
        + Add advance
      </Button>
    </AddAdvanceDialog>
  ) : null;

  return (
    <>
      <PageHeader
        title={supplier.name}
        parent={{ label: "Supplier advance", href: "/deposits/advance" }}
        titleAddon={supplier.status === "Inactive" ? <StatusPill tone="neutral">Inactive</StatusPill> : undefined}
        actions={
          <>
            <ReportDownload size="header" file={() => advanceFile(supplier, account, entries, describe || "All transactions", today)} />
            {addAdvance}
          </>
        }
      />
      <PageContainer>
        <SectionCard title={supplier.name} titleGap="none">
          <div className="mt-2 grid gap-x-10 lg:grid-cols-2">
            <KeyValueList
              boldValues
              items={[
                { label: "Contact person", value: orDash(details.contactPerson) },
                { label: "Phone", value: orDash(details.phone) },
              ]}
            />
            <KeyValueList
              boldValues
              className="border-t border-border-subtle lg:border-t-0"
              items={[
                { label: "City", value: orDash(details.city) },
                {
                  label: "Currency now",
                  value: `${currencyTitle(supplier.currency)}${supplier.currency !== "INR" && supplier.exchangeRate != null ? ` · ${rateText(supplier.currency, supplier.exchangeRate)}` : ""}`,
                },
              ]}
            />
          </div>
        </SectionCard>

        <KpiRow gap="sm">
          <KpiCard
            size="xs"
            label="Advance recorded"
            value={totals(recordedOf)}
            sub={hasDeposits || hasExcess ? recordedParts.filter(Boolean).join(" · ") : "paid before orders"}
          />
          <KpiCard
            size="xs"
            label="Applied to orders (net)"
            value={totals(netApplied)}
            sub={reversed ? `after ${totals((r) => r.reversedCny)} returned from orders` : hasDeposits ? "order deposits included" : "on new orders, or applied"}
          />
          <KpiCard size="xs" label="Available balance" value={totals((r) => r.availableCny)} sub="ready for new orders" />
          <KpiCard size="xs" label="Orders" value={formatNumber(account.summary.reduce((sum, r) => sum + r.orders, 0))} sub="that used the advance" />
        </KpiRow>

        {account.summary.length > 0 ? (
          <SectionCard title="By currency" titleGap="none" className="min-w-0">
            <p className="mt-1 text-sm text-muted-foreground">Each currency on its own line: amounts in different currencies are never added together.</p>
            <DataTable className="mt-3" variant="embedded" columns={currencyColumns} data={account.summary} getRowId={(row) => row.currency} size="sm" />
          </SectionCard>
        ) : null}

        <Callout size="sm">
          A deposit paid with an order is part of this advance, applied to that order. Anything paid beyond an order&apos;s value is an excess
          payment: available here for new orders. Each payment counts once. Supplier deposits (Deposits › Suppliers) are separate.
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

        <SectionCard title="Transaction history" titleGap="none" className="min-w-0">
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <FilterSelect label="Transaction type" size="sm" value={filters.kind ?? ALL} options={KIND_OPTIONS} onValueChange={(v) => set("kind")(v === ALL ? null : (v as AdvanceHistoryKind))} />
            <label htmlFor={`${id}-from`} className="text-xs text-muted-foreground">
              From
            </label>
            <Input id={`${id}-from`} type="date" size="sm" className={DATE_INPUT} value={filters.from} max={filters.to || undefined} onChange={(e) => set("from")(e.target.value)} />
            <label htmlFor={`${id}-to`} className="text-xs text-muted-foreground">
              To
            </label>
            <Input id={`${id}-to`} type="date" size="sm" className={DATE_INPUT} value={filters.to} min={filters.from || undefined} onChange={(e) => set("to")(e.target.value)} />
            <SearchInput label="Search reference or PO" placeholder="Reference or PO" value={filters.po} onValueChange={set("po")} size="md" className="w-[180px] bg-card" />
            {isAdvanceFiltered(filters) ? (
              <button type="button" className={rowActionClass} onClick={() => setFilters(EMPTY_ADVANCE_FILTERS)}>
                Clear filters
              </button>
            ) : null}
          </div>
          {history.length === 0 ? (
            <div className="mt-4 flex flex-col items-center gap-3 rounded-[10px] border border-dashed px-4 py-8 text-center">
              <p className="text-sm font-bold">No advance recorded for this supplier yet.</p>
              <p className="max-w-[460px] text-sm text-muted-foreground">
                Record money paid to {supplier.name} before any order: its new orders then use it by themselves.
              </p>
              {addAdvance}
            </div>
          ) : (
            <DataTable
              key={JSON.stringify(filters)}
              className="mt-3"
              variant="embedded"
              sortable
              columns={entryColumns(supplier.name, account, linkPo, canDelete)}
              data={entries}
              getRowId={(row) => row.id}
              size="sm"
              emptyState="No transactions match these filters."
              pagination={{ pageSize: PAGE_SIZE, itemLabel: "transactions" }}
            />
          )}
        </SectionCard>
      </PageContainer>
    </>
  );
}
