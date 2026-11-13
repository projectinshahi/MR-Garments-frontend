"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Ellipsis, Eye, Pencil, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useRef, useState } from "react";

import { LinkPending } from "@/components/layout/navigation-progress";
import { DeactivateConfirm } from "@/components/shared/confirm-dialog";
import { DataTable } from "@/components/shared/data-table";
import { FilterSelect, SearchInput } from "@/components/shared/filters";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ACTIONS_COLUMN_CLASS } from "@/features/order-detail/shared/delete-record";
import { ReportDownload } from "@/features/reports/report-actions";
import { describeFilters } from "@/features/reports/report-files";
import { DEACTIVATE_NOTE, SupplierDialog } from "@/features/settings/add-supplier-dialog";
import { addHref, editHref } from "@/features/settings/settings-dialog";
import { exchangeRateText, type StatusFilter, type SupplierDraft } from "@/features/settings/settings-logic";
import { apiClient } from "@/lib/api/client";
import type { CurrencyInfo, SupplierRow } from "@/lib/api/types";
import { handleApiError, notifySuccess } from "@/lib/feedback";
import { formatNumber } from "@/lib/formatters";
import { todayInIndia } from "@/lib/today";
import { cn } from "@/lib/utils";
import type { MoneyTotal } from "@/types/domain";

import { countryCode } from "./countries";
import { suppliersListFile } from "./supplier-files";
import { countryOptions, filterSuppliers, moneyText } from "./suppliers-logic";

const PATH = "/suppliers";
const STATUS_OPTIONS = [
  { value: "All", label: "All" },
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
];
const PAGE_SIZES = [5, 10, 25, 50];
const right = { align: "right" } as const;
// The reference draws the three row actions in blue.
const iconAction = "inline-flex size-8 items-center justify-center rounded-md text-primary outline-none hover:bg-info-soft focus-visible:ring-3 focus-visible:ring-ring/50 [&>svg]:size-4";
const viewHref = (row: SupplierRow) => `${PATH}/${row.id}`;
/** Sorts a money column by its first currency's amount (CNY, then USD, then INR). */
const firstAmount = (totals: MoneyTotal[]) => totals[0]?.amount ?? 0;

/**
 * Supplier List (backend docs/suppliers.md), as the reference draws it: one card holding the toolbar (count, search,
 * Status and Country selects, Add) and the sortable, paged table with row selection, then the row actions: View (the
 * supplier's page), Edit (the dialog) and More (View, Edit, Activate / Deactivate). Deactivating asks first, as the
 * Settings tab does; a supplier with orders is never deleted here. Search, status and country stay client-side over
 * the loaded rows (filterSuppliers). Money columns show bare numbers under a "(¥)" header while every amount is in
 * yuan, and carry their symbols once another currency appears (as the Payments by order list does).
 */
export function SuppliersList({ suppliers, draft, currencies }: { suppliers: SupplierRow[]; draft: SupplierDraft; currencies: CurrencyInfo[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("All");
  const [country, setCountry] = useState("all");
  // The supplier waiting for the deactivate confirmation.
  const [deactivating, setDeactivating] = useState<SupplierRow | null>(null);
  const visible = filterSuppliers(suppliers, { query, status, country });
  // The visible rows in the table's sort order (every page), so the download keeps a header sort.
  const sorted = useRef<SupplierRow[] | null>(null);
  const yuanOnly = suppliers.every((row) => [...row.ytdValue, ...row.balance].every((total) => total.currency === "CNY"));
  const money = (totals: MoneyTotal[]) => (yuanOnly ? (totals.length ? formatNumber(totals[0]!.amount) : "–") : moneyText(totals));

  async function setStatusOf(row: SupplierRow, next: "Active" | "Inactive") {
    try {
      await apiClient.patch(`/suppliers/${row.id}`, { status: next });
    } catch (error) {
      handleApiError(error);
      return;
    }
    setDeactivating(null);
    notifySuccess(next === "Active" ? "Supplier activated" : "Supplier deactivated");
    router.refresh();
  }

  const columns: ColumnDef<SupplierRow>[] = [
    {
      id: "select",
      enableSorting: false,
      meta: { className: "w-10 pr-0" },
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all suppliers on this page"
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(checked) => table.toggleAllPageRowsSelected(!!checked)}
          className="size-4"
        />
      ),
      cell: ({ row }) => (
        <Checkbox aria-label={`Select ${row.original.name}`} checked={row.getIsSelected()} onCheckedChange={(checked) => row.toggleSelected(!!checked)} className="size-4" />
      ),
    },
    { accessorKey: "code", header: "Supplier Code", meta: { className: "w-[108px]" } },
    {
      accessorKey: "name",
      header: "Supplier Name",
      cell: ({ row }) => (
        <Link href={viewHref(row.original)} className="rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
          {row.original.name}
          <LinkPending />
        </Link>
      ),
    },
    {
      accessorKey: "country",
      enableSorting: false,
      header: "Country",
      meta: { className: "w-[100px]" },
      cell: ({ row }) =>
        row.original.country ? (
          <span className="inline-flex items-center gap-1.5">
            {countryCode(row.original.country) ? (
              <span aria-hidden className="inline-flex h-4 items-center rounded-[4px] bg-danger-soft px-1 text-[10px] leading-none font-bold text-danger">
                {countryCode(row.original.country)}
              </span>
            ) : null}
            {row.original.country}
          </span>
        ) : (
          "–"
        ),
    },
    { accessorKey: "contactPerson", enableSorting: false, header: "Contact Person", cell: ({ row }) => row.original.contactPerson || "–" },
    {
      id: "contact",
      enableSorting: false,
      header: "Email / Phone",
      cell: ({ row }) => (
        <span className="flex flex-col text-[13px] leading-[18px]">
          <span>{row.original.email || "–"}</span>
          <span>{row.original.phone || "–"}</span>
        </span>
      ),
    },
    { accessorKey: "currency", header: "Currency", meta: { className: "w-[84px]" }, cell: ({ row }) => <span className="font-bold">{row.original.currency}</span> },
    {
      // INR per 1 unit of the supplier's currency (docs/supplier-currency.md); "Not set" until the supplier is edited with one.
      accessorKey: "exchangeRate",
      header: "Exchange Rate",
      meta: { ...right, className: "w-[108px]" },
      cell: ({ row }) => <span className={cn(row.original.exchangeRate === null && "text-muted-foreground")}>{exchangeRateText(row.original.currency, row.original.exchangeRate)}</span>,
    },
    {
      // Not closed (phase 2 §1), the Open POs card's rule; the Settings tab's "Open orders" (stage < 6) is a different count.
      accessorKey: "openPos",
      enableSorting: false,
      header: "Active POs",
      meta: { align: "center", className: "w-[92px]" },
      cell: ({ row }) => (
        <span className="inline-flex h-6 min-w-8 items-center justify-center rounded-md bg-info-soft px-2 text-[13px] font-bold text-primary">
          {formatNumber(row.original.openPos)}
        </span>
      ),
    },
    { id: "ytdValue", accessorFn: (row) => firstAmount(row.ytdValue), enableSorting: false, header: yuanOnly ? "YTD Value (¥)" : "YTD Value", meta: { ...right, className: "w-[112px]" }, cell: ({ row }) => money(row.original.ytdValue) },
    {
      id: "balance",
      accessorFn: (row) => firstAmount(row.balance),
      enableSorting: false,
      header: yuanOnly ? "Balance (¥)" : "Balance",
      meta: { ...right, className: "w-[104px]" },
      cell: ({ row }) => money(row.original.balance),
    },
    {
      accessorKey: "status",
      enableSorting: false,
      header: "Status",
      meta: { className: "w-[88px]" },
      cell: ({ row }) => <StatusPill tone={row.original.status === "Active" ? "success" : "neutral"}>{row.original.status}</StatusPill>,
    },
    {
      id: "actions",
      enableSorting: false,
      header: "Actions",
      meta: { className: cn(ACTIONS_COLUMN_CLASS, "w-[112px]"), align: "center" },
      cell: ({ row }) => {
        const supplier = row.original;
        const active = supplier.status === "Active";
        return (
          <span className="inline-flex items-center gap-0.5">
            <Link href={viewHref(supplier)} aria-label={`View ${supplier.name}`} title="View" className={iconAction}>
              <Eye />
              <LinkPending />
            </Link>
            <Link href={editHref(PATH, supplier.id)} replace scroll={false} aria-label={`Edit ${supplier.name}`} title="Edit" className={iconAction}>
              <Pencil />
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger aria-label={`More actions for ${supplier.name}`} title="More" className={iconAction}>
                <Ellipsis />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href={viewHref(supplier)}>View supplier</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={editHref(PATH, supplier.id)} replace scroll={false}>
                    Edit supplier
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => (active ? setDeactivating(supplier) : setStatusOf(supplier, "Active"))} className={cn(active && "text-danger")}>
                  {active ? "Deactivate supplier" : "Activate supplier"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        );
      },
    },
  ];

  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <h2 className="text-[19px] leading-7 font-bold">Suppliers ({formatNumber(visible.length)})</h2>
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              label="Search supplier name, code or country"
              icon={<Search />}
              placeholder="Search supplier (name, code, country)…"
              value={query}
              onValueChange={setQuery}
              size="md"
              className="w-full bg-card sm:w-[300px]"
            />
            <FilterSelect label="Status" showLabel size="sm" value={status} options={STATUS_OPTIONS} onValueChange={(value) => setStatus(value as StatusFilter)} />
            <FilterSelect label="Country" showLabel size="sm" value={country} options={countryOptions(suppliers)} onValueChange={setCountry} />
            <ReportDownload
              file={() =>
                suppliersListFile(
                  sorted.current ?? visible,
                  describeFilters([
                    query.trim() && `Search: "${query.trim()}"`,
                    status !== "All" && `Status: ${status}`,
                    country !== "all" && `Country: ${country || "Not set"}`,
                  ]),
                  todayInIndia(),
                )
              }
            />
            <Button asChild size="header" className="px-[15px]">
              <Link href={addHref(PATH)} replace scroll={false}>
                <Plus aria-hidden className="size-4" />
                Add Supplier
              </Link>
            </Button>
          </div>
        </div>
        <DataTable
          columns={columns}
          data={visible}
          getRowId={(row) => row.id}
          variant="embedded"
          size="sm"
          header="tall"
          padding="tight"
          sortable
          sortedRows={sorted}
          pagination={{ pageSize: 5, itemLabel: "suppliers", pageSizeOptions: PAGE_SIZES }}
          emptyState={suppliers.length === 0 ? "No suppliers yet. Add the first one with Add Supplier." : "No suppliers match these filters."}
          className="border-t"
        />
      </div>
      <Suspense fallback={null}>
        <SupplierDialog draft={draft} suppliers={suppliers} currencies={currencies} path={PATH} />
      </Suspense>
      <DeactivateConfirm
        open={!!deactivating}
        name={deactivating?.name ?? ""}
        noun="supplier"
        note={DEACTIVATE_NOTE}
        onConfirm={() => (deactivating ? setStatusOf(deactivating, "Inactive") : undefined)}
        onCancel={() => setDeactivating(null)}
      />
    </>
  );
}
