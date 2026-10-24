"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/shared/data-table";
import { formatCNY, formatDate, formatINR, formatRate } from "@/lib/formatters";

import type { PaymentRow } from "./data/queries";

type Totals = { paid: number; paidInr: number };

function columns(totals: Totals): ColumnDef<PaymentRow>[] {
  return [
    { accessorKey: "date", header: "Date", cell: ({ row }) => formatDate(row.original.date), footer: "Total paid" },
    { accessorKey: "type", header: "Type" },
    { accessorKey: "paidTo", header: "Paid to" },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => formatCNY(row.original.amount),
      footer: () => formatCNY(totals.paid),
      meta: { align: "right" },
    },
    { accessorKey: "rate", header: "Rate", cell: ({ row }) => formatRate(row.original.rate), meta: { align: "right" } },
    {
      accessorKey: "inr",
      header: "In INR",
      cell: ({ row }) => formatINR(row.original.inr),
      footer: () => formatINR(totals.paidInr),
      meta: { align: "right", className: "font-bold" },
    },
  ];
}

export function PaymentsTable({ rows, totals }: { rows: PaymentRow[]; totals: Totals }) {
  return <DataTable columns={columns(totals)} data={rows} getRowId={(r) => `${r.date}-${r.type}`} density="snug" size="sm" />;
}
