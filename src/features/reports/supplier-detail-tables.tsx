"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { createContext, use, useState, useTransition } from "react";

import { useNavigate, useReportPending } from "@/components/layout/navigation-progress";
import { DataTable } from "@/components/shared/data-table";
import { type FilterOption, FilterSelect } from "@/components/shared/filters";
import { PoLink } from "@/components/shared/po-link";
import { EmptyState } from "@/components/shared/states";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { optionParam } from "@/features/calendar/params";
import { orderStatus } from "@/features/orders/order-status";
import { formatDate, formatINR, formatMoney, formatQty } from "@/lib/formatters";
import { STAGES } from "@/types/domain";

import type { SupplierPaymentDetail } from "./data/queries";
import { PAGE_PARAMS, withParams } from "./data/supplier-detail-params";

// The supplier detail's lists (RPT-5D). The server loads one page of each; the pagers, the payment dates and the stage
// filter write the URL, so the server page reloads. A filter change goes back to that list's page 1.

const DASH = "–";

/** A value from the server that the client may change ahead of it: the server's next value (Back too) replaces it. */
function useAhead(value: string) {
  const [ahead, setAhead] = useState(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setAhead(value);
  }
  return [ahead, setAhead] as const;
}

type DetailUrl = { query: URLSearchParams; update: (changes: Record<string, string | null>) => void };
const DetailUrlContext = createContext<DetailUrl | null>(null);

function useDetailUrl() {
  const url = use(DetailUrlContext);
  if (!url) throw new Error("useDetailUrl needs a DetailUrlProvider");
  return url;
}

/**
 * The page's query for the list controls inside. `update` pushes the next URL (scroll kept, progress bar shown) and
 * holds it as the query at once, so a second change made while the page reloads builds on the first.
 */
export function DetailUrlProvider({ base, search, children }: { base: string; search: string; children: React.ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  useReportPending(isPending);
  const [query, setQuery] = useAhead(search);
  const update = (changes: Record<string, string | null>) => {
    const next = withParams(query, changes);
    setQuery(next);
    startTransition(() => router.push(next ? `${base}?${next}` : base, { scroll: false }));
  };
  return <DetailUrlContext value={{ query: new URLSearchParams(query), update }}>{children}</DetailUrlContext>;
}

type List<T> = { rows: T[]; total: number; page: number; pageSize: number };

type PagedTableProps<T> = {
  list: List<T>;
  columns: ColumnDef<T>[];
  /** The list's page in the URL (1-based; page 1 leaves it out). */
  param: string;
  /** Plural noun: "Showing 1 to 10 of 24 payments". */
  itemLabel: string;
  /** EmptyState title when the list has no records (for these filters). */
  empty: string;
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
};

/** One server-paged list, on the page the server loaded. */
function PagedTable<T>({ list, columns, param, itemLabel, empty, getRowId, onRowClick }: PagedTableProps<T>) {
  const { update } = useDetailUrl();
  if (list.total === 0) return <EmptyState title={empty} />;
  if (list.rows.length === 0) {
    // A page past the end (an old or hand-edited URL): the API sends no rows and the real total.
    return (
      <EmptyState
        title={`No ${itemLabel} on page ${list.page}.`}
        action={
          <Button variant="outline" onClick={() => update({ [param]: null })}>
            Go to page 1
          </Button>
        }
      />
    );
  }
  return (
    <DataTable
      columns={columns}
      data={list.rows}
      getRowId={getRowId}
      onRowClick={onRowClick}
      size="sm"
      header="tall"
      pagination={{
        pageSize: list.pageSize,
        rowCount: list.total,
        pageIndex: list.page - 1,
        itemLabel,
        onPageChange: (index) => update({ [param]: index ? String(index + 1) : null }),
      }}
    />
  );
}

type Payment = SupplierPaymentDetail["payments"]["rows"][number];

export function SupplierPaymentsList({ list, linkPos, empty }: { list: List<Payment>; linkPos: boolean; empty: string }) {
  const columns: ColumnDef<Payment>[] = [
    { id: "reference", header: "Reference", cell: ({ row }) => <span title={row.original.id}>{row.original.id.slice(0, 8)}</span> },
    {
      id: "date",
      header: "Date",
      cell: ({ row }) => {
        const { paidOn, dueDate } = row.original;
        return paidOn ? formatDate(paidOn) : dueDate ? `due ${formatDate(dueDate)}` : DASH;
      },
    },
    { accessorKey: "po", header: "PO", cell: ({ row }) => <PoLink po={row.original.po} linked={linkPos} /> },
    { accessorKey: "kind", header: "Type" },
    { accessorKey: "mode", header: "Method", cell: ({ row }) => row.original.mode || DASH },
    { accessorKey: "currency", header: "Currency" },
    { accessorKey: "amountCny", header: "Amount", meta: { align: "right" }, cell: ({ row }) => formatMoney(row.original.amountCny, row.original.currency) },
    {
      accessorKey: "amountInr",
      header: "INR",
      meta: { align: "right" },
      cell: ({ row }) => (row.original.amountInr === null ? DASH : formatINR(row.original.amountInr)),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (row.original.status === "paid" ? <StatusPill tone="success">Paid</StatusPill> : <StatusPill tone="warning">Due</StatusPill>),
    },
  ];
  return <PagedTable list={list} columns={columns} param={PAGE_PARAMS.payments} itemLabel="payments" empty={empty} getRowId={(row) => row.id} />;
}

type Order = SupplierPaymentDetail["orders"]["rows"][number];

const money = (pick: (order: Order) => number) => ({ row }: { row: { original: Order } }) => formatMoney(pick(row.original), row.original.currency);

export function SupplierOrdersList({ list, linkPos, today, empty }: { list: List<Order>; linkPos: boolean; today: string; empty: string }) {
  const navigate = useNavigate();
  const columns: ColumnDef<Order>[] = [
    {
      accessorKey: "po",
      header: "PO",
      // The row opens the order too; the link keeps it keyboard-reachable. Stopping its click avoids a second navigation.
      cell: ({ row }) => (
        <span onClick={(event) => event.stopPropagation()}>
          <PoLink po={row.original.po} linked={linkPos} />
        </span>
      ),
    },
    { accessorKey: "orderDate", header: "Order date", cell: ({ row }) => formatDate(row.original.orderDate) },
    { accessorKey: "deliveryDate", header: "Expected delivery", cell: ({ row }) => formatDate(row.original.deliveryDate) },
    {
      id: "quantity",
      header: "Total quantity",
      cell: ({ row }) => row.original.quantities.map((q) => formatQty(q.quantity, q.unit)).join(" · ") || DASH,
    },
    { accessorKey: "orderValueCny", header: "Order value", meta: { align: "right" }, cell: money((o) => o.orderValueCny) },
    { accessorKey: "paidCny", header: "Paid", meta: { align: "right" }, cell: money((o) => o.paidCny) },
    { accessorKey: "balanceCny", header: "Outstanding", meta: { align: "right" }, cell: money((o) => o.balanceCny) },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = orderStatus(row.original, today);
        return <StatusPill tone={status.tone}>{status.label}</StatusPill>;
      },
    },
  ];
  return (
    <PagedTable
      list={list}
      columns={columns}
      param={PAGE_PARAMS.orders}
      itemLabel="orders"
      empty={empty}
      getRowId={(row) => row.id}
      onRowClick={linkPos ? (order) => navigate(`/orders/${order.po}`) : undefined}
    />
  );
}

type Line = SupplierPaymentDetail["lines"]["rows"][number];

export function SupplierLinesList({ list, linkPos, empty }: { list: List<Line>; linkPos: boolean; empty: string }) {
  const columns: ColumnDef<Line>[] = [
    { accessorKey: "item", header: "Product", meta: { className: "font-bold" } },
    { accessorKey: "po", header: "PO", cell: ({ row }) => <PoLink po={row.original.po} linked={linkPos} /> },
    { accessorKey: "quantity", header: "Quantity", meta: { align: "right" }, cell: ({ row }) => formatQty(row.original.quantity, row.original.unit) },
    {
      accessorKey: "rateCny",
      header: "Unit rate",
      meta: { align: "right" },
      cell: ({ row }) => formatMoney(row.original.rateCny, row.original.currency, { decimals: 2 }),
    },
    { accessorKey: "amountCny", header: "Total", meta: { align: "right" }, cell: ({ row }) => formatMoney(row.original.amountCny, row.original.currency) },
    { accessorKey: "currency", header: "Currency" },
  ];
  return <PagedTable list={list} columns={columns} param={PAGE_PARAMS.lines} itemLabel="order lines" empty={empty} getRowId={(row) => row.orderLineId} />;
}

const fieldBox =
  "flex h-10 items-center gap-[9px] rounded-lg border bg-card pr-2 pl-[15px] focus-within:border-primary focus-within:ring-3 focus-within:ring-ring/25";
const fieldInput = "h-full bg-transparent text-sm text-label outline-none";

/** One payment date field: what is typed shows at once; the URL changes once the date is complete. */
function DateField({ label, param, min, max }: { label: string; param: "paymentFrom" | "paymentTo"; min?: string; max?: string }) {
  const { query, update } = useDetailUrl();
  const [value, setValue] = useAhead(query.get(param) ?? "");
  return (
    <label className={fieldBox}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(event) => {
          const next = event.target.value;
          setValue(next);
          // Typing a year passes through 0002, 0020 and 0202: wait for the real one.
          if (next === "" || /^[1-9]/.test(next)) update({ [param]: next || null, [PAGE_PARAMS.payments]: null });
        }}
        className={fieldInput}
      />
    </label>
  );
}

/** Payment date range (?paymentFrom, ?paymentTo) and Clear. */
export function PaymentDateFilter() {
  const { query, update } = useDetailUrl();
  const from = query.get("paymentFrom") ?? undefined;
  const to = query.get("paymentTo") ?? undefined;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <DateField label="From" param="paymentFrom" max={to} />
      <DateField label="To" param="paymentTo" min={from} />
      <Button variant="outline" className="h-10" disabled={!from && !to} onClick={() => update({ paymentFrom: null, paymentTo: null, [PAGE_PARAMS.payments]: null })}>
        Clear
      </Button>
    </div>
  );
}

/** The Orders list's stage options. */
const STAGE_OPTIONS: FilterOption[] = [
  { value: "all", label: "All stages" },
  ...STAGES.map((name, index) => ({ value: String(index + 1), label: `${index + 1}. ${name}` })),
];

/** Orders stage filter (?stage=1-6). */
export function OrderStageFilter() {
  const { query, update } = useDetailUrl();
  return (
    <FilterSelect
      label="Stage"
      showLabel
      size="sm"
      value={optionParam(query, "stage", STAGE_OPTIONS)}
      options={STAGE_OPTIONS}
      onValueChange={(next) => update({ stage: next === "all" ? null : next, [PAGE_PARAMS.orders]: null })}
    />
  );
}
