"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

import { DataTable } from "@/components/shared/data-table";
import { PoLink } from "@/components/shared/po-link";
import { StatusPill } from "@/components/shared/status-pill";
import { CONTAINER_STATUS } from "@/features/containers/containers-logic";
import { stageLabel } from "@/features/orders/order-status";
import { moneyOrDash } from "@/features/payments/money";
import type { SupplierOrderRow } from "@/lib/api/reports-types";
import { formatDate, formatINR, formatMoney, formatQty, formatRateInr } from "@/lib/formatters";

import { DOLLAR_COST_NOTE, dollarCostText } from "../dollar-cost";
import { paymentStatusLabel, rowStatus } from "../order-reports/order-reports-file";
import { detailedReportHref } from "../order-reports/order-reports-table";

// One supplier's orders on Supplier order details (RPT-S1): every order (PO, order date) with its lines (item, ordered,
// received and rate, one text line per order line so the four columns line up), its value with the PO value, currency
// and saved rate under it (as the Order reports table), Dollar Cost, paid, outstanding, status, the containers carrying
// it and the landed cost's parts. Twelve columns fit a 1440 px page; sortable, paged by 10.

const PAYMENT_TONE = { awaiting_goods: "neutral", unpaid: "danger", partly: "warning", paid: "success" } as const;
const right = { align: "right" } as const;
const wrap = "whitespace-normal";
const sub = "text-[12.5px] leading-[18px] text-muted-foreground";
/** A sub-line that never breaks inside its figure ("Goods ₹52,800", "USD @ ₹88.00"). */
const line = `${sub} whitespace-nowrap`;

/** One value per order line, each on its own line. */
function PerLine({ values, align = "left" }: { values: string[]; align?: "left" | "right" }) {
  return <span className={`flex flex-col leading-[18px] ${align === "right" ? "items-end" : ""}`}>{values.length ? values.map((value, index) => <span key={index}>{value}</span>) : "–"}</span>;
}

export function SupplierOrdersTable({ rows, today, linkPos, supplier }: { rows: SupplierOrderRow[]; today: string; linkPos: boolean; supplier: string }) {
  const money =
    (pick: (row: SupplierOrderRow) => number | null) =>
    ({ row }: { row: { original: SupplierOrderRow } }) =>
      moneyOrDash(pick(row.original), (v) => formatMoney(v, row.original.currency));
  const columns: ColumnDef<SupplierOrderRow>[] = [
    {
      accessorKey: "po",
      header: "PO / Date",
      meta: { className: "w-[100px] font-bold" },
      // The PO opens the order (for those who can), the order date under it, then the link to its full report.
      cell: ({ row }) => (
        <span className="flex flex-col leading-[18px]">
          <PoLink po={row.original.po} linked={linkPos} />
          <span className={`${sub} font-normal`}>{formatDate(row.original.orderDate)}</span>
          <Link href={detailedReportHref(row.original.po)} aria-label={`Report: ${row.original.po}`} className="text-[12.5px] font-normal text-primary hover:underline">
            Report
          </Link>
        </span>
      ),
    },
    { id: "items", enableSorting: false, header: "Items", meta: { className: `w-[112px] ${wrap}` }, cell: ({ row }) => <PerLine values={row.original.lines.map((line) => line.item)} /> },
    {
      id: "ordered",
      enableSorting: false,
      header: "Ordered",
      meta: { ...right, className: "w-[72px]" },
      cell: ({ row }) => <PerLine align="right" values={row.original.lines.map((line) => formatQty(line.ordered, line.unit))} />,
    },
    {
      id: "received",
      enableSorting: false,
      header: "Received",
      meta: { ...right, className: "w-[72px]" },
      cell: ({ row }) => <PerLine align="right" values={row.original.lines.map((line) => formatQty(line.received, line.unit))} />,
    },
    {
      id: "rate",
      enableSorting: false,
      header: "Rate",
      meta: { ...right, className: "w-[64px]" },
      cell: ({ row }) => <PerLine align="right" values={row.original.lines.map((line) => formatMoney(line.rate, row.original.currency, { decimals: 2 }))} />,
    },
    {
      // Received × rate, then the PO value (ordered × rate) and the currency with the INR rate saved on the order.
      accessorKey: "orderValueCny",
      header: "Value (received)",
      meta: { ...right, className: `w-[104px] ${wrap}` },
      cell: ({ row }) => (
        <span className="inline-flex flex-col items-end leading-[18px]">
          {formatMoney(row.original.orderValueCny, row.original.currency)}
          <span className={line}>PO {formatMoney(row.original.poValueCny, row.original.currency)}</span>
          <span className={line}>
            {row.original.currency}
            {row.original.exchangeRate === null ? "" : ` @ ${formatRateInr(row.original.exchangeRate)}`}
          </span>
          {/* The USD rate saved on the order (Dollar Cost's other rate); a USD order's is its own. */}
          {row.original.currency === "USD" || row.original.usdRate === null ? null : <span className={line}>{`USD @ ${formatRateInr(row.original.usdRate)}`}</span>}
        </span>
      ),
    },
    {
      accessorKey: "dollarCost",
      header: "Dollar Cost",
      meta: { ...right, className: `w-[80px] ${wrap}` },
      cell: ({ row }) =>
        row.original.dollarCost === null ? (
          <span className={sub} title={DOLLAR_COST_NOTE}>
            {dollarCostText(null)}
          </span>
        ) : (
          dollarCostText(row.original.dollarCost)
        ),
    },
    {
      // What the supplier's account settled of the order (the ledger's FIFO projection) and its payment status.
      accessorKey: "settledCny",
      header: "Paid (settled)",
      meta: { ...right, className: `w-[96px] ${wrap}` },
      cell: ({ row }) => (
        <span className="inline-flex flex-col items-end gap-0.5">
          {moneyOrDash(row.original.settledCny, (v) => formatMoney(v, row.original.currency))}
          {row.original.held ? (
            <StatusPill tone="neutral">Pending review</StatusPill>
          ) : row.original.paymentStatus ? (
            <StatusPill tone={PAYMENT_TONE[row.original.paymentStatus]}>{paymentStatusLabel(row.original)}</StatusPill>
          ) : null}
        </span>
      ),
    },
    { accessorKey: "outstandingCny", header: "Outstanding", meta: { ...right, className: `w-[84px] ${wrap}` }, cell: money((row) => row.outstandingCny) },
    {
      id: "status",
      accessorFn: (row) => rowStatus(row, today).label,
      header: "Status",
      meta: { className: `w-[100px] ${wrap}` },
      cell: ({ row }) => {
        const status = rowStatus(row.original, today);
        return (
          <span className="flex flex-col items-start gap-0.5">
            <StatusPill tone={status.tone}>{status.label}</StatusPill>
            <span className={sub}>{stageLabel(row.original.stage)}</span>
          </span>
        );
      },
    },
    {
      id: "containers",
      enableSorting: false,
      header: "Containers",
      meta: { className: `w-[124px] ${wrap}` },
      cell: ({ row }) =>
        row.original.containers.length ? (
          <span className="flex flex-col gap-1 leading-[18px]">
            {row.original.containers.map((container) => (
              <span key={container.number} className="flex flex-col">
                <span className="font-bold">{container.number}</span>
                <span className={sub}>
                  {CONTAINER_STATUS[container.status]?.label ?? container.status}
                  {container.eta ? ` · ETA ${formatDate(container.eta)}` : ""}
                  {container.terms ? ` · ${container.terms}` : ""}
                </span>
              </span>
            ))}
          </span>
        ) : (
          <span className="text-muted-foreground">Not shipped</span>
        ),
    },
    {
      // The landed cost so far and its parts (INR): goods at the settling credits' rates, sea freight, clearing, transport.
      id: "landedCost",
      accessorFn: (row) => row.landedCost?.totalInr ?? null,
      header: "Landed Cost",
      meta: { ...right, className: `w-[116px] ${wrap}` },
      cell: ({ row }) => {
        const cost = row.original.landedCost;
        if (!cost) return <span className="text-muted-foreground">–</span>;
        const part = (label: string, value: number | null) => `${label} ${value === null ? "–" : formatINR(value)}`;
        return (
          <span className="inline-flex flex-col items-end leading-[18px]">
            <span className="font-bold">{formatINR(cost.totalInr)}</span>
            <span className={line}>{part("Goods", cost.goodsInr)}</span>
            <span className={line}>{part("Freight", cost.seaFreightInr)}</span>
            <span className={line}>{part("Clearing", cost.clearingInr)}</span>
            <span className={line}>{part("Transport", cost.transportInr)}</span>
            {cost.perPieceInr === null ? null : <span className={line}>{`${formatINR(cost.perPieceInr, 2)} per piece`}</span>}
            <span className="mt-0.5">
              <StatusPill tone={cost.final ? "success" : "neutral"}>{cost.final ? "Final" : "Estimate"}</StatusPill>
            </span>
            {cost.final || !cost.waitingFor ? null : <span className={sub}>{`waiting for ${cost.waitingFor}`}</span>}
          </span>
        );
      },
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      variant="plain"
      density="loose"
      size="sm"
      header="tall"
      padding="tight"
      sortable
      pagination={{ pageSize: 10, itemLabel: `orders of ${supplier}`, pageSizeOptions: [10, 25, 50] }}
      emptyState="No orders."
    />
  );
}
