"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { SectionCard } from "@/components/shared/cards";
import { DataTable } from "@/components/shared/data-table";
import { FilterChips, FilterSelect } from "@/components/shared/filters";
import { notInPrototype } from "@/components/shared/prototype";
import { StatusPill } from "@/components/shared/status-pill";
import { formatINR, formatNumber, formatRate, formatShortDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

import { convertPayments, isFinal, landedCost } from "./cost-math";
import type { GoodsPayment, OrderCostRow } from "./data/queries";

const ALL = "all";

/** Header filters. No filtered view is designed, so anything but "All" is a prototype notice (D5). */
export function LandedCostFilters({ suppliers, teams }: { suppliers: string[]; teams: string[] }) {
  const options = (all: string, names: string[]) => [{ value: ALL, label: all }, ...names.map((n) => ({ value: n, label: n }))];
  // Hidden on phones (an undesigned width), where they would squeeze the page title out of the header.
  return (
    <div className="hidden items-center gap-3.5 sm:flex">
      <FilterSelect
        label="Supplier"
        size="sm"
        value={ALL}
        options={options("All suppliers", suppliers)}
        onValueChange={(value) => value !== ALL && notInPrototype("Filter by supplier")}
      />
      <FilterSelect
        label="Team"
        size="sm"
        value={ALL}
        options={options("All teams", teams)}
        onValueChange={(value) => value !== ALL && notInPrototype("Filter by team")}
      />
    </div>
  );
}

// 10 px cell padding, 13.5 px cell text and the column edges measured in 31_12_Landed_Cost.jpeg; Order takes the rest.
const PAD = "px-2.5 first:pl-2.5 last:pr-2.5 text-[13.5px]";
const col = (width: string, align?: "right") => ({ align, className: `${PAD} ${width}` });
// Reference header: 12 px text, 3 px below the centre of the 44 px tall-density header row.
const head = (label: string) => <span className="block pt-1.5 text-xs">{label}</span>;
const muted = (text: string) => <span className="text-muted-foreground">{text}</span>;
const orINR = (value: number | null) => (value === null ? muted("Waiting") : formatINR(value));
const soFar = (row: OrderCostRow, text: string) => <span className="font-bold">{isFinal(row) ? text : `${text} so far`}</span>;

const orderColumns: ColumnDef<OrderCostRow>[] = [
  {
    accessorKey: "po",
    header: () => head("Order"),
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
        <span className="block text-[12.5px] leading-4 text-muted-foreground">{row.original.item}</span>
      </>
    ),
  },
  { accessorKey: "qty", header: () => head("Qty"), meta: col("w-[80px]", "right"), cell: ({ row }) => formatNumber(row.original.qty) },
  {
    accessorKey: "purchase",
    header: () => head("Purchase (INR)"),
    meta: col("w-[133.5px]", "right"),
    cell: ({ row }) => formatINR(row.original.purchase),
  },
  {
    id: "seaFreight",
    header: () => head("Sea freight"),
    meta: col("w-[132.5px]", "right"),
    cell: ({ row }) => (row.original.terms === "CNF" ? muted("In price (CNF)") : formatINR(row.original.seaFreight)),
  },
  { id: "duty", header: () => head("Duty and clearing"), meta: col("w-[152px]", "right"), cell: ({ row }) => orINR(row.original.duty) },
  { id: "transport", header: () => head("Transport"), meta: col("w-[95px]", "right"), cell: ({ row }) => orINR(row.original.transport) },
  {
    id: "landed",
    header: () => head("Landed cost"),
    meta: col("w-[154px]", "right"),
    cell: ({ row }) => soFar(row.original, formatINR(landedCost(row.original))),
  },
  {
    id: "perPiece",
    header: () => head("Per piece"),
    meta: col("w-[139.5px]", "right"),
    cell: ({ row }) => soFar(row.original, formatINR(landedCost(row.original) / row.original.qty, 2)),
  },
  {
    id: "status",
    header: () => head("Status"),
    meta: col("w-[111px]"),
    cell: ({ row }) =>
      isFinal(row.original) ? <StatusPill tone="success">Final</StatusPill> : <StatusPill tone="warning">Estimate</StatusPill>,
  },
];

const VIEWS = [
  { value: "order", label: "By order" },
  { value: "team", label: "By team" },
  { value: "item", label: "By item" },
];

/**
 * "Landed cost by order". Only the By order view and PO-2028's breakdown are designed, so the other views and
 * rows show the prototype notice (D5) and the control and selection stay put.
 */
export function OrdersCostCard({ orders, selectedPo }: { orders: OrderCostRow[]; selectedPo: string }) {
  return (
    <SectionCard
      title="Landed cost by order"
      titleGap="none"
      // Reference: 18 px side padding (table and title at x 291), the header rule 2 px lower than the taller segmented
      // control puts it, and 15 px under the last row.
      className="min-w-0 px-[18px] pb-[15px]"
      aside={
        <FilterChips
          variant="segmented"
          // Narrow screens (undesigned) wrap the buttons rather than push the card wider than the page.
          className="flex-wrap"
          label="Group landed cost"
          options={VIEWS}
          value="order"
          onValueChange={(value) => {
            const view = VIEWS.find((v) => v.value === value);
            if (view && value !== "order") notInPrototype(`Landed cost ${view.label.toLowerCase()}`);
          }}
        />
      }
    >
      <DataTable
        columns={orderColumns}
        data={orders}
        getRowId={(row) => row.po}
        density="tall"
        className="mt-0.5"
        variant="plain"
        selectedRowId={selectedPo}
        onRowClick={(row) => row.po !== selectedPo && notInPrototype(`Cost breakdown for ${row.po}`)}
      />
    </SectionCard>
  );
}

type GoodsRow = { label: string; date?: string; amountCny: number; rate: string; amountInr: number; total?: boolean };

// Reference rows are 43 px with their rule: the compact row's 8 px cell padding around a 26 px line. The table sits 1 px
// lower than the title row's 16 px gap (padding, because a margin would collapse into that gap).
const goodsCell = (row: GoodsRow, text: string) => (
  <span className={cn("block leading-[26px]", row.total && "font-bold")}>{text}</span>
);
// Reference header: 12 px text, 1.5 px above the centre of the 36 px compact header row.
const goodsHead = (label: string) => <span className="block pb-[3px] text-xs">{label}</span>;

const goodsColumns: ColumnDef<GoodsRow>[] = [
  { accessorKey: "label", header: () => goodsHead("Payment"), meta: col("w-[92px]"), cell: ({ row }) => goodsCell(row.original, row.original.label) },
  {
    accessorKey: "date",
    header: () => goodsHead("Date"),
    meta: col("w-[90px]"),
    cell: ({ row }) => goodsCell(row.original, row.original.date ? formatShortDate(row.original.date) : ""),
  },
  {
    accessorKey: "amountCny",
    header: () => goodsHead("Amount (¥)"),
    meta: { align: "right", className: PAD },
    cell: ({ row }) => goodsCell(row.original, formatNumber(row.original.amountCny)),
  },
  { accessorKey: "rate", header: () => goodsHead("Rate"), meta: col("w-[106px]", "right"), cell: ({ row }) => goodsCell(row.original, row.original.rate) },
  {
    accessorKey: "amountInr",
    header: () => goodsHead("Amount (INR)"),
    meta: col("w-[128px]", "right"),
    cell: ({ row }) => goodsCell(row.original, formatINR(row.original.amountInr)),
  },
];

/**
 * "Goods cost, changed to INR on each payment date". The Total row is a bold body row: the reference separates it
 * with the ordinary row rule, not the DataTable footer's navy rule and tint.
 */
export function GoodsCostTable({ payments }: { payments: GoodsPayment[] }) {
  const { rows, totalCny, totalInr, averageRate } = convertPayments(payments);
  const data: GoodsRow[] = [
    ...rows.map((p) => ({ label: p.label, date: p.date, amountCny: p.amountCny, rate: formatRate(p.rate), amountInr: p.amountInr })),
    { label: "Total", amountCny: totalCny, rate: `${formatRate(averageRate)} avg`, amountInr: totalInr, total: true },
  ];
  return <DataTable columns={goodsColumns} data={data} getRowId={(row) => row.label} density="compact" variant="plain" className="pt-px" />;
}
