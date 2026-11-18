import { describe, expect, it } from "vitest";

import { csvRows } from "@/features/reports/report-files";
import { toPdf } from "@/features/reports/pdf";
import { toXlsx } from "@/features/reports/xlsx";
import type { SupplierStatement } from "@/lib/api/deposits-types";

import { advanceFile, advanceSections, depositsFile, filterLabel, statementFile, suppliersFile } from "./deposit-files";
import { type DepositRow, EMPTY_FILTERS, supplierSummaries } from "./deposits-logic";

const TODAY = "2026-11-10";
const rows: DepositRow[] = [
  { id: "o2", kind: "order", supplierId: "s1", supplier: "Foshan Fabrics", payee: "Foshan Fabrics", po: "PO-3002", currency: "CNY", amount: 1000, paid: 300, pending: 700, date: "2026-11-02", mode: "", reference: "", notes: "", status: "partly paid", href: "/orders/PO-3002/payments", payments: 1, rate: null, amountInr: null },
  { id: "p1", kind: "order", supplierId: "s1", supplier: "Foshan Fabrics", payee: "Sino Freight", po: "PO-3001", currency: "CNY", amount: 300, paid: 300, pending: 0, date: "2026-10-21", mode: "Bank transfer", reference: "UTR 9", notes: "Half", status: "paid", href: "/orders/PO-3001", payeeRole: "agent", rate: 12.1, amountInr: 3630 },
  { id: "d1", kind: "give", supplierId: "s1", supplier: "Foshan Fabrics", payee: "Foshan Fabrics", po: null, currency: "USD", amount: 200, paid: 50, pending: 150, date: "2026-10-05", mode: "", reference: "", notes: "", status: "partly settled", href: "/deposits/suppliers/s1", rate: 11.9, amountInr: null },
  { id: "d2", kind: "receive", supplierId: "s1", supplier: "Foshan Fabrics", payee: "", po: null, currency: "CNY", amount: 500, paid: 0, pending: 500, date: "2026-10-10", mode: "", reference: "Mould", notes: "", status: "open", href: "/deposits/suppliers/s1", rate: null, amountInr: null },
];
const suppliers = [{ id: "s1", name: "Foshan Fabrics" }];

describe("depositsFile", () => {
  it("writes the rows shown as one table per currency, amounts under headers naming the currency", () => {
    const file = depositsFile("pending", rows, "All deposits", TODAY);
    expect(file).toMatchObject({ title: "Pending deposits", filename: `deposits-pending-${TODAY}`, filters: "All deposits" });
    // The summary block (Excel and PDF only), then one table per currency.
    expect(file.sections).toHaveLength(3);
    expect(file.sections[0]).toMatchObject({ sheet: "Summary", csv: false });
    expect(file.sections[0]!.rows).toEqual([
      ["Deposits to pay", "3 · CNY 1,300.00 · USD 200.00"],
      ["Paid", "CNY 600.00 · USD 50.00"],
      ["Pending to pay", "CNY 700.00 · USD 150.00"],
      ["Deposits to receive", "1 · CNY 500.00"],
      ["Received", "CNY 0.00"],
      ["Pending to receive", "CNY 500.00"],
    ]);
    const [, cny, usd] = file.sections;
    expect(cny!.columns.map((c) => c.header)).toEqual([
      "Supplier", "PO", "Kind", "Paid to", "Currency", "Amount (CNY)", "Paid / settled (CNY)", "Pending (CNY)", "Exchange rate (INR per 1 CNY)", "INR equivalent (INR)", "Date", "Mode", "Reference", "Notes", "Status", "Payments",
    ]);
    expect(cny!.columns[8]).toEqual({ header: "Exchange rate (INR per 1 CNY)", rate: true });
    // Payments: the obligation row's count; blank on the others. The rate is each row's own snapshot.
    expect(cny!.rows).toEqual([
      ["Foshan Fabrics", "PO-3002", "Order deposit", "Foshan Fabrics", "CNY", 1000, 300, 700, null, null, "2026-11-02", "", "", "", "Partly paid", 1],
      ["Foshan Fabrics", "PO-3001", "Order deposit (to shipping agent)", "Sino Freight", "CNY", 300, 300, 0, 12.1, 3630, "2026-10-21", "Bank transfer", "UTR 9", "Half", "Paid", ""],
      ["Foshan Fabrics", "", "To receive", "", "CNY", 500, 0, 500, null, null, "2026-10-10", "", "Mould", "", "Open", ""],
    ]);
    expect(usd!.rows).toEqual([["Foshan Fabrics", "", "To give", "Foshan Fabrics", "USD", 200, 50, 150, 11.9, null, "2026-10-05", "", "", "", "Partly settled", ""]]);
    // Nothing shown: one empty CNY table, written as "No rows"; the CSV leaves the summary out.
    const csv = csvRows(depositsFile("all", [], "All deposits", TODAY));
    expect(csv.slice(0, 2).map((line) => line[0])).toEqual(["Deposits (CNY)", "Supplier"]);
    expect(csv.at(-1)).toEqual(["No rows"]);
  });

  it("names the filters in force", () => {
    expect(filterLabel(EMPTY_FILTERS, suppliers)).toBe("All deposits");
    expect(filterLabel({ supplierId: "s1", po: " 3001 ", from: "2026-10-01", to: "", status: "paid", currency: "CNY", kind: "order" }, suppliers)).toBe(
      "Supplier: Foshan Fabrics · PO: 3001 · Dates: 1 Oct 2026 to today · Status: Paid · Currency: CNY · Kind: Order deposit",
    );
  });
});

describe("suppliersFile", () => {
  it("writes a supplier's six figures per currency it has deposits in", () => {
    const file = suppliersFile(supplierSummaries(rows), "All deposits", TODAY);
    expect(file.title).toBe("Deposits by supplier");
    expect(file.sections.map((s) => s.columns[1]!.header)).toEqual(["To give (CNY)", "To give (USD)"]);
    expect(file.sections[0]!.rows).toEqual([["Foshan Fabrics", 0, 0, 0, 500, 0, 500]]);
    expect(file.sections[1]!.rows).toEqual([["Foshan Fabrics", 200, 50, 150, 0, 0, 0]]);
  });
});

const statement: SupplierStatement = {
  supplier: { id: "s1", name: "Foshan Fabrics", contactPerson: "Mr. Chen Hao", phone: "+86 137", city: "Foshan", currency: "CNY", status: "Active" },
  summary: [
    { currency: "CNY", direction: "give", amount: 1000, settled: 300, pending: 700 },
    { currency: "CNY", direction: "receive", amount: 500, settled: 100, pending: 400 },
  ],
  deposits: [
    {
      id: "d2", supplierId: "s1", supplier: "Foshan Fabrics", direction: "receive", currency: "CNY", exchangeRate: null, amount: 500, settled: 100, pending: 400, status: "partly settled", openedOn: "2026-10-10", reference: "Mould", notes: "", transactions: [{ id: "t2", paidOn: "2026-10-12", amount: 100, mode: "Cash", reference: "", notes: "" }],
    },
    {
      id: "d1", supplierId: "s1", supplier: "Foshan Fabrics", direction: "give", currency: "CNY", exchangeRate: null, amount: 1000, settled: 300, pending: 700, status: "partly settled", openedOn: "2026-10-01", reference: "", notes: "Tooling", transactions: [{ id: "t1", paidOn: "2026-10-05", amount: 300, mode: "Bank transfer", reference: "TXN 1", notes: "" }],
    },
  ],
};

describe("statementFile", () => {
  it("writes each deposit's rate when opened and its INR equivalent at that rate", () => {
    const rated = { ...statement, deposits: [{ ...statement.deposits[1]!, currency: "USD" as const, exchangeRate: 84.1234, amount: 1234.5, amountInr: 103850.34 }] };
    const file = statementFile(rated, TODAY);
    const give = file.sections.find((s) => s.sheet === "Deposit to Give")!;
    expect(give.columns.map((c) => c.header).slice(4, 6)).toEqual(["Rate when opened (INR per 1 USD)", "INR equivalent (INR)"]);
    expect(give.rows[0]!.slice(4, 6)).toEqual([84.1234, 103850.34]);
  });

  it("has the Summary, Deposit to Give, Deposit to Receive and Transactions sheets, never netting the directions", () => {
    const file = statementFile(statement, TODAY);
    expect(file).toMatchObject({ title: "Supplier deposits: Foshan Fabrics", filename: `supplier-deposits-foshan-fabrics-${TODAY}`, filters: "Supplier: Foshan Fabrics" });
    expect(file.sections.map((s) => s.sheet)).toEqual(["Summary", "Deposit to Give", "Deposit to Receive", "Transactions"]);
    expect(file.sections[0]!.rows).toEqual([
      ["Give", 1000, 300, 700],
      ["Receive", 500, 100, 400],
    ]);
    // The supplier's rate when the deposit was opened (none here: opened before rates were saved).
    // Rate when opened and INR equivalent: none on these (opened without a rate).
    expect(file.sections[1]!.rows).toEqual([["2026-10-01", 1000, 300, 700, null, null, "Partly settled", "", "Tooling"]]);
    expect(file.sections[2]!.rows).toEqual([["2026-10-10", 500, 100, 400, null, null, "Partly settled", "Mould", ""]]);
    expect(file.sections[3]!.columns.map((c) => c.header)).toEqual(["Date", "Deposit", "Amount (CNY)", "Mode", "Reference", "Notes"]);
    expect(file.sections[3]!.rows).toEqual([
      ["2026-10-12", "Receive · opened 10 Oct 2026", 100, "Cash", "", ""],
      ["2026-10-05", "Give · opened 1 Oct 2026", 300, "Bank transfer", "TXN 1", ""],
    ]);
    // A supplier with nothing yet still gets the four sheets, each saying "No rows".
    const empty = statementFile({ ...statement, summary: [], deposits: [] }, TODAY);
    expect(empty.sections.map((s) => s.sheet)).toEqual(["Summary", "Deposit to Give", "Deposit to Receive", "Transactions"]);
    expect(empty.sections.every((s) => s.rows.length === 0)).toBe(true);
  });

  it("writes as Excel and PDF through the shared writers", () => {
    const file = statementFile(statement, TODAY);
    const xlsx = toXlsx(file, "Generated 10 Nov 2026, 10:00");
    expect(xlsx.byteLength).toBeGreaterThan(1000);
    const pdf = toPdf(file, "Generated 10 Nov 2026, 10:00");
    expect(new TextDecoder("latin1").decode(pdf.slice(0, 8))).toBe("%PDF-1.4");
  });
});

// Supplier advance account (backend docs/supplier-advance.md): its own sheets, never netted with the deposits.
const account: NonNullable<SupplierStatement["advance"]> = {
  summary: [{ currency: "CNY", receivedCny: 1000, allocatedCny: 600, reversedCny: 200, availableCny: 600, orders: 1 }],
  entries: [
    { id: "e3", kind: "reversal", entryDate: "2026-10-20", currency: "CNY", amount: 200, exchangeRate: 12, amountInr: 2400, advanceId: "e1", advancePaidOn: "2026-10-01", advanceReference: "UTR 1", reversalOf: "e2", orderId: null, po: "PO-3001", mode: "", reference: "", notes: "", recordedAt: "2026-10-20T05:00:00Z", recordedBy: "Suresh", balance: 600 },
    { id: "e2", kind: "allocation", entryDate: "2026-10-10", currency: "CNY", amount: 600, exchangeRate: 12, amountInr: 7200, advanceId: "e1", advancePaidOn: "2026-10-01", advanceReference: "UTR 1", reversalOf: null, orderId: null, po: "PO-3001", mode: "", reference: "", notes: "", recordedAt: "2026-10-10T05:00:00Z", recordedBy: "Priya", balance: 400 },
    { id: "e1", kind: "receipt", entryDate: "2026-10-01", currency: "CNY", amount: 1000, exchangeRate: 12, amountInr: 12000, advanceId: null, advancePaidOn: null, advanceReference: null, reversalOf: null, orderId: null, po: "", mode: "Bank transfer", reference: "UTR 1", notes: "Season", recordedAt: "2026-10-01T05:00:00Z", recordedBy: "Anita", balance: 1000 },
  ],
};

describe("supplier advance in the deposit files", () => {
  it("writes the account's totals and its ledger (signed, with the balance after each entry) on their own sheets", () => {
    const file = statementFile({ ...statement, advance: account }, TODAY);
    expect(file.sections.map((s) => s.sheet)).toEqual(["Summary", "Deposit to Give", "Deposit to Receive", "Transactions", "Advance Summary", "Advance Ledger"]);
    // Recorded, added, excess, order deposits, applied from added, returned, applied net, available, orders.
    expect(file.sections[4]!.rows).toEqual([[1000, 1000, 0, 0, 600, 200, 400, 600, 1]]);
    expect(file.sections[5]!.rows.map((r) => [r[1], r[2], r[3], r[6]])).toEqual([
      ["Returned from order", "PO-3001", 200, 600],
      ["Applied to order", "PO-3001", -600, 400],
      ["Advance received", "", 1000, 1000],
    ]);
    // advanceFile: the same sections as a standalone report; a filtered ledger keeps the order given.
    const own = advanceFile({ name: "Foshan Fabrics", currency: "CNY" }, account, account.entries.slice(1), "Type: all", TODAY);
    expect(own).toMatchObject({ title: "Supplier advance: Foshan Fabrics", filename: `supplier-advance-foshan-fabrics-${TODAY}` });
    expect(own.sections[1]!.rows.map((r) => r[0])).toEqual(["2026-10-10", "2026-10-01"]);
    expect(advanceSections(undefined)).toEqual([]);
  });

  it("adds a Supplier Advances sheet to the deposits file only when DEP-1 sent advances", () => {
    expect(depositsFile("all", rows, "All deposits", TODAY).sections.some((s) => s.sheet === "Supplier Advances")).toBe(false);
    const file = depositsFile("all", rows, "All deposits", TODAY, [{ supplierId: "s1", supplier: "Foshan Fabrics", ...account.summary[0]! }]);
    const sheet = file.sections.find((s) => s.sheet === "Supplier Advances")!;
    expect(sheet.columns.map((c) => c.header)).toEqual([
      "Supplier",
      "Advance recorded (CNY)",
      "Added as advance (CNY)",
      "Excess payments (CNY)",
      "Order deposits (CNY)",
      "Applied from added advance (CNY)",
      "Returned from orders (CNY)",
      "Applied to orders (net) (CNY)",
      "Available (CNY)",
      "Orders",
    ]);
    expect(sheet.rows).toEqual([["Foshan Fabrics", 1000, 1000, 0, 0, 600, 200, 400, 600, 1]]);
  });

  it("order deposits: in the totals as recorded and applied, in the history once, unsigned, never moving the balance", () => {
    const withDeposit = {
      ...account,
      summary: [{ ...account.summary[0]!, depositsCny: 500, orders: 2 }],
      deposits: [
        { id: "p1", orderId: "o2", po: "PO-3002", paidOn: "2026-10-15", currency: "CNY" as const, amount: 500, exchangeRate: 12.2, amountInr: 6100, mode: "Bank transfer", reference: "DEP 9", notes: "", recordedAt: "2026-10-15T05:00:00Z", recordedBy: "Priya", balance: 400 },
      ],
    };
    const file = statementFile({ ...statement, advance: withDeposit }, TODAY);
    // Recorded 1,000 + 500; applied net 600 - 200 + 500; available stays the ledger's 600.
    expect(file.sections[4]!.rows).toEqual([[1500, 1000, 0, 500, 600, 200, 900, 600, 2]]);
    expect(file.sections[5]!.rows.map((r) => [r[0], r[1], r[2], r[3], r[6]])).toEqual([
      ["2026-10-20", "Returned from order", "PO-3001", 200, 600],
      ["2026-10-15", "Order deposit", "PO-3002", 500, 400],
      ["2026-10-10", "Applied to order", "PO-3001", -600, 400],
      ["2026-10-01", "Advance received", "", 1000, 1000],
    ]);
  });

  it("excess payments: recorded and available, never applied twice; taken back with a minus", () => {
    const withExcess = {
      summary: [{ currency: "USD" as const, receivedCny: 0, excessCny: 270.14, allocatedCny: 100, reversedCny: 0, availableCny: 170.14, depositsCny: 0, orders: 1 }],
      entries: [
        { ...account.entries[1]!, id: "x2", currency: "USD" as const, amount: 100, exchangeRate: 102.25, amountInr: 10225, advanceId: "x1", po: "PO-12000", balance: 170.14 },
        { ...account.entries[2]!, id: "x1", kind: "excess" as const, currency: "USD" as const, amount: 270.14, exchangeRate: 102.25, amountInr: 27621.82, po: "PO-11218", mode: "Wire", reference: "UTR-9", balance: 270.14 },
      ],
    };
    const file = statementFile({ ...statement, advance: withExcess }, TODAY);
    // Recorded 270.14 (all excess); applied 100; available 170.14 = recorded - applied.
    expect(file.sections[4]!.rows).toEqual([[270.14, 0, 270.14, 0, 100, 0, 100, 170.14, 1]]);
    expect(file.sections[5]!.rows.map((r) => [r[1], r[2], r[3], r[6]])).toEqual([
      ["Applied to order", "PO-12000", -100, 170.14],
      ["Excess payment", "PO-11218", 270.14, 270.14],
    ]);
  });
});
