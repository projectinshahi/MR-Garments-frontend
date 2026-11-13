import { type Column, type ReportFile, summarySection } from "@/features/reports/report-files";

import type { ReceiptRow, ReceivingListData } from "./data/queries";

// Receiving (China) report download (backend docs/report-downloads.md): every receipt the page's search, office,
// supplier and status filters match, then each receipt's lines with the ordered quantity, what this receipt brought and
// the line's total so far, and the shortage or excess against the order. Quantities stay numbers, the unit apart.

const text = (header: string): Column => ({ header });
const date = (header: string): Column => ({ header, date: true });
const short = (ordered: number, received: number) => Math.max(0, ordered - received);
const excess = (ordered: number, received: number) => Math.max(0, received - ordered);

export function receivingFile(rows: ReceiptRow[], kpis: ReceivingListData["kpis"], filters: string, today: string): ReportFile {
  const lines = rows.flatMap((r) => r.lines.map((line) => ({ ...line, receipt: r })));
  return {
    title: "Receiving (China)",
    filename: `receiving-${today}`,
    filters,
    notes: [
      "Short and excess compare an order line's quantity with everything received for it so far (all receipts), not only this receipt.",
      "In containers: containers that already hold goods only this receipt covers.",
    ],
    sections: [
      summarySection([
        ["Receipts", rows.length],
        ["Orders", new Set(rows.map((r) => r.orderId)).size],
        ["Suppliers", new Set(rows.map((r) => r.supplier)).size],
        ["Bundles received", rows.reduce((sum, r) => sum + r.bundles, 0)],
        [`Receipts in ${kpis.month}`, kpis.receiptsThisMonth],
        ["Waiting to be received", kpis.waitingToBeReceived ?? "Not in your access"],
        ["Partly received orders", kpis.partlyReceived],
      ]),
      {
        sheet: "Receipts",
        title: "Receipts",
        columns: [
          date("Received on"),
          text("PO"),
          text("Supplier"),
          text("Office"),
          text("Main item"),
          text("Ordered qty"),
          text("This receipt"),
          text("Total so far"),
          text("Short"),
          text("Excess"),
          text("Unit"),
          text("Bundles"),
          text("Received by"),
          text("Status"),
          text("Delivery note"),
          text("Short remark"),
          text("In containers"),
        ],
        rows: rows.map((r) => [
          r.receivedOn,
          r.po,
          r.supplier,
          r.office,
          r.item,
          r.ordered,
          r.thisReceipt,
          r.totalSoFar,
          short(r.ordered, r.totalSoFar),
          excess(r.ordered, r.totalSoFar),
          r.unit,
          r.bundles,
          r.receivedBy,
          r.statusLabel,
          r.deliveryNote || null,
          r.shortRemark || null,
          r.containers ? r.containers.join(", ") || "None" : null,
        ]),
      },
      {
        sheet: "Received Items",
        title: "Received items",
        columns: [
          date("Received on"),
          text("PO"),
          text("Supplier"),
          text("Item"),
          text("Unit"),
          text("Ordered qty"),
          text("This receipt"),
          text("Received so far"),
          text("Short"),
          text("Excess"),
        ],
        rows: lines.map(({ receipt, item, unit, quantity, ordered, received }) => [
          receipt.receivedOn,
          receipt.po,
          receipt.supplier,
          item,
          unit,
          ordered,
          quantity,
          received,
          ordered === null || received === null ? null : short(ordered, received),
          ordered === null || received === null ? null : excess(ordered, received),
        ]),
      },
    ],
  };
}
