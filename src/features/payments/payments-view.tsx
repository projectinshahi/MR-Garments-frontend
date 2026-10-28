"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { CardNote, SectionCard } from "@/components/shared/cards";
import { DataTable } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/filters";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import type { OrderOptions } from "@/lib/api/types";
import { formatINR, formatNumber, formatShortDate } from "@/lib/formatters";

import type { OrderPaymentRow, Payment } from "./data/queries";
import { filterOrders } from "./filter-orders";
import { PaymentDetailCard } from "./payment-detail";
import { RecordPaymentDialog } from "./record-payment-dialog";

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
  payments: Payment[];
  /** The order selected on load; a row click selects another. */
  defaultPo: string | null;
  kpis: React.ReactNode;
  /** Shipping agents to offer as payees, or null when the user can't record payments (no buttons). */
  agents: OrderOptions["agents"] | null;
  /** POs link to their order page (canOpen(me, "/orders")). */
  linkPo: boolean;
};

/**
 * Header search filters the "Payments by order" table; a row click shows that order's payments. KPIs are a server
 * slot. The selected order's card shows only while its row does, and comes back when the search clears.
 */
export function PaymentsView({ orders, payments, defaultPo, kpis, agents, linkPo }: PaymentsViewProps) {
  const [query, setQuery] = useState("");
  const [selectedPo, setSelectedPo] = useState(defaultPo);
  const visible = filterOrders(orders, query);
  const selected = visible.find((order) => order.po === selectedPo);

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
            {agents ? (
              <RecordPaymentDialog orders={orders} agents={agents}>
                <Button type="button" size="header">
                  + Record payment
                </Button>
              </RecordPaymentDialog>
            ) : null}
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
              data={visible}
              getRowId={(row) => row.po}
              density="tall"
              variant="plain"
              selectedRowId={selectedPo ?? undefined}
              onRowClick={(row) => setSelectedPo(row.po)}
              emptyState={orders.length ? "No orders match your search." : "No orders yet."}
              className="mt-2.5"
            />
          </SectionCard>
          {selected ? (
            <PaymentDetailCard
              order={selected}
              // PAY-1 lists payments newest first; the card numbers them oldest first (1. Deposit, 2. Balance), as in 16.
              payments={payments.filter((p) => p.po === selected.po).toReversed()}
              agents={agents}
              linkPo={linkPo}
            />
          ) : null}
        </div>
      </PageContainer>
    </>
  );
}
