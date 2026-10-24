"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { CardNote, SectionCard } from "@/components/shared/cards";
import { DataTable } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/filters";
import { notInPrototype } from "@/components/shared/prototype";
import { StatusPill } from "@/components/shared/status-pill";
import { formatINR, formatNumber, formatShortDate } from "@/lib/formatters";

import type { OrderPaymentRow } from "./data/queries";
import { filterOrders } from "./filter-orders";
import { PrototypeButton } from "./prototype-button";

// 10 px cell padding and column widths as measured in 16_5_Deposits_&_Payments.jpeg; PO / Supplier takes the rest.
const PAD = "px-2.5 first:pl-2.5 last:pr-2.5";
// Reference header: 12 px text, 3 px below the centre of the 44 px tall-density header row.
const head = (label: string) => <span className="block pt-1.5 text-xs">{label}</span>;

const columns: ColumnDef<OrderPaymentRow>[] = [
  {
    accessorKey: "po",
    header: () => head("PO / Supplier"),
    meta: { className: PAD },
    cell: ({ row }) => (
      <>
        {/* Focusable for keyboard users; Enter or Space bubbles a click to the row handler. */}
        <button
          type="button"
          className="block rounded-sm text-left leading-4 font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {row.original.po}
        </button>
        <span className="block text-[12.5px] leading-4 font-bold text-muted-foreground">{row.original.supplier}</span>
      </>
    ),
  },
  {
    accessorKey: "orderValue",
    header: () => head("Order value (¥)"),
    meta: { align: "right", className: `${PAD} w-[130px]` },
    cell: ({ row }) => formatNumber(row.original.orderValue),
  },
  {
    accessorKey: "paid",
    header: () => head("Paid (¥)"),
    meta: { align: "right", className: `${PAD} w-[70px]` },
    cell: ({ row }) => formatNumber(row.original.paid),
  },
  {
    accessorKey: "paidInr",
    header: () => head("Paid (INR)"),
    meta: { align: "right", className: `${PAD} w-[98.5px]` },
    cell: ({ row }) => formatINR(row.original.paidInr),
  },
  {
    accessorKey: "balance",
    header: () => head("Balance (¥)"),
    meta: { align: "right", className: `${PAD} w-[92.5px]` },
    cell: ({ row }) => formatNumber(row.original.balance),
  },
  {
    accessorKey: "nextDue",
    header: () => head("Next due"),
    meta: { className: `${PAD} w-[99px]` },
    cell: ({ row }) => {
      const { nextDue, nextDueTone } = row.original;
      if (!nextDue) return "Not yet due";
      return nextDueTone ? <StatusPill tone={nextDueTone}>{formatShortDate(nextDue)}</StatusPill> : formatShortDate(nextDue);
    },
  },
];

type PaymentsViewProps = {
  orders: OrderPaymentRow[];
  /** The order whose detail panel is shown (only PO-2041 is designed). */
  selectedPo: string;
  kpis: React.ReactNode;
  detail: React.ReactNode;
};

/** Header search filters the "Payments by order" table; the KPI row and detail card come in as server-rendered slots. */
export function PaymentsView({ orders, selectedPo, kpis, detail }: PaymentsViewProps) {
  const [query, setQuery] = useState("");

  return (
    <>
      <PageHeader
        title="Deposits & Payments"
        actions={
          <>
            <form role="search" className="hidden sm:block" onSubmit={(event) => event.preventDefault()}>
              <SearchInput
                size="sm"
                label="Search PO or supplier"
                placeholder="Search PO or supplier"
                value={query}
                onValueChange={setQuery}
                className="w-[170px] lg:w-[250px]"
              />
            </form>
            <PrototypeButton action="Record payment" size="header">
              + Record payment
            </PrototypeButton>
          </>
        }
      />
      <PageContainer>
        {kpis}
        <div className="grid items-start gap-(--page-gap) lg:grid-cols-[1.6fr_1fr]">
          <SectionCard
            title="Payments by order"
            aside={<CardNote size="sm">Amounts in supplier currency (¥) and INR</CardNote>}
            titleGap="none"
            className="min-w-0 pt-3.5 pb-[18px]"
          >
            <DataTable
              columns={columns}
              data={filterOrders(orders, query)}
              getRowId={(row) => row.po}
              density="tall"
              variant="plain"
              selectedRowId={selectedPo}
              onRowClick={(row) => {
                if (row.po !== selectedPo) notInPrototype(`Payment detail for ${row.po}`);
              }}
              emptyState="No orders match your search."
              className="mt-2.5"
            />
          </SectionCard>
          {detail}
        </div>
      </PageContainer>
    </>
  );
}
