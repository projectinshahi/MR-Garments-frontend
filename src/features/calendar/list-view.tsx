"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";

import { PageContainer } from "@/components/layout/page-header";
import { DataTable } from "@/components/shared/data-table";
import { FilterChips } from "@/components/shared/filters";
import { StatusPill } from "@/components/shared/status-pill";
import { formatQty, formatShortDate } from "@/lib/formatters";
import type { Tone } from "@/types/domain";

import { PoButton, PrototypeSelect } from "./controls";
import type { CalendarData, Delivery, DeliveryStatus } from "./data/queries";
import { supplierOptions } from "./deliveries";

const STATUS_TONE: Record<DeliveryStatus, Tone> = { late: "danger", "due-soon": "warning", "on-track": "success" };

const STATUS_FILTERS: { value: DeliveryStatus; label: string }[] = [
  { value: "late", label: "Late" },
  { value: "due-soon", label: "Due within 2 days" },
  { value: "on-track", label: "On track" },
];

// Widths put each column where 20_6.c_List.jpeg has it; Status takes the rest.
const columns: ColumnDef<Delivery>[] = [
  { accessorKey: "due", header: "Due date", meta: { className: "w-[128px]" }, cell: ({ row }) => formatShortDate(row.original.due) },
  { accessorKey: "po", header: "PO", meta: { className: "w-[138px]" }, cell: ({ row }) => <PoButton po={row.original.po} className="font-bold" /> },
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

/** c List (20_6.c_List.jpeg): every delivery in due order, filtered client-side by the status chips. */
export function ListView({ deliveries }: CalendarData) {
  const [status, setStatus] = useState("all");
  const rows = status === "all" ? deliveries : deliveries.filter((d) => d.status === status);
  const options = [
    { value: "all", label: `All (${deliveries.length})` },
    ...STATUS_FILTERS.map((f) => ({ value: f.value, label: `${f.label} (${deliveries.filter((d) => d.status === f.value).length})` })),
  ];

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <PrototypeSelect label="Supplier" options={supplierOptions(deliveries)} action="Filter by supplier" />
          <PrototypeSelect label="Date range" options={[{ value: "next-30", label: "Next 30 days" }]} action="Change date range" />
        </div>
        <FilterChips label="Delivery status" options={options} value={status} onValueChange={setStatus} size="sm" />
      </div>
      <DataTable columns={columns} data={rows} getRowId={(d) => d.po} density="short" size="sm" emptyState="No deliveries." />
    </PageContainer>
  );
}
