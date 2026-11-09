"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useState } from "react";

import { useNavigate } from "@/components/layout/navigation-progress";
import { DataTable } from "@/components/shared/data-table";
import { FilterSelect, SearchInput, type FilterOption } from "@/components/shared/filters";
import { orderHref } from "@/components/shared/po-link";
import { StatusPill } from "@/components/shared/status-pill";
import { Input } from "@/components/ui/input";
import type { ReportFile } from "@/features/reports/report-files";
import { formatDate, formatMoney, formatQty, formatShortDate } from "@/lib/formatters";
import { todayInIndia } from "@/lib/today";

import type { OrderRow, OrdersListData } from "./data/queries";
import { rowActionClass } from "./delete-order";
import { balanceCny, closedOrders, filterTabOrders, paymentStatus, pendingOrders, pendingQty, type TabFilters } from "./filter-orders";
import { closedOrdersFile, describeFilters, pendingOrdersFile, rangeLabel } from "./order-files";
import { stageLabel } from "./order-status";
import { ClosedOrdersFrame, OrdersFrame } from "./orders-frame";
import { PoCell } from "./orders-list";

// Phase 2 §5: the Pending (stage 1) and Closed (`closed`) tabs. Every order is loaded once (ORD-1, as the All tab);
// membership, search, supplier and the date range run on the client.

const ALL = "all";
const PAGE_SIZE = 10;
const right = { align: "right" } as const;

type Spec = {
  members: (orders: OrderRow[]) => OrderRow[];
  /** The date the range filter and its label apply to. */
  dateOf: (order: OrderRow) => string | null;
  dateLabel: string;
  columns: ColumnDef<OrderRow>[];
  /** Shown when there are orders but none belongs to this tab. */
  empty: string;
  file: (rows: OrderRow[], filters: string, today: string) => ReportFile;
};

const poColumn: ColumnDef<OrderRow> = { accessorKey: "po", header: "PO", cell: ({ row }) => <PoCell order={row.original} /> };
const supplierColumn: ColumnDef<OrderRow> = { accessorKey: "supplier", header: "Supplier" };
const orderedColumn: ColumnDef<OrderRow> = {
  id: "quantity",
  header: "Ordered qty",
  meta: right,
  cell: ({ row }) => formatQty(row.original.quantity, row.original.unit),
};
const valueColumn: ColumnDef<OrderRow> = {
  accessorKey: "orderValueCny",
  header: "Order value",
  meta: right,
  cell: ({ row }) => formatMoney(row.original.orderValueCny, row.original.currency, { decimals: 2 }),
};

const PENDING: Spec = {
  members: pendingOrders,
  dateOf: (order) => order.orderDate,
  dateLabel: "Order date",
  empty: "No pending orders.",
  file: pendingOrdersFile,
  columns: [
    poColumn,
    supplierColumn,
    { accessorKey: "orderDate", header: "Order date", cell: ({ row }) => formatShortDate(row.original.orderDate) },
    { accessorKey: "deliveryDate", header: "Expected delivery", cell: ({ row }) => formatShortDate(row.original.deliveryDate) },
    orderedColumn,
    { id: "pending", header: "Pending qty", meta: right, cell: ({ row }) => formatQty(pendingQty(row.original), row.original.unit) },
    valueColumn,
    {
      id: "payment",
      header: "Deposit/payment",
      cell: ({ row }) => {
        const { label, tone } = paymentStatus(row.original);
        return <StatusPill tone={tone}>{label}</StatusPill>;
      },
    },
    { accessorKey: "stage", header: "Current stage", cell: ({ row }) => stageLabel(row.original.stage) },
  ],
};

const CLOSED: Spec = {
  members: closedOrders,
  dateOf: (order) => order.closedOn,
  dateLabel: "Closed date",
  empty: "No closed orders yet.",
  file: closedOrdersFile,
  columns: [
    poColumn,
    supplierColumn,
    valueColumn,
    orderedColumn,
    { accessorKey: "stocked", header: "Warehouse received", meta: right, cell: ({ row }) => formatQty(row.original.stocked, row.original.unit) },
    // Supplier payments only, as the order report and Payments per supplier count them; the All tab's INR figure keeps every payee.
    { accessorKey: "supplierPaidCny", header: "Paid to supplier", meta: right, cell: ({ row }) => formatMoney(row.original.supplierPaidCny, row.original.currency, { decimals: 2 }) },
    { id: "balance", header: "Balance to supplier", meta: right, cell: ({ row }) => formatMoney(balanceCny(row.original), row.original.currency, { decimals: 2 }) },
    { accessorKey: "closedOn", header: "Closed date", cell: ({ row }) => (row.original.closedOn ? formatDate(row.original.closedOn) : "–") },
    {
      // The order's report page (phase 2 §4.3, Agent R); the row itself opens the order.
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      meta: { className: "w-px whitespace-nowrap" },
      cell: ({ row }) => (
        <span onClick={(event) => event.stopPropagation()}>
          <Link href={`${orderHref(row.original.po)}/report`} aria-label={`Report ${row.original.po}`} className={rowActionClass}>
            Report
          </Link>
        </span>
      ),
    },
  ],
};

/** From/to on the tab's date, inclusive, either end optional: native date fields at the filter row's 40 px height. */
function DateRange({ label, from, to, onFrom, onTo }: { label: string; from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>{label}</span>
      <Input type="date" size="sm" aria-label={`${label} from`} value={from} max={to || undefined} onChange={(e) => onFrom(e.target.value)} className="h-10 w-auto bg-card" />
      <span aria-hidden>to</span>
      <Input type="date" size="sm" aria-label={`${label} to`} value={to} min={from || undefined} onChange={(e) => onTo(e.target.value)} className="h-10 w-auto bg-card" />
    </div>
  );
}

type Frame = "orders" | "closed-orders";

function TabList({ spec, orders, supplierNames, canEdit, frame = "orders" }: { spec: Spec; canEdit: boolean; frame?: Frame } & Omit<OrdersListData, "counts">) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [supplier, setSupplier] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const supplierOptions: FilterOption[] = [{ value: ALL, label: "All suppliers" }, ...supplierNames.map((name) => ({ value: name, label: name }))];
  const filters: TabFilters = { query, supplier: supplier === ALL ? null : supplier, from, to };
  const members = spec.members(orders);
  const rows = filterTabOrders(members, filters, spec.dateOf);
  const file = () =>
    spec.file(
      rows,
      describeFilters([query.trim() && `Search: "${query.trim()}"`, filters.supplier && `Supplier: ${filters.supplier}`, rangeLabel(spec.dateLabel, from, to)]),
      todayInIndia(),
    );

  const body = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          label="Search PO, item or supplier"
          placeholder="Search PO, item or supplier"
          value={query}
          onValueChange={setQuery}
          className="w-full sm:w-auto sm:max-w-[290px] sm:flex-[1_1_200px]"
        />
        <FilterSelect label="Supplier" showLabel size="sm" value={supplier} options={supplierOptions} onValueChange={setSupplier} />
        <DateRange label={spec.dateLabel} from={from} to={to} onFrom={setFrom} onTo={setTo} />
      </div>
      <DataTable
        // Remount on a filter change so the pager returns to page 1.
        key={JSON.stringify(filters)}
        columns={spec.columns}
        data={rows}
        getRowId={(order) => order.po}
        density="tall"
        size="sm"
        header="tall"
        onRowClick={(order) => navigate(orderHref(order.po))}
        emptyState={orders.length === 0 ? "No orders yet." : members.length === 0 ? spec.empty : "No orders match these filters."}
        pagination={{ pageSize: PAGE_SIZE, itemLabel: "orders" }}
      />
    </div>
  );
  return frame === "closed-orders" ? <ClosedOrdersFrame file={file}>{body}</ClosedOrdersFrame> : <OrdersFrame canEdit={canEdit} file={file}>{body}</OrdersFrame>;
}

type ListProps = Omit<OrdersListData, "counts"> & { canEdit: boolean };

/** /orders/pending: orders with no China receipt yet. */
export const PendingList = (props: ListProps) => <TabList spec={PENDING} {...props} />;
/** /orders/closed: orders whose goods are all stocked in India; each row also links to its report. */
export const ClosedList = (props: ListProps) => <TabList spec={CLOSED} {...props} />;
/** /closed-orders (sidebar, after Warehouse): the same Closed list as its own page, without the Orders tab bar. */
export const ClosedOrdersPageList = (props: ListProps) => <TabList spec={CLOSED} frame="closed-orders" {...props} />;
