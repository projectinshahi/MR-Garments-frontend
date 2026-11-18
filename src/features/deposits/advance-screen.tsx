"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useNavigate } from "@/components/layout/navigation-progress";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { RouteTabs } from "@/components/layout/route-tabs";
import { Callout } from "@/components/shared/cards";
import { DataTable } from "@/components/shared/data-table";
import { FilterSelect, SearchInput } from "@/components/shared/filters";
import { ReportDownload } from "@/features/reports/report-actions";
import type { AdvanceSummary } from "@/lib/api/deposits-types";
import { formatNumber } from "@/lib/formatters";

import type { AdvanceOverviewData } from "./data/queries";
import { filterSupplierRows, netApplied, type OverviewFilters, recordedOf, supplierAdvanceRows, type SupplierAdvanceRow } from "./advance-logic";
import { advanceOverviewFile } from "./deposit-files";
import { DEPOSIT_TABS } from "./deposits-screen";
import { amountText } from "./deposits-logic";

// Deposits › Supplier advance, supplier-wise (backend docs/supplier-advance.md), no reference design: the Deposits tab
// parts (header, RouteTabs, filter row, the list table). Every supplier on its own row with its advance account per
// currency, straight from the ledger's totals (DEP-1 `advances`): never one overall total, never two currencies added.
// A row opens the supplier's page (/deposits/advance/<id>): its transactions, Add advance and Apply advance.

const PAGE_SIZE = 10;
const SHOW_OPTIONS = [
  { value: "all", label: "All suppliers" },
  { value: "advance", label: "With an advance" },
];
export const advanceHref = (supplierId: string) => `/deposits/advance/${encodeURIComponent(supplierId)}`;

/** One line per currency the supplier has an advance in ("¥12,000" above "$500"); a dash without one. */
function Amounts({ accounts, pick, bold = false }: { accounts: AdvanceSummary[]; pick: (row: AdvanceSummary) => number; bold?: boolean }) {
  if (accounts.length === 0) return <span className="text-muted-foreground">–</span>;
  return (
    <span className={bold ? "flex flex-col items-end font-bold" : "flex flex-col items-end"}>
      {accounts.map((row) => (
        <span key={row.currency} className="whitespace-nowrap">
          {amountText(pick(row), row.currency)}
        </span>
      ))}
    </span>
  );
}

const columns: ColumnDef<SupplierAdvanceRow>[] = [
  {
    accessorKey: "supplier",
    header: "Supplier",
    cell: ({ row }) => (
      <span className="flex flex-col">
        <Link href={advanceHref(row.original.supplierId)} className="font-bold hover:underline" onClick={(event) => event.stopPropagation()}>
          {row.original.supplier}
        </Link>
        <span className="text-[12.5px] text-muted-foreground">
          {row.original.accounts.length === 0
            ? "No advance yet"
            : `${row.original.accounts.map((a) => a.currency).join(" · ")} · ${row.original.orders ? `${formatNumber(row.original.orders)} order${row.original.orders === 1 ? "" : "s"} used it` : "not used yet"}`}
        </span>
      </span>
    ),
  },
  { id: "received", header: "Advance recorded", meta: { align: "right" }, cell: ({ row }) => <Amounts accounts={row.original.accounts} pick={recordedOf} /> },
  { id: "applied", header: "Applied to orders (net)", meta: { align: "right" }, cell: ({ row }) => <Amounts accounts={row.original.accounts} pick={netApplied} /> },
  { id: "available", header: "Available balance", meta: { align: "right" }, cell: ({ row }) => <Amounts accounts={row.original.accounts} pick={(a) => a.availableCny} bold /> },
  {
    id: "open",
    header: () => <span className="sr-only">Open</span>,
    meta: { className: "w-px whitespace-nowrap" },
    cell: ({ row }) => (
      <Link
        href={advanceHref(row.original.supplierId)}
        aria-label={`Open ${row.original.supplier}'s advance`}
        className="inline-flex items-center gap-0.5 text-sm font-bold text-primary hover:underline"
        onClick={(event) => event.stopPropagation()}
      >
        View <ChevronRight className="size-4" aria-hidden />
      </Link>
    ),
  },
];

export function AdvanceOverviewScreen({ data }: { data: AdvanceOverviewData }) {
  const navigate = useNavigate();
  const rows = supplierAdvanceRows(data.suppliers, data.advances);
  const [filters, setFilters] = useState<OverviewFilters>({ query: "", withAdvance: false });
  const shown = filterSupplierRows(rows, filters);
  const holding = rows.filter((row) => row.accounts.length > 0).length;
  const describe = [filters.withAdvance ? "With an advance" : null, filters.query.trim() ? `Supplier contains "${filters.query.trim()}"` : null].filter(Boolean).join(" · ");

  return (
    <>
      <PageHeader title="Deposits" actions={<ReportDownload size="header" file={() => advanceOverviewFile(shown, describe || "All suppliers", data.today)} />} />
      <RouteTabs tabs={DEPOSIT_TABS} label="Deposits views" />
      <PageContainer>
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            label="Search supplier"
            placeholder="Search supplier"
            value={filters.query}
            onValueChange={(query) => setFilters((f) => ({ ...f, query }))}
            size="md"
            className="w-[240px] bg-card max-sm:w-full"
          />
          <FilterSelect
            label="Show"
            size="sm"
            value={filters.withAdvance ? "advance" : "all"}
            options={SHOW_OPTIONS}
            onValueChange={(value) => setFilters((f) => ({ ...f, withAdvance: value === "advance" }))}
          />
          <span className="text-sm text-muted-foreground">
            {formatNumber(holding)} of {formatNumber(rows.length)} suppliers hold an advance
          </span>
        </div>
        <Callout size="sm">
          Each supplier&apos;s advance is shown on its own, per currency: amounts in different currencies or of different suppliers are never added
          together. It includes the deposits paid with orders, applied to those orders. Open a supplier to see its transactions, add an advance or
          apply it to orders.
        </Callout>
        <DataTable
          columns={columns}
          data={shown}
          getRowId={(row) => row.supplierId}
          size="sm"
          header="tall"
          onRowClick={(row) => navigate(advanceHref(row.supplierId))}
          emptyState={rows.length === 0 ? "No suppliers yet. Add one under Suppliers." : "No suppliers match these filters."}
          pagination={{ pageSize: PAGE_SIZE, itemLabel: "suppliers" }}
        />
      </PageContainer>
    </>
  );
}
