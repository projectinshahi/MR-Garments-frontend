"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/shared/data-table";
import type { OrderPayment } from "@/features/order-detail/data/queries";
import { formatCNY, formatDate, formatINR, formatRate } from "@/lib/formatters";

type Totals = { paidCny: number; paidInr: number };
/** A payment with its INR value at its own rate; null for a payment not made yet (no rate). */
export type PaymentRow = OrderPayment & { inr: number | null };

function columns(totals: Totals): ColumnDef<PaymentRow>[] {
  return [
    {
      id: "date",
      header: "Date",
      cell: ({ row }) => {
        const date = row.original.paidOn ?? row.original.dueDate;
        return date ? formatDate(date) : "–";
      },
      footer: "Total paid",
    },
    { accessorKey: "kind", header: "Type" },
    { accessorKey: "payee", header: "Paid to" },
    {
      accessorKey: "amountCny",
      header: "Amount",
      cell: ({ row }) => formatCNY(row.original.amountCny),
      footer: () => formatCNY(totals.paidCny),
      meta: { align: "right" },
    },
    {
      accessorKey: "rateInr",
      header: "Rate",
      cell: ({ row }) => (row.original.rateInr === null ? "–" : formatRate(row.original.rateInr)),
      meta: { align: "right" },
    },
    {
      id: "inr",
      header: "In INR",
      cell: ({ row }) => (row.original.inr === null ? "–" : formatINR(row.original.inr)),
      footer: () => formatINR(totals.paidInr),
      meta: { align: "right", className: "font-bold" },
    },
  ];
}

export function PaymentsTable({ rows, totals }: { rows: PaymentRow[]; totals: Totals }) {
  return (
    <DataTable
      columns={columns(totals)}
      data={rows}
      getRowId={(payment) => payment.id}
      density="snug"
      size="sm"
      emptyState="No payments recorded yet."
    />
  );
}
