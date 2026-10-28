"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";

import { Callout, SectionCard } from "@/components/shared/cards";
import { DataTable } from "@/components/shared/data-table";
import { FilterChips } from "@/components/shared/filters";
import { LegendSwatch, StackedBar, type StackedSegment } from "@/components/shared/progress";
import { notInPrototype } from "@/components/shared/prototype";
import { EmptyState } from "@/components/shared/states";
import { StatusPill } from "@/components/shared/status-pill";
import { formatINR, formatNumber, formatRate, formatShortDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

import { breakdownParts, convertPayments, costByTeam, type CostPartKey, shareOfTotal, type TeamCost } from "./cost-math";
import type { LandedCostData, LandedCostRow } from "./data/queries";

// 10 px cell padding, 13.5 px cell text and the column edges measured in 31_12_Landed_Cost.jpeg; Order takes the rest.
const PAD = "px-2.5 first:pl-2.5 last:pr-2.5 text-[13.5px]";
const col = (width: string, align?: "right") => ({ align, className: `${PAD} ${width}` });
// Reference header: 12 px text, 3 px below the centre of the 44 px tall-density header row.
const head = (label: string) => <span className="block pt-1.5 text-xs">{label}</span>;
const muted = (text: string) => <span className="text-muted-foreground">{text}</span>;
const orINR = (value: number | null, decimals = 0) => (value === null ? muted("Waiting") : formatINR(value, decimals));
const soFar = (row: LandedCostRow, text: string) => <span className="font-bold">{row.final ? text : `${text} so far`}</span>;

const orderColumns: ColumnDef<LandedCostRow>[] = [
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
  { accessorKey: "quantity", header: () => head("Qty"), meta: col("w-[80px]", "right"), cell: ({ row }) => formatNumber(row.original.quantity) },
  {
    accessorKey: "goodsInr",
    header: () => head("Purchase (INR)"),
    meta: col("w-[133.5px]", "right"),
    cell: ({ row }) => formatINR(row.original.goodsInr),
  },
  {
    id: "seaFreight",
    header: () => head("Sea freight"),
    meta: col("w-[132.5px]", "right"),
    cell: ({ row }) => (row.original.terms === "CNF" ? muted("In price (CNF)") : formatINR(row.original.seaFreightInr)),
  },
  { id: "duty", header: () => head("Duty and clearing"), meta: col("w-[152px]", "right"), cell: ({ row }) => orINR(row.original.clearingInr) },
  { id: "transport", header: () => head("Transport"), meta: col("w-[95px]", "right"), cell: ({ row }) => orINR(row.original.transportInr) },
  {
    id: "landed",
    header: () => head("Landed cost"),
    meta: col("w-[154px]", "right"),
    cell: ({ row }) => soFar(row.original, formatINR(row.original.totalInr)),
  },
  {
    id: "perPiece",
    header: () => head("Per piece"),
    meta: col("w-[139.5px]", "right"),
    cell: ({ row }) => (row.original.perPieceInr === null ? muted("Waiting") : soFar(row.original, formatINR(row.original.perPieceInr, 2))),
  },
  {
    id: "status",
    header: () => head("Status"),
    meta: col("w-[111px]"),
    cell: ({ row }) =>
      row.original.final ? (
        <StatusPill tone="success">Final</StatusPill>
      ) : (
        <>
          <StatusPill tone="warning">Estimate</StatusPill>
          <span className="block text-[12px] leading-4 text-muted-foreground">waiting for {row.original.waitingFor}</span>
        </>
      ),
  },
];

const teamColumns: ColumnDef<TeamCost>[] = [
  { accessorKey: "team", header: () => head("Team"), meta: { className: cn(PAD, "font-bold") } },
  { accessorKey: "pieces", header: () => head("Pieces"), meta: col("w-[133.5px]", "right"), cell: ({ row }) => formatNumber(row.original.pieces) },
  { accessorKey: "costInr", header: () => head("Landed cost"), meta: col("w-[154px]", "right"), cell: ({ row }) => formatINR(row.original.costInr) },
  { id: "perPiece", header: () => head("Per piece"), meta: col("w-[139.5px]", "right"), cell: ({ row }) => orINR(row.original.perPieceInr, 2) },
];

const VIEWS = [
  { value: "order", label: "By order" },
  { value: "team", label: "By team" },
  { value: "item", label: "By item" },
];

const PART_COLORS: Record<CostPartKey, StackedSegment["color"]> = { goods: "chart-1", seaFreight: "chart-3", duty: "chart-4", transport: "chart-2" };

/**
 * Landed cost by order or by team, and the selected order's breakdown and goods payments. A row click selects the
 * order (the first row until then). Per-item cost is not supported yet (section 6.2), so "By item" stays a notice (D5).
 */
export function LandedCostBody({ orders, teams }: Pick<LandedCostData, "orders" | "teams">) {
  const [view, setView] = useState("order");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = orders.find((row) => row.orderId === selectedId) ?? orders[0];
  const byTeam = view === "team";

  return (
    <>
      <SectionCard
        title={byTeam ? "Landed cost by team" : "Landed cost by order"}
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
            value={view}
            onValueChange={(value) => (value === "item" ? notInPrototype("Landed cost by item") : setView(value))}
          />
        }
      >
        {byTeam ? (
          <DataTable
            columns={teamColumns}
            data={costByTeam(orders, teams)}
            getRowId={(row) => row.teamId}
            density="tall"
            className="mt-0.5"
            variant="plain"
            emptyState={<EmptyState title="No goods stocked to a team yet." />}
          />
        ) : (
          <DataTable
            columns={orderColumns}
            data={orders}
            getRowId={(row) => row.orderId}
            density="tall"
            className="mt-0.5"
            variant="plain"
            selectedRowId={selected?.orderId}
            onRowClick={(row) => setSelectedId(row.orderId)}
            emptyState={<EmptyState title="No costs recorded yet." description="Orders appear here once a payment or a charge is entered." />}
          />
        )}
      </SectionCard>
      {selected ? (
        <div className="grid gap-(--page-gap) lg:grid-cols-2">
          <Breakdown row={selected} />
          <SectionCard title="Goods cost, changed to INR on each payment date" className="min-w-0 pb-[17px]">
            <GoodsCostTable payments={selected.goodsPayments} />
            <Callout size="sm" className="mt-3">
              Each payment uses the rate of its own date, so the goods cost is the real amount paid.
            </Callout>
          </SectionCard>
        </div>
      ) : null}
    </>
  );
}

/** "PO-2028 · Denim jeans: where the ₹13,77,000 goes": stacked bar and legend, then the costs that add nothing. */
function Breakdown({ row }: { row: LandedCostRow }) {
  const parts = breakdownParts(row);
  const { percents } = shareOfTotal(parts.map((part) => part.value));
  return (
    <SectionCard title={`${row.po} · ${row.item}: where the ${formatINR(row.totalInr)} goes`} titleGap="none" className="min-w-0 pt-[17px]">
      <StackedBar className="mt-[13px]" segments={parts.map((part) => ({ label: part.label, value: part.value, color: PART_COLORS[part.key] }))} />
      <ul className="mt-3.5">
        {parts.map((part, index) => (
          <li key={part.key} className="flex min-h-[35px] items-center border-b border-border-subtle text-sm">
            <LegendSwatch color={PART_COLORS[part.key]} />
            {/* Inline runs, so the label and qualifier (and the amount and share) sit on one baseline. */}
            <span className="ml-2.5 min-w-0">
              {part.label}
              {part.qualifier ? <span className="ml-1.5 text-[12.5px] text-muted-foreground">{part.qualifier}</span> : null}
            </span>
            <span className="ml-auto pl-3">
              <span className="text-[14.5px] font-bold">{formatINR(part.value)}</span>
              <span className="ml-2.5 text-[12.5px] font-bold text-muted-foreground">{percents[index]}%</span>
            </span>
          </li>
        ))}
        {/* CNF (or nothing paid to an agent): sea freight adds nothing; short receipts are not deducted in this version. */}
        {row.seaFreightInr === 0 ? (
          <li className="flex min-h-[35px] items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>Sea freight and short-receipt deduction</span>
            <span>{formatINR(row.seaFreightInr)}</span>
          </li>
        ) : null}
      </ul>
    </SectionCard>
  );
}

type GoodsRow = { id: string; label: string; date?: string; amountCny: number; rate: string; amountInr: number; total?: boolean };

// Reference rows are 43 px with their rule: the compact row's 8 px cell padding around a 26 px line. The table sits 1 px
// lower than the title row's 16 px gap (padding, because a margin would collapse into that gap).
const goodsCell = (row: GoodsRow, text: string) => <span className={cn("block leading-[26px]", row.total && "font-bold")}>{text}</span>;
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
    cell: ({ row }) => goodsCell(row.original, formatNumber(row.original.amountCny, Number.isInteger(row.original.amountCny) ? 0 : 2)),
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
function GoodsCostTable({ payments }: { payments: LandedCostRow["goodsPayments"] }) {
  if (payments.length === 0) return <EmptyState title="Nothing paid to the supplier yet." />;
  const { totalCny, totalInr, averageRate } = convertPayments(payments);
  const data: GoodsRow[] = [
    ...payments.map((p) => ({ id: p.id, label: p.kind, date: p.paidOn, amountCny: p.amountCny, rate: formatRate(p.rateInr), amountInr: p.amountInr })),
    { id: "total", label: "Total", amountCny: totalCny, rate: `${formatRate(averageRate)} avg`, amountInr: totalInr, total: true },
  ];
  return <DataTable columns={goodsColumns} data={data} getRowId={(row) => row.id} density="compact" variant="plain" className="pt-px" />;
}
