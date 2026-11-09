"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/shared/data-table";
import type { OrderPayment } from "@/features/order-detail/data/queries";
import { ACTIONS_COLUMN_CLASS } from "@/features/order-detail/shared/delete-record";
import { DeletePaymentButton, type PaymentOrderFacts } from "@/features/payments/delete-payment";
import { formatDate, formatINR, formatMoney, formatRate } from "@/lib/formatters";
import type { Currency } from "@/types/domain";

/** `currency`: the order's, which its payments are in. Paid totals count every payee (ORD-4 `paidCny`/`paidInr`). */
type Totals = { paidCny: number; paidInr: number; currency: Currency };

/** `remove`: the order's figures for PAY-3's Actions column (payments Full), or null without it. */
function columns(totals: Totals, remove: PaymentOrderFacts | null): ColumnDef<OrderPayment>[] {
  return [
    {
      id: "date",
      header: "Date",
      cell: ({ row }) => {
        const date = row.original.paidOn ?? row.original.dueDate;
        return date ? formatDate(date) : "–";
      },
      footer: "Total paid (all payees)",
    },
    { accessorKey: "kind", header: "Type" },
    { accessorKey: "payee", header: "Paid to" },
    {
      accessorKey: "amountCny",
      header: "Amount",
      cell: ({ row }) => formatMoney(row.original.amountCny, totals.currency),
      footer: () => formatMoney(totals.paidCny, totals.currency),
      meta: { align: "right" },
    },
    {
      accessorKey: "rateInr",
      header: "Rate",
      cell: ({ row }) => (row.original.rateInr === null ? "–" : formatRate(row.original.rateInr)),
      meta: { align: "right" },
    },
    {
      // The API's figure at the payment's own rate (ORD-4 `amountInr`); null while due.
      accessorKey: "amountInr",
      header: "In INR",
      cell: ({ row }) => (row.original.amountInr === null ? "–" : formatINR(row.original.amountInr)),
      footer: () => formatINR(totals.paidInr),
      meta: { align: "right", className: "font-bold" },
    },
    // The table has no Status column, so Actions comes last.
    ...(remove
      ? [
          {
            id: "actions",
            header: "Actions",
            meta: { className: `w-[72px] ${ACTIONS_COLUMN_CLASS}` },
            cell: ({ row }) => <DeletePaymentButton payment={row.original} order={remove} />,
          } satisfies ColumnDef<OrderPayment>,
        ]
      : []),
  ];
}

export function PaymentsTable({ rows, totals, remove = null }: { rows: OrderPayment[]; totals: Totals; remove?: PaymentOrderFacts | null }) {
  return (
    <DataTable
      columns={columns(totals, remove)}
      data={rows}
      getRowId={(payment) => payment.id}
      density="snug"
      size="sm"
      emptyState="No payments recorded yet."
    />
  );
}
