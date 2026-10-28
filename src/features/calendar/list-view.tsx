"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { PageContainer } from "@/components/layout/page-header";
import { DataTable } from "@/components/shared/data-table";
import { FilterChips } from "@/components/shared/filters";
import { PoLink } from "@/components/shared/po-link";
import { StatusPill } from "@/components/shared/status-pill";
import { formatQty, formatShortDate } from "@/lib/formatters";
import type { Tone } from "@/types/domain";

import { ParamSelect } from "./controls";
import type { Delivery, DeliveryStatus } from "./data/queries";
import { RANGE_OPTIONS } from "./params";

const STATUS_TONE: Record<DeliveryStatus, Tone> = { late: "danger", "due-soon": "warning", "on-track": "success" };

const STATUS_FILTERS: { value: DeliveryStatus; label: string }[] = [
  { value: "late", label: "Late" },
  { value: "due-soon", label: "Due within 7 days" },
  { value: "on-track", label: "On track" },
];

// Widths put each column where 20_6.c_List.jpeg has it; Status takes the rest.
const columnsFor = (linkOrders: boolean): ColumnDef<Delivery>[] => [
  { accessorKey: "due", header: "Due date", meta: { className: "w-[128px]" }, cell: ({ row }) => formatShortDate(row.original.due) },
  { accessorKey: "po", header: "PO", meta: { className: "w-[138px]" }, cell: ({ row }) => <PoLink po={row.original.po} linked={linkOrders} /> },
  { accessorKey: "supplier", header: "Supplier", meta: { className: "w-[279px]" } },
  { accessorKey: "item", header: "Item", meta: { className: "w-[216px]" } },
  {
    accessorKey: "quantity",
    header: "Quantity",
    meta: { className: "w-[165px]" },
    cell: ({ row }) => formatQty(row.original.quantity, row.original.unit),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusPill tone={STATUS_TONE[row.original.status]}>{row.original.statusLabel}</StatusPill>,
  },
];

/**
 * c List (20_6.c_List.jpeg): the deliveries in due order, already filtered by the page on `?supplier=` and `?range=`
 * (`filtered` says whether either is set), then client-side by the status chips.
 */
export function ListView({ deliveries, filtered, linkOrders }: { deliveries: Delivery[]; filtered: boolean; linkOrders: boolean }) {
  const [status, setStatus] = useState("all");
  const columns = useMemo(() => columnsFor(linkOrders), [linkOrders]);
  const rows = status === "all" ? deliveries : deliveries.filter((d) => d.status === status);
  const options = [
    { value: "all", label: `All (${deliveries.length})` },
    ...STATUS_FILTERS.map((f) => ({ value: f.value, label: `${f.label} (${deliveries.filter((d) => d.status === f.value).length})` })),
  ];

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ParamSelect param="range" label="Date range" options={RANGE_OPTIONS} size="sm" />
        <FilterChips label="Delivery status" options={options} value={status} onValueChange={setStatus} size="sm" />
      </div>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(d) => d.po}
        density="short"
        size="sm"
        emptyState={filtered || status !== "all" ? "No deliveries match these filters." : "No deliveries."}
      />
    </PageContainer>
  );
}
