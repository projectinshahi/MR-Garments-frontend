"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/shared/data-table";
import type { OrderPayment } from "@/features/order-detail/data/queries";
import { ACTIONS_COLUMN_CLASS } from "@/features/order-detail/shared/delete-record";
import { DASH, moneyOrDash, PaymentStatus, paymentType } from "@/features/payments/money";
import { VoidPaymentButton } from "@/features/payments/void-payment";
import type { SettlementSlice } from "@/lib/api/ledger-types";
import { formatDate, formatINR, formatMoney, formatRate } from "@/lib/formatters";
import type { Currency } from "@/types/domain";

const right = { align: "right" } as const;
const rateOf = (rate: number | null, currency: Currency) => (currency === "INR" || rate === null ? DASH : formatRate(rate));

/**
 * The payments recorded against this PO (ORD-4 `payments`): legacy supplier payments (a memo: they are on the supplier's
 * account and settle its orders oldest first) and shipping-agent payments (sea freight). Voided ones stay listed,
 * flagged. `canVoid`: PAY-3's Void (payments Full).
 */
function paymentColumns(canVoid: boolean): ColumnDef<OrderPayment>[] {
  return [
    {
      id: "date",
      header: "Date",
      cell: ({ row }) => {
        const date = row.original.paidOn ?? row.original.dueDate;
        return date ? formatDate(date) : DASH;
      },
    },
    { id: "type", header: "Type", cell: ({ row }) => paymentType(row.original) },
    { accessorKey: "payee", header: "Paid to" },
    {
      accessorKey: "amountCny",
      header: "Amount",
      meta: right,
      cell: ({ row }) => <span className={row.original.voided ? "line-through" : undefined}>{formatMoney(row.original.amountCny, row.original.currency, { decimals: 2 })}</span>,
    },
    { accessorKey: "rateInr", header: "Rate", meta: right, cell: ({ row }) => rateOf(row.original.rateInr, row.original.currency) },
    // The API's figure at the payment's own rate; null while due.
    { accessorKey: "amountInr", header: "In INR", meta: { align: "right", className: "font-bold" }, cell: ({ row }) => moneyOrDash(row.original.amountInr, formatINR) },
    { id: "status", header: "Status", cell: ({ row }) => <PaymentStatus payment={row.original} /> },
    ...(canVoid
      ? [
          {
            id: "actions",
            header: "Actions",
            meta: { className: `w-[72px] ${ACTIONS_COLUMN_CLASS}` },
            cell: ({ row }) => <VoidPaymentButton payment={row.original} voided={row.original.voided} />,
          } satisfies ColumnDef<OrderPayment>,
        ]
      : []),
  ];
}

export function PaymentsTable({ rows, canVoid = false }: { rows: OrderPayment[]; canVoid?: boolean }) {
  return <DataTable columns={paymentColumns(canVoid)} data={rows} getRowId={(payment) => payment.id} density="snug" size="sm" emptyState="No payment names this PO." />;
}

/** "Settled by": the credits that settled the order, oldest first (ORD-4 `slices`), each at its own rate. */
export function SlicesTable({ slices, currency, settledCny, settledInr }: { slices: SettlementSlice[]; currency: Currency; settledCny: number | null; settledInr: number | null }) {
  const columns: ColumnDef<SettlementSlice>[] = [
    { accessorKey: "entryDate", header: "Date", cell: ({ row }) => formatDate(row.original.entryDate), footer: "Settled" },
    {
      id: "source",
      header: "From",
      cell: ({ row }) =>
        row.original.entryType === "adjustment" ? "Adjustment" : `Payment${row.original.memoPo ? ` (recorded against ${row.original.memoPo})` : row.original.advanceEntryId ? " (legacy advance)" : ""}`,
    },
    { accessorKey: "mode", header: "Mode", cell: ({ row }) => row.original.mode || DASH },
    { accessorKey: "reference", header: "Reference", cell: ({ row }) => row.original.reference || DASH },
    {
      accessorKey: "amount",
      header: "Amount",
      meta: right,
      cell: ({ row }) => formatMoney(row.original.amount, currency, { decimals: 2 }),
      footer: () => moneyOrDash(settledCny, (v) => formatMoney(v, currency, { decimals: 2 })),
    },
    { accessorKey: "exchangeRate", header: "Rate", meta: right, cell: ({ row }) => rateOf(row.original.exchangeRate, currency) },
    {
      accessorKey: "amountInr",
      header: "In INR",
      meta: { align: "right", className: "font-bold" },
      cell: ({ row }) => moneyOrDash(row.original.amountInr, formatINR),
      footer: () => moneyOrDash(settledInr, formatINR),
    },
  ];
  return <DataTable columns={columns} data={slices} getRowId={(slice) => slice.entryId} density="snug" size="sm" emptyState="Nothing has settled this order yet." />;
}
