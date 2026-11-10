"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Ellipsis, Eye, Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";

import { LinkPending } from "@/components/layout/navigation-progress";
import { DeactivateConfirm } from "@/components/shared/confirm-dialog";
import { DataTable } from "@/components/shared/data-table";
import { FilterChips, FilterSelect, SearchInput } from "@/components/shared/filters";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ACTIONS_COLUMN_CLASS } from "@/features/order-detail/shared/delete-record";
import { DEACTIVATE_NOTE, SupplierDialog } from "@/features/settings/add-supplier-dialog";
import { addHref, editHref } from "@/features/settings/settings-dialog";
import type { StatusFilter, SupplierDraft } from "@/features/settings/settings-logic";
import { apiClient } from "@/lib/api/client";
import type { SupplierRow } from "@/lib/api/types";
import { handleApiError, notifySuccess } from "@/lib/feedback";
import { formatNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { MoneyTotal } from "@/types/domain";

import { countryCode } from "./countries";
import { countryOptions, filterSuppliers, moneyText } from "./suppliers-logic";

const PATH = "/suppliers";
const STATUS_OPTIONS = [
  { value: "All", label: "All" },
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
];
const PAGE_SIZES = [5, 10, 25, 50];
const right = { align: "right" } as const;
const iconAction = "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-neutral-soft hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 [&>svg]:size-4";
const viewHref = (row: SupplierRow) => `${PATH}/${row.id}`;
/** Sorts a money column by its first currency's amount (CNY, then USD, then INR). */
const firstAmount = (totals: MoneyTotal[]) => totals[0]?.amount ?? 0;

/**
 * Supplier List (backend docs/suppliers.md): the toolbar (count, search, status, country, Add), the sortable, paged
 * table with row selection, and the row actions: View (the supplier's page), Edit (the dialog) and More (View, Edit,
 * Activate / Deactivate). Deactivating asks first, as the Settings tab does; a supplier with orders is never deleted
 * here. Search, status and country stay client-side over the loaded rows (filterSuppliers).
 */
export function SuppliersList({ suppliers, draft }: { suppliers: SupplierRow[]; draft: SupplierDraft }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("All");
  const [country, setCountry] = useState("all");
  // The supplier waiting for the deactivate confirmation.
  const [deactivating, setDeactivating] = useState<SupplierRow | null>(null);
  const visible = filterSuppliers(suppliers, { query, status, country });

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
      meta: { className: "w-[46px] pr-0" },
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
    { accessorKey: "code", header: "Supplier Code", meta: { className: "w-[130px] font-bold" } },
    {
      accessorKey: "name",
      header: "Supplier Name",
      meta: { className: "font-bold" },
      cell: ({ row }) => (
        <Link href={viewHref(row.original)} className="rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
          {row.original.name}
          <LinkPending />
        </Link>
      ),
    },
    {
      accessorKey: "country",
      header: "Country",
      cell: ({ row }) =>
        row.original.country ? (
          <span className="inline-flex items-center gap-1.5">
            {countryCode(row.original.country) ? (
              <span aria-hidden className="inline-flex h-4 items-center rounded-[4px] bg-info-soft px-1 text-[10px] leading-none font-bold text-info">
                {countryCode(row.original.country)}
              </span>
            ) : null}
            {row.original.country}
          </span>
        ) : (
          "–"
        ),
    },
    { accessorKey: "contactPerson", header: "Contact Person", cell: ({ row }) => row.original.contactPerson || "–" },
    {
      id: "contact",
      accessorFn: (row) => row.email || row.phone,
      header: "Email / Phone",
      cell: ({ row }) => (
        <span className="flex flex-col leading-[18px]">
          <span>{row.original.email || "–"}</span>
          <span className="text-[12.5px] text-muted-foreground">{row.original.phone || "–"}</span>
        </span>
      ),
    },
    // Not closed (phase 2 §1), the Open POs card's rule; the Settings tab's "Open orders" (stage < 6) is a different count.
    { accessorKey: "openPos", header: "Active POs", meta: right, cell: ({ row }) => formatNumber(row.original.openPos) },
    { id: "ytdValue", accessorFn: (row) => firstAmount(row.ytdValue), header: "YTD Value", meta: right, cell: ({ row }) => moneyText(row.original.ytdValue) },
    {
      id: "balance",
      accessorFn: (row) => firstAmount(row.balance),
      header: "Balance",
      meta: right,
      cell: ({ row }) => <span className={cn(row.original.balance.some((total) => total.amount > 0) && "font-bold text-danger")}>{moneyText(row.original.balance)}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusPill tone={row.original.status === "Active" ? "success" : "neutral"}>{row.original.status}</StatusPill>,
    },
    {
      id: "actions",
      enableSorting: false,
      header: () => <span className="sr-only">Actions</span>,
      meta: { className: cn(ACTIONS_COLUMN_CLASS, "w-[120px]") },
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base leading-[22px] font-bold">Suppliers ({formatNumber(visible.length)})</h2>
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            label="Search supplier name, code or country"
            placeholder="Search name, code or country"
            value={query}
            onValueChange={setQuery}
            size="md"
            className="w-full bg-card sm:w-[250px]"
          />
          <FilterChips label="Status" size="sm" options={STATUS_OPTIONS} value={status} onValueChange={(value) => setStatus(value as StatusFilter)} />
          <FilterSelect label="Country" size="sm" value={country} options={countryOptions(suppliers)} onValueChange={setCountry} />
          <Button asChild size="header" className="px-[15px]">
            <Link href={addHref(PATH)} replace scroll={false}>
              + Add Supplier
            </Link>
          </Button>
        </div>
      </div>
      <DataTable
        columns={columns}
        data={visible}
        getRowId={(row) => row.id}
        size="sm"
        header="tall"
        sortable
        pagination={{ pageSize: 10, itemLabel: "suppliers", pageSizeOptions: PAGE_SIZES }}
        emptyState={suppliers.length === 0 ? "No suppliers yet. Add the first one with + Add Supplier." : "No suppliers match these filters."}
      />
      <Suspense fallback={null}>
        <SupplierDialog draft={draft} suppliers={suppliers} path={PATH} />
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
