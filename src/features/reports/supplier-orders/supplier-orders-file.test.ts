import { describe, expect, it } from "vitest";

import { toCsv } from "../csv";
import { DOLLAR_COST_NOTE } from "../dollar-cost";
import { OUTSTANDING_NOTE, rowStatus } from "../order-reports/order-reports-file";
import { toPdf } from "../pdf";
import { csvRows } from "../report-files";
import { toXlsx } from "../xlsx";
import { containerText, landedCostStatus, NOT_LISTED_NOTE, perUnit, supplierOrdersFile } from "./supplier-orders-file";
import { data, row, TODAY } from "./test-fixtures";

// Supplier order details' files (RPT-S1): per supplier a table per currency, every order line per currency, the summary.

describe("supplierOrdersFile", () => {
  const file = supplierOrdersFile(data, TODAY);

  it("is named by today, spells out the filters and holds the summary, a table per supplier and currency, and the lines", () => {
    expect(file).toMatchObject({ title: "Supplier order details", filename: "supplier-order-details-2026-11-24", filters: "Ningbo Knits" });
    expect(file.sections.map((section) => section.title)).toEqual(["Summary", "Ningbo Knits: orders in CNY", "Ningbo Knits: orders in USD", "Order lines in CNY", "Order lines in USD"]);
    expect(file.notes).toEqual([OUTSTANDING_NOTE, DOLLAR_COST_NOTE, NOT_LISTED_NOTE]);
  });

  it("writes every order in full: items, quantities per unit, rates, values, Dollar Cost, money, status, containers and cost parts", () => {
    const usd = file.sections[2]!;
    const headers = usd.columns.map((column) => column.header);
    expect(headers).toContain("Dollar cost (USD)");
    expect(headers).not.toContain("Supplier code");
    const cells = Object.fromEntries(headers.map((header, index) => [header, usd.rows[0]![index]]));
    expect(cells).toEqual({
      PO: "PO-2050",
      "Order date": "2026-10-10",
      Supplier: "Ningbo Knits",
      Items: "Denim jeans; Cotton fabric",
      Ordered: "100 pcs · 50 m",
      Received: "120 pcs · 30 m",
      "Rates (USD)": "10.00; 8.00",
      "PO value (USD)": 1400,
      "Order value (received) (USD)": 1440,
      Currency: "USD",
      "Rate (INR per 1 USD)": 88,
      "USD rate (INR per 1 USD)": 88,
      "Dollar cost (USD)": 1440,
      "Paid (settled) (USD)": 800,
      "Outstanding (USD)": 640,
      "Payment status": "Partly paid",
      Status: rowStatus(row({}), TODAY).label,
      Stage: "6. India warehouse",
      Containers: "RPTU 1000001: On the sea, ETA 30 Nov 2026 (FOB, 150)",
      "Landed cost (INR)": 120000,
      "Goods (INR)": 70400,
      "Sea freight (INR)": 9600,
      "Clearing (INR)": 30000,
      "Transport (INR)": 10000,
      "Per piece (INR)": 800,
      "Landed cost status": "Estimate (waiting for supplier payment)",
    });
    // A CNY order with goods received has no USD rate: an empty Dollar Cost and no Dollar Cost total.
    const cnyTable = file.sections[1]!;
    const dollar = cnyTable.columns.findIndex((column) => column.header === "Dollar cost (USD)");
    expect(cnyTable.rows[0]![dollar]).toBeNull();
    expect(cnyTable.total![dollar]).toBeNull();
    expect(usd.total![dollar]).toBe(1440);
    expect(cnyTable.rows[0]![headers.indexOf("Containers")]).toBeNull();
  });

  it("lists every order line per currency with its own Dollar Cost, and summarises with the Dollar Cost gap spelt out", () => {
    const lines = file.sections[4]!;
    expect(lines.rows).toEqual([
      ["Ningbo Knits", "PO-2050", "2026-10-10", "Denim jeans", "pcs", 100, 120, 10, 1000, 1200, 1200],
      ["Ningbo Knits", "PO-2050", "2026-10-10", "Cotton fabric", "m", 50, 30, 8, 400, 240, 240],
    ]);
    expect(lines.total).toEqual(["Total", "1 order", null, "2 lines", null, null, null, null, 1400, 1440, 1440]);
    expect(file.sections[0]!.rows).toContainEqual(["Dollar cost (USD)", "No USD rate saved for 1 order"]);
    expect(file.sections[0]!.rows).toContainEqual(["Suppliers", 1]);
  });

  it("writes the same figures into the CSV, Excel and PDF files", () => {
    const csv = toCsv(csvRows(file));
    expect(csv).toContain("PO-2050,2026-10-10,Ningbo Knits");
    expect(csv).toContain("Dollar cost (USD)");
    const xlsx = new TextDecoder().decode(toXlsx(file, "Generated"));
    expect(xlsx).toContain('<sheet name="Orders by supplier"');
    expect(xlsx).toContain('<sheet name="Order lines"');
    const pdf = Array.from(toPdf(file, "Generated"), (byte) => String.fromCharCode(byte)).join("");
    expect(pdf).toContain("(Supplier order details) Tj");
    expect(pdf).toContain("(Ningbo Knits: orders in USD) Tj");
  });

  it("keeps one empty table with no total when nothing matches", () => {
    const empty = supplierOrdersFile({ ...data, suppliers: [], summary: { ...data.summary, orders: 0, suppliers: 0, byCurrency: [], dollarCost: { usd: 0, missing: 0 } } }, TODAY);
    expect(empty.sections.map((section) => section.title)).toEqual(["Summary", "No supplier: orders in CNY", "Order lines in CNY"]);
    expect(empty.sections[1]).toMatchObject({ rows: [], total: undefined });
  });

  it("writes containers, quantities per unit and the cost status as the page does", () => {
    expect(perUnit(row({}).lines, (line) => line.received)).toBe("120 pcs · 30 m");
    expect(perUnit([], (line) => line.received)).toBe("–");
    expect(containerText({ number: "MSCU 1", status: "arrived", terms: null, loadedOn: null, sailedOn: null, eta: null, quantity: 20 })).toBe("MSCU 1: Arrived, in clearing (20)");
    expect(landedCostStatus({ ...row({}).landedCost!, final: true, waitingFor: null })).toBe("Final");
  });
});
