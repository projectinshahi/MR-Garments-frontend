"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/shared/data-table";
import { PoLink } from "@/components/shared/po-link";
import { StatusPill } from "@/components/shared/status-pill";
import { PagedTable, type List } from "@/features/reports/supplier-detail-tables";
import { supplierOrderColumns } from "@/features/reports/supplier-orders/supplier-orders-table";
import { CONTAINER_STATUS } from "@/features/containers/containers-logic";
import { archiveColumns } from "@/features/supplier-ledger/supplier-ledger-screen";
import type { AdvanceArchiveEntry } from "@/lib/api/deposits-types";
import type { SupplierOrderRow } from "@/lib/api/reports-types";
import type { HistoryEvent, HistoryLandedCostOrder, HistoryPayment, HistoryReceipt } from "@/lib/api/supplier-history-types";
import { formatDate, formatDateTime, formatINR, formatMoney, formatQty, formatRateInr } from "@/lib/formatters";

import { dateText, EVENT_LABEL, EVENT_TONE, inrOrDash, MIGRATED, NOT_RECORDED, signedMoney } from "./history-logic";

// The history lists (Supplier 360°): server-paged by the URL (25 a page), every figure as the API gives it.

const right = { align: "right" } as const;
const wrap = "whitespace-normal";
const sub = "text-[12.5px] leading-[18px] text-muted-foreground";
const line = `${sub} whitespace-nowrap`;

/** Who recorded it and when, or why that is not known. */
function Recorded({ at, by, migrated }: { at: string | null; by: string | null; migrated?: boolean }) {
  return (
    <span className="flex flex-col leading-[18px]">
      <span className={line}>{migrated ? MIGRATED : at ? formatDateTime(at) : "–"}</span>
      <span className={sub}>{migrated ? "no author (ledger start)" : (by ?? NOT_RECORDED)}</span>
    </span>
  );
}

// --- Orders ----------------------------------------------------------------------------------------------------------

type OrderRow = SupplierOrderRow & { protectedAt: string | null };
export function HistoryOrdersList({ list, today, linkPos }: { list: List<OrderRow>; today: string; linkPos: boolean }) {
  const columns = supplierOrderColumns(today, linkPos) as ColumnDef<OrderRow>[];
  return <PagedTable list={list} columns={columns} param="page" itemLabel="orders" empty="No orders match these filters." getRowId={(row) => row.id} />;
}

// --- Payments --------------------------------------------------------------------------------------------------------

const paymentColumns = (linkPos: boolean): ColumnDef<HistoryPayment>[] => [
  { id: "date", header: "Paid on", meta: { className: "w-[96px]" }, cell: ({ row }) => dateText(row.original.paidOn ?? row.original.dueDate) },
  {
    id: "amount",
    header: "Amount",
    meta: { ...right, className: `w-[118px] ${wrap}` },
    cell: ({ row }) => (
      <span className={`inline-flex flex-col items-end leading-[18px] ${row.original.voided ? "text-muted-foreground line-through" : ""}`}>
        {formatMoney(row.original.amountCny, row.original.currency, { decimals: 2 })}
        <span className={line}>{row.original.rateInr === null ? "–" : `@ ${formatRateInr(row.original.rateInr)} · ${inrOrDash(row.original.amountInr)}`}</span>
      </span>
    ),
  },
  {
    id: "kind",
    header: "Payment",
    meta: { className: `w-[150px] ${wrap}` },
    cell: ({ row }) => (
      <span className="flex flex-col leading-[18px]">
        <span>{row.original.source === "advance" ? "Legacy advance receipt" : row.original.kind}</span>
        <span className={sub}>{[row.original.mode, row.original.reference].filter(Boolean).join(" · ") || "–"}</span>
        {row.original.po ? (
          <span className={sub}>
            recorded against <PoLink po={row.original.po} linked={linkPos} />
          </span>
        ) : null}
      </span>
    ),
  },
  {
    id: "status",
    header: "Status",
    meta: { className: `w-[170px] ${wrap}` },
    cell: ({ row }) => {
      const p = row.original;
      if (p.held) return <StatusPill tone="warning">On hold (pending review)</StatusPill>;
      if (!p.voided) return <StatusPill tone="success">{p.source === "advance" ? "Active (archive)" : "Active"}</StatusPill>;
      return (
        <span className="flex flex-col items-start gap-0.5 leading-[18px]">
          <StatusPill tone="danger">Voided</StatusPill>
          <span className={sub}>{p.voidReason || "–"}</span>
          <span className={sub}>
            {p.voidedAt ? formatDateTime(p.voidedAt) : ""} · {p.voidedBy || NOT_RECORDED}
          </span>
        </span>
      );
    },
  },
  {
    id: "ledger",
    header: "Ledger",
    meta: { ...right, className: `w-[110px] ${wrap}` },
    cell: ({ row }) => (
      <span className="inline-flex flex-col items-end leading-[18px]">
        <span>{signedMoney(row.original.ledgerCredit, row.original.currency)}</span>
        {row.original.ledgerVoid === null ? null : <span className={line}>void {signedMoney(row.original.ledgerVoid, row.original.currency)}</span>}
      </span>
    ),
  },
  {
    id: "settles",
    header: "Settles now (derived)",
    meta: { className: `w-[170px] ${wrap}` },
    cell: ({ row }) =>
      row.original.settlesNow.length ? (
        <span className="flex flex-col leading-[18px]">
          {row.original.settlesNow.map((share, index) => (
            <span key={index} className="whitespace-nowrap">
              <PoLink po={share.po} linked={linkPos} /> {formatMoney(share.amount, row.original.currency, { decimals: 2 })}
            </span>
          ))}
        </span>
      ) : (
        <span className="text-muted-foreground">{row.original.voided ? "–" : "Available credit"}</span>
      ),
  },
  { id: "recorded", header: "Recorded", meta: { className: `w-[150px] ${wrap}` }, cell: ({ row }) => <Recorded at={row.original.recordedAt} by={row.original.recordedBy} migrated={row.original.migrated} /> },
];
export function HistoryPaymentsList({ list, linkPos }: { list: List<HistoryPayment>; linkPos: boolean }) {
  return <PagedTable list={list} columns={paymentColumns(linkPos)} param="page" itemLabel="payments" empty="No payments match these filters." getRowId={(row) => row.id} />;
}

// --- Receiving -------------------------------------------------------------------------------------------------------

const PerLine = ({ values, align = "left" }: { values: string[]; align?: "left" | "right" }) => (
  <span className={`flex flex-col leading-[18px] ${align === "right" ? "items-end" : ""}`}>{values.length ? values.map((value, index) => <span key={index}>{value}</span>) : "–"}</span>
);
const receiptColumns = (linkPos: boolean): ColumnDef<HistoryReceipt>[] => [
  { id: "date", header: "Received on", meta: { className: "w-[100px]" }, cell: ({ row }) => formatDate(row.original.receivedOn) },
  { id: "po", header: "PO", meta: { className: "w-[92px] font-bold" }, cell: ({ row }) => <PoLink po={row.original.po} linked={linkPos} /> },
  { id: "items", header: "Items", meta: { className: `w-[130px] ${wrap}` }, cell: ({ row }) => <PerLine values={row.original.lines.map((l) => l.item)} /> },
  { id: "quantity", header: "Received", meta: { ...right, className: "w-[90px]" }, cell: ({ row }) => <PerLine align="right" values={row.original.lines.map((l) => formatQty(l.quantity, l.unit))} /> },
  {
    id: "containers",
    header: "Containers (order line)",
    meta: { className: `w-[150px] ${wrap}` },
    cell: ({ row }) => <PerLine values={row.original.lines.map((l) => (l.containers.length ? l.containers.map((c) => `${c.number} (${c.quantity})`).join(", ") : "Not loaded"))} />,
  },
  {
    id: "warehouse",
    header: "India warehouse split",
    meta: { className: `w-[160px] ${wrap}` },
    cell: ({ row }) => <PerLine values={row.original.lines.map((l) => (l.warehouse.length ? l.warehouse.map((w) => `${w.team} ${w.quantity}`).join(", ") : "Not stocked"))} />,
  },
  {
    id: "where",
    header: "Location",
    meta: { className: `w-[160px] ${wrap}` },
    cell: ({ row }) => (
      <span className="flex flex-col leading-[18px]">
        <span>{row.original.location}</span>
        <span className={sub}>{`${row.original.bundles} bundles`}</span>
        {row.original.deliveryNote ? <span className={sub}>{`Note ${row.original.deliveryNote}`}</span> : null}
        {row.original.shortRemark ? <span className={sub}>{row.original.shortRemark}</span> : null}
      </span>
    ),
  },
  { id: "recorded", header: "Recorded", meta: { className: `w-[150px] ${wrap}` }, cell: ({ row }) => <Recorded at={row.original.recordedAt} by={row.original.receivedBy} /> },
];
export function HistoryReceiptsList({ list, linkPos }: { list: List<HistoryReceipt>; linkPos: boolean }) {
  return <PagedTable list={list} columns={receiptColumns(linkPos)} param="page" itemLabel="receipts" empty="No goods receipts match these filters." getRowId={(row) => row.id} />;
}

// --- Landed cost -----------------------------------------------------------------------------------------------------

const landedColumns = (linkPos: boolean): ColumnDef<HistoryLandedCostOrder>[] => [
  {
    id: "po",
    header: "PO / Date",
    meta: { className: "w-[100px] font-bold" },
    cell: ({ row }) => (
      <span className="flex flex-col leading-[18px]">
        <PoLink po={row.original.po} linked={linkPos} />
        <span className={`${sub} font-normal`}>{formatDate(row.original.orderDate)}</span>
      </span>
    ),
  },
  { id: "value", header: "Order value", meta: { ...right, className: "w-[100px]" }, cell: ({ row }) => formatMoney(row.original.orderValueCny, row.original.currency, { decimals: 2 }) },
  {
    id: "cost",
    header: "Landed cost (INR)",
    meta: { ...right, className: `w-[150px] ${wrap}` },
    cell: ({ row }) => {
      const cost = row.original.landedCost;
      if (!cost) return <span className="text-muted-foreground">No cost yet</span>;
      const part = (label: string, value: number | null) => `${label} ${value === null ? "–" : formatINR(value)}`;
      return (
        <span className="inline-flex flex-col items-end leading-[18px]">
          <span className="font-bold">{formatINR(cost.totalInr)}</span>
          <span className={line}>{part("Goods", cost.goodsInr)}</span>
          <span className={line}>{part("Sea freight", cost.seaFreightInr)}</span>
          <span className={line}>{part("Clearing", cost.clearingInr)}</span>
          <span className={line}>{part("Transport", cost.transportInr)}</span>
          {cost.perPieceInr === null ? null : <span className={line}>{`${formatINR(cost.perPieceInr, 2)} per piece`}</span>}
        </span>
      );
    },
  },
  {
    id: "final",
    header: "Status",
    meta: { className: `w-[150px] ${wrap}` },
    cell: ({ row }) => {
      const cost = row.original.landedCost;
      if (!cost) return "–";
      return (
        <span className="flex flex-col items-start gap-0.5 leading-[18px]">
          <StatusPill tone={cost.final ? "success" : "neutral"}>{cost.final ? "Final" : "Estimate"}</StatusPill>
          {!cost.final && cost.waitingFor ? <span className={sub}>{`waiting for ${cost.waitingFor}`}</span> : null}
          <span className={sub}>{row.original.protectedAt ? `Protected since ${formatDate(row.original.protectedAt)}` : "Not protected"}</span>
        </span>
      );
    },
  },
  {
    id: "containers",
    header: "Containers (shared records)",
    meta: { className: `w-[220px] ${wrap}` },
    cell: ({ row }) =>
      row.original.containers.length ? (
        <span className="flex flex-col gap-1 leading-[18px]">
          {row.original.containers.map((c) => (
            <span key={c.number} className="flex flex-col">
              <span className="font-bold">{`${c.number} · ${CONTAINER_STATUS[c.status]?.label ?? c.status}`}</span>
              {c.clearing ? (
                <span className={sub}>{`Duty ${formatINR(c.clearing.customsDutyInr)} · other ${formatINR(c.clearing.otherDutiesInr)} · agent ${formatINR(c.clearing.agentChargesInr)} · port ${formatINR(c.clearing.portChargesInr)}`}</span>
              ) : (
                <span className={sub}>No clearing yet</span>
              )}
              {c.transport ? <span className={sub}>{`Freight ${formatINR(c.transport.freightInr)} · handling ${formatINR(c.transport.handlingInr)}`}</span> : null}
            </span>
          ))}
        </span>
      ) : (
        <span className="text-muted-foreground">Not shipped</span>
      ),
  },
  {
    id: "agent",
    header: "Sea-freight payments (agent)",
    meta: { className: `w-[180px] ${wrap}` },
    cell: ({ row }) =>
      row.original.agentPayments.length ? (
        <span className="flex flex-col leading-[18px]">
          {row.original.agentPayments.map((p) => (
            <span key={p.id} className={p.voided ? "text-muted-foreground line-through" : undefined}>
              {`${formatMoney(p.amountCny, p.currency, { decimals: 2 })} · ${inrOrDash(p.amountInr)} · ${p.payee}`}
            </span>
          ))}
        </span>
      ) : (
        "–"
      ),
  },
];
export function HistoryLandedCostList({ list, linkPos }: { list: List<HistoryLandedCostOrder>; linkPos: boolean }) {
  return <PagedTable list={list} columns={landedColumns(linkPos)} param="page" itemLabel="orders" empty="No orders match these filters." getRowId={(row) => row.id} />;
}

// --- Events ----------------------------------------------------------------------------------------------------------

export const eventColumns = (linkPos: boolean, withSupplier: boolean): ColumnDef<HistoryEvent>[] => [
  {
    id: "date",
    header: "Date",
    meta: { className: "w-[96px]" },
    cell: ({ row }) => (
      <span className="flex flex-col leading-[18px]">
        <span>{dateText(row.original.date)}</span>
        {row.original.date ? null : <span className={sub}>recorded day</span>}
      </span>
    ),
  },
  {
    id: "type",
    header: "Event",
    meta: { className: `w-[170px] ${wrap}` },
    cell: ({ row }) => (
      <span className="flex flex-col items-start gap-0.5">
        <StatusPill tone={EVENT_TONE[row.original.type]}>{EVENT_LABEL[row.original.type]}</StatusPill>
        {row.original.status === "voided" && row.original.type !== "payment_voided" && row.original.type !== "agent_payment_voided" ? <span className={sub}>since voided</span> : null}
        {row.original.status === "held" ? <span className={sub}>on hold (pending review)</span> : null}
      </span>
    ),
  },
  ...(withSupplier
    ? [{ id: "supplier", header: "Supplier", meta: { className: `w-[140px] ${wrap}` }, cell: ({ row }: { row: { original: HistoryEvent } }) => row.original.supplier.name } satisfies ColumnDef<HistoryEvent>]
    : []),
  {
    id: "po",
    header: "PO / Reference",
    meta: { className: `w-[130px] ${wrap}` },
    cell: ({ row }) => (
      <span className="flex flex-col leading-[18px]">
        {row.original.po ? <span className="font-bold">{row.original.po.includes(",") ? row.original.po : <PoLink po={row.original.po} linked={linkPos} />}</span> : null}
        <span className={sub}>{row.original.reference ?? (row.original.po ? "" : "–")}</span>
      </span>
    ),
  },
  {
    id: "amount",
    header: "Amount",
    meta: { ...right, className: `w-[120px] ${wrap}` },
    cell: ({ row }) => (
      <span className="inline-flex flex-col items-end leading-[18px]">
        <span>{row.original.amount === null ? "–" : signedMoney(row.original.amount, row.original.currency)}</span>
        {row.original.amountInr === null ? null : <span className={line}>{formatINR(Math.abs(row.original.amountInr), 2)}</span>}
      </span>
    ),
  },
  {
    id: "details",
    header: "Details",
    meta: { className: `w-[260px] ${wrap}` },
    cell: ({ row }) => (
      <span className="flex flex-col leading-[18px]">
        <span>{row.original.details}</span>
        {row.original.reason ? <span className={sub}>{`Reason: ${row.original.reason}`}</span> : null}
      </span>
    ),
  },
  { id: "recorded", header: "Recorded", meta: { className: `w-[150px] ${wrap}` }, cell: ({ row }) => <Recorded at={row.original.recordedAt} by={row.original.actor} migrated={row.original.origin === "migrated"} /> },
];
export function HistoryEventsList({ list, linkPos, withSupplier = false }: { list: List<HistoryEvent>; linkPos: boolean; withSupplier?: boolean }) {
  return <PagedTable list={list} columns={eventColumns(linkPos, withSupplier)} param="page" itemLabel="events" empty="No events match these filters." getRowId={(row) => row.id} />;
}

// --- Legacy archive --------------------------------------------------------------------------------------------------

/** The legacy advance archive as the supplier ledger shows it (its own columns), read-only. */
export function ArchiveAdvancesTable({ entries }: { entries: AdvanceArchiveEntry[] }) {
  return <DataTable columns={archiveColumns} data={entries} getRowId={(entry) => entry.id} size="sm" header="tall" pagination={{ pageSize: 15, itemLabel: "entries" }} />;
}
