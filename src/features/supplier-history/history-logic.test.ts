import { describe, expect, it } from "vitest";

import type { HistoryEvent } from "@/lib/api/supplier-history-types";

import { toCsv } from "../reports/csv";
import { csvRows } from "../reports/report-files";
import { historyFile } from "./history-file";
import { historyFilterLabel, historyQuery, MIGRATED, NOT_RECORDED, signedMoney } from "./history-logic";

const event = (over: Partial<HistoryEvent>): HistoryEvent => ({
  id: "ledger:1",
  type: "payment_recorded",
  date: "2026-11-20",
  recordedAt: "2026-11-20T06:00:00.000Z",
  origin: "app",
  actor: "Suresh Menon",
  supplier: { id: "s1", name: "Foshan Fabrics", code: "SUP-005" },
  currency: "CNY",
  amount: 500,
  amountInr: 6000,
  po: null,
  reference: "UTR-1",
  details: "Payment · Bank transfer",
  reason: null,
  status: "active",
  ...over,
});

describe("historyQuery: the page URL as the API's strict query", () => {
  it("keeps valid filters, swaps reversed dates and drops malformed ones (never a 400 from a hand-edited URL)", () => {
    const id = "6f1c2c1e-1d2b-4c3a-9b8a-7a6b5c4d3e2f";
    expect(historyQuery(new URLSearchParams(`from=2026-11-30&to=2026-11-01&q=UTR&status=voided&type=payment_voided&supplier=${id}&page=2`), { statuses: ["active", "voided"], events: true, supplier: true })).toBe(
      `?from=2026-11-01&to=2026-11-30&q=UTR&status=voided&types=payment_voided&supplierId=${id}&page=2`,
    );
    expect(historyQuery(new URLSearchParams("from=2026-13-01&status=nope&type=nope&supplier=x&page=0"), { statuses: ["active"], events: true, supplier: true })).toBe("");
    // A list without event types or a supplier never sends them.
    expect(historyQuery(new URLSearchParams("type=payment_voided&supplier=6f1c2c1e-1d2b-4c3a-9b8a-7a6b5c4d3e2f"))).toBe("");
  });

  it("signs amounts as the ledger does and spells out the filters", () => {
    expect(signedMoney(500, "CNY")).toBe("+¥500.00");
    expect(signedMoney(-25, "USD")).toBe("−$25.00");
    expect(signedMoney(null, "CNY")).toBe("–");
    expect(historyFilterLabel({ supplier: "Foshan Fabrics", from: "2026-11-01", to: "2026-11-30", types: ["payment_voided"], status: "voided", q: "UTR" })).toBe(
      "Foshan Fabrics · 1 Nov 2026 to 30 Nov 2026 · Payment voided · Voided · “UTR”",
    );
    expect(historyFilterLabel({ from: null, to: null })).toBeNull();
  });
});

describe("historyFile: every matching event, labelled honestly", () => {
  it("writes each event with its own currency, labels migrated postings and unrecorded authors, counts by type, and names the supplier without its code", () => {
    const file = historyFile(
      [event({}), event({ id: "ledger:2", type: "payment_voided", amount: -500, reason: "Entered twice" }), event({ id: "ledger:3", origin: "migrated", actor: null, recordedAt: "2026-11-23T06:26:00Z" }), event({ id: "receipt:1", type: "receipt_recorded", actor: null, currency: null, amount: null, amountInr: null })],
      { title: "Supplier history", filename: "supplier-history-2026-11-25", filters: "Foshan Fabrics", withSupplier: true },
    );
    expect(file.sections[0]!.rows).toEqual([
      ["Events", 4],
      ["Payment", 2],
      ["Payment voided", 1],
      ["Goods received (China)", 1],
    ]);
    const events = file.sections[1]!;
    const at = (header: string) => events.columns.findIndex((column) => column.header === header);
    expect(events.rows[1]![at("Amount (signed)")]).toBe(-500);
    expect(events.rows[1]![at("Reason")]).toBe("Entered twice");
    expect(events.rows[2]![at("Recorded at")]).toBe(MIGRATED);
    expect(events.rows[3]![at("Recorded by")]).toBe(NOT_RECORDED);
    // Owner decision of 2026-11-25: the supplier's name, never its code, in every format (one ReportFile feeds all three).
    expect(events.columns.map((column) => column.header)).toEqual([
      "Date",
      "Event",
      "Supplier",
      "PO",
      "Reference",
      "Currency",
      "Amount (signed)",
      "Amount (INR)",
      "Status",
      "Details",
      "Reason",
      "Recorded at",
      "Recorded by",
    ]);
    expect(events.rows.every((row) => row.length === events.columns.length && row[at("Supplier")] === "Foshan Fabrics")).toBe(true);
    const csv = toCsv(csvRows(file));
    expect(csv).toContain("Foshan Fabrics");
    expect(csv).not.toContain("SUP-005");
    expect(csv).not.toContain("Supplier code");
  });
});
