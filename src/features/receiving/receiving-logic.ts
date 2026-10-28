import { format, parseISO } from "date-fns";
import { z } from "zod";

import type { CreateReceiptBody, ReceiptListItem, ReceiptOptions } from "@/lib/api/types";
import { formatNumber, formatQty, formatShortDate } from "@/lib/formatters";

import type { ReceiptLine, ReceiptRow, ReceiptState } from "./data/queries";

export const ALL = "all";

export type ReceiptFilters = { query: string; office: string; supplier: string; state: ReceiptState | typeof ALL };

/** Client-side list filtering: PO or supplier search, office, supplier and status chip. */
export function filterReceipts(rows: ReceiptRow[], { query, office, supplier, state }: ReceiptFilters) {
  const q = query.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (!q || r.po.toLowerCase().includes(q) || r.supplier.toLowerCase().includes(q)) &&
      (office === ALL || r.office === office) &&
      (supplier === ALL || r.supplier === supplier) &&
      (state === ALL || r.state === state),
  );
}

export const uniqueSorted = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));

/**
 * REC-1 row -> list row. Complete once the main line's total reaches the order; otherwise partly received with "–"
 * in Short, as the reference draws a partly received row. "Short" needs a counted-short fact REC-1 doesn't have.
 */
export function toReceiptRow(r: ReceiptListItem): ReceiptRow {
  const complete = r.totalSoFar >= r.ordered;
  return {
    id: r.id,
    receivedOn: r.receivedOn,
    po: r.po,
    supplier: r.supplier,
    item: r.item,
    office: r.office,
    ordered: r.ordered,
    unit: r.unit,
    thisReceipt: r.thisReceipt,
    totalSoFar: r.totalSoFar,
    short: complete ? 0 : null,
    bundles: r.bundles,
    receivedBy: r.receivedBy,
    state: complete ? "complete" : "partly",
    statusLabel: complete ? "Complete" : "Partly received",
  };
}

/** Each order's latest receipt: totalSoFar only grows, so the highest one. */
function latestPerOrder(items: ReceiptListItem[]) {
  const latest = new Map<string, ReceiptListItem>();
  for (const r of items) {
    const seen = latest.get(r.orderId);
    if (!seen || r.totalSoFar > seen.totalSoFar) latest.set(r.orderId, r);
  }
  return [...latest.values()];
}

/** List KPIs with today in India. `options` null (no REC-2 access): waiting is unknown. */
export function receivingKpis(items: ReceiptListItem[], options: ReceiptOptions | null, today: string) {
  const thisMonth = items.filter((r) => r.receivedOn.slice(0, 7) === today.slice(0, 7));
  const partlyPos = latestPerOrder(items)
    .filter((r) => r.totalSoFar < r.ordered)
    .map((r) => r.po);
  return {
    month: format(parseISO(today), "MMMM"),
    receiptsThisMonth: thisMonth.length,
    receiptsSupplierCount: new Set(thisMonth.map((r) => r.supplier)).size,
    /** Orders with nothing received yet ("not yet in China office"). */
    waitingToBeReceived: options ? options.orders.filter((o) => o.lines.every((l) => l.receivedEarlier === 0)).length : null,
    partlyReceived: partlyPos.length,
    partlyReceivedPos: partlyPos,
  };
}

/** Quantity still missing after this receipt; never negative. */
export const lineShort = (line: ReceiptLine) => Math.max(0, line.ordered - line.receivedEarlier - line.receivedNow);

/** Effect on payment: balance before this receipt, less the value of short priced lines. */
export function paymentEffect(payment: { orderValue: number; depositsPaid: number }, lines: ReceiptLine[]) {
  const balanceBefore = payment.orderValue - payment.depositsPaid;
  const deductions = lines.flatMap((line) => {
    if (line.unitPrice === undefined) return [];
    const short = lineShort(line);
    return [{ unit: line.unit, short, unitPrice: line.unitPrice, amount: short * line.unitPrice }];
  });
  const balanceNow = balanceBefore - deductions.reduce((sum, d) => sum + d.amount, 0);
  return { balanceBefore, deductions, balanceNow };
}

/** Deliveries panel: the order's earlier receipts (REC-1, oldest first) and the total so far. Main-line figures. */
export function deliveryEvents(items: ReceiptListItem[], orderId: string) {
  const receipts = items.filter((r) => r.orderId === orderId).reverse();
  const latest = latestPerOrder(receipts)[0];
  if (!latest) return [];
  return [
    ...receipts.map((r) => ({
      title: `${formatShortDate(r.receivedOn)} · ${r.office}`,
      lines: [`${formatQty(r.thisReceipt, r.unit)} ${r.item} in ${formatNumber(r.bundles)} bundles`, `Received by ${r.receivedBy}`],
      marker: "ring" as const,
    })),
    {
      title: "Total so far",
      lines: [
        `${formatNumber(latest.totalSoFar)} of ${formatQty(latest.ordered, latest.unit)}`,
        `${formatNumber(receipts.reduce((sum, r) => sum + r.bundles, 0))} bundles`,
      ],
      marker: "ring" as const,
    },
  ];
}

// Record receipt form. Quantities stay strings while typed; an empty "Received now" counts as 0.
// Proposed wording (not yet in MESSAGES): the messages below.
const WHOLE = "Enter a whole number.";
/** REC-3's own message for field `shortRemark`. */
export const SHORT_REMARK = "Add a remark about the short items.";

/** REC-3 rule: a short remark is required while any line of the order is still short after this receipt. */
export const remarkRequired = (order: ReceiptOptions["orders"][number] | undefined, lines: { orderLineId: string; quantity: string }[]) =>
  !!order?.lines.some((l) => l.receivedEarlier + (Number(lines.find((v) => v.orderLineId === l.orderLineId)?.quantity) || 0) < l.ordered);

/** Client checks mirroring REC-3: whole numbers >= 0, at least one line > 0, no over-receipt, not after today, remark when short. */
export function receiptSchema(options: ReceiptOptions, today: string) {
  return z
    .object({
      orderId: z.string().min(1, "Choose an order."),
      receivedOn: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date received.")
        .refine((date) => date <= today, "The date can't be after today."),
      locationId: z.string().min(1, "Choose an office."),
      bundles: z.string().trim().regex(/^\d+$/, WHOLE),
      deliveryNote: z.string(),
      shortRemark: z.string(),
      lines: z.array(z.object({ orderLineId: z.string(), quantity: z.string().trim().regex(/^\d*$/, WHOLE) })),
    })
    .superRefine((values, ctx) => {
      const order = options.orders.find((o) => o.orderId === values.orderId);
      values.lines.forEach((line, index) => {
        const orderLine = order?.lines.find((l) => l.orderLineId === line.orderLineId);
        const left = orderLine ? orderLine.ordered - orderLine.receivedEarlier : 0;
        if (orderLine && Number(line.quantity) > left) {
          ctx.addIssue({ code: "custom", path: ["lines", index, "quantity"], message: `Only ${formatQty(left, orderLine.unit)} left to receive.` });
        }
      });
      if (values.lines.every((line) => !Number(line.quantity))) {
        ctx.addIssue({ code: "custom", path: ["lines"], message: "Enter what was received for at least one item." });
      }
      if (!values.shortRemark.trim() && remarkRequired(order, values.lines)) {
        ctx.addIssue({ code: "custom", path: ["shortRemark"], message: SHORT_REMARK });
      }
    });
}
export type ReceiptFormValues = z.infer<ReturnType<typeof receiptSchema>>;

export const emptyLines = (options: ReceiptOptions, orderId: string) =>
  (options.orders.find((o) => o.orderId === orderId)?.lines ?? []).map((l) => ({ orderLineId: l.orderLineId, quantity: "" }));

/** The REC-3 body, exactly. */
export const toReceiptBody = (v: ReceiptFormValues): CreateReceiptBody => ({
  orderId: v.orderId,
  receivedOn: v.receivedOn,
  locationId: v.locationId,
  bundles: Number(v.bundles),
  deliveryNote: v.deliveryNote.trim(),
  shortRemark: v.shortRemark.trim(),
  lines: v.lines.map((l) => ({ orderLineId: l.orderLineId, quantity: Number(l.quantity) })),
});
