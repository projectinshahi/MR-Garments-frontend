"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";

import { useNavigate } from "@/components/layout/navigation-progress";
import { DataTable } from "@/components/shared/data-table";
import { FilterChips, FilterSelect, SearchInput, type FilterOption } from "@/components/shared/filters";
import { PoLink } from "@/components/shared/po-link";
import { StageProgress } from "@/components/shared/progress";
import { StatusPill } from "@/components/shared/status-pill";
import { formatINR, formatQty, formatShortDate } from "@/lib/formatters";
import { STAGES } from "@/types/domain";

import type { OrderRow, OrdersListData } from "./data/queries";
import { filterOrders, type OrderChip } from "./filter-orders";

const ALL = "all";
const PAGE_SIZE = 10;

const STAGE_OPTIONS: FilterOption[] = [
  { value: ALL, label: "All stages" },
  ...STAGES.map((name, index) => ({ value: String(index + 1), label: `${index + 1}. ${name}` })),
];

// The row opens the order too; the link keeps it keyboard-reachable. Stopping its click avoids a second navigation.
function PoCell({ order }: { order: OrderRow }) {
  return (
    <span onClick={(event) => event.stopPropagation()}>
      <PoLink po={order.po} linked />
    </span>
  );
}

// Widths from 05_3_Orders_list.jpeg. The reference pads cells 14.4 px; DataTable pads 20 px, so the five left columns
// end up at their content width. Stage (no width) takes the rest, which keeps Status and Paid so far where the reference has them.
const columns: ColumnDef<OrderRow>[] = [
  { accessorKey: "po", header: "PO", meta: { className: "w-[84px]" }, cell: ({ row }) => <PoCell order={row.original} /> },
  { accessorKey: "item", header: "Item", meta: { className: "w-[160px]" } },
  { accessorKey: "supplier", header: "Supplier", meta: { className: "w-[180px]" } },
  {
    id: "quantity",
    header: "Quantity",
    meta: { className: "w-[103px]" },
    cell: ({ row }) => formatQty(row.original.quantity, row.original.unit),
  },
  {
    accessorKey: "deliveryDate",
    header: "Delivery date",
    meta: { className: "w-[112px]" },
    cell: ({ row }) => formatShortDate(row.original.deliveryDate),
  },
  { accessorKey: "stage", header: "Stage", cell: ({ row }) => <StageProgress stage={row.original.stage} /> },
  {
    accessorKey: "status",
    header: "Status",
    meta: { className: "w-[147px]" },
    cell: ({ row }) => <StatusPill tone={row.original.tone}>{row.original.status}</StatusPill>,
  },
  {
    accessorKey: "paidInr",
    header: "Paid so far (INR)",
    meta: { align: "right", className: "w-[137px]" },
    cell: ({ row }) => formatINR(row.original.paidInr),
  },
];

/** Filter row and the orders table. Every order is loaded; filters and pages run on the client. */
export function OrdersList({ orders, counts, supplierNames }: OrdersListData) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState(ALL);
  const [supplier, setSupplier] = useState(ALL);
  const [chip, setChip] = useState<OrderChip>("all");

  const chips = [
    { value: "all", label: `All ${counts.all}` },
    { value: "late", label: `Late ${counts.late}`, tone: "danger" },
    { value: "dueSoon", label: `Due soon ${counts.dueSoon}` },
    { value: "shortReceived", label: `Short received ${counts.shortReceived}` },
    { value: "completed", label: "Completed" },
  ] satisfies (FilterOption & { value: OrderChip })[];
  const supplierOptions: FilterOption[] = [{ value: ALL, label: "All suppliers" }, ...supplierNames.map((name) => ({ value: name, label: name }))];

  const filters = {
    query,
    stage: stage === ALL ? null : Number(stage),
    supplier: supplier === ALL ? null : supplier,
    chip,
  };
  const rows = filterOrders(orders, filters);

  return (
    // 16 px between the filter row and the table in the reference (the page gap is 18).
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          label="Search PO, item or supplier"
          placeholder="Search PO, item or supplier"
          value={query}
          onValueChange={setQuery}
          // 290 px as in the reference, shrinking (down to 200 px) before the chips wrap: the shared selects and chips
          // are wider than in the reference.
          className="w-full sm:w-auto sm:max-w-[290px] sm:flex-[1_1_200px]"
        />
        <FilterSelect label="Stage" showLabel size="sm" value={stage} options={STAGE_OPTIONS} onValueChange={setStage} />
        <FilterSelect label="Supplier" showLabel size="sm" value={supplier} options={supplierOptions} onValueChange={setSupplier} />
        <FilterChips
          label="Order status"
          size="sm"
          options={chips}
          value={chip}
          onValueChange={(value) => setChip(chips.find((c) => c.value === value)?.value ?? "all")}
          className="ml-auto"
        />
      </div>
      <DataTable
        // Remount on a filter change so the pager returns to page 1.
        key={JSON.stringify(filters)}
        columns={columns}
        data={rows}
        getRowId={(order) => order.po}
        density="tall"
        size="sm"
        header="tall"
        onRowClick={(order) => navigate(`/orders/${order.po}`)}
        emptyState={orders.length === 0 ? "No orders yet." : "No orders match these filters."}
        pagination={{ pageSize: PAGE_SIZE, itemLabel: "orders" }}
      />
    </div>
  );
}
