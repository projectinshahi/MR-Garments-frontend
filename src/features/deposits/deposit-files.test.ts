import { describe, expect, it } from "vitest";

import { csvRows } from "@/features/reports/report-files";
import { toPdf } from "@/features/reports/pdf";
import { toXlsx } from "@/features/reports/xlsx";
import type { SupplierStatement } from "@/lib/api/deposits-types";

import { depositsFile, filterLabel, statementFile, suppliersFile } from "./deposit-files";
import { type DepositRow, EMPTY_FILTERS, supplierSummaries } from "./deposits-logic";

const TODAY = "2026-11-10";
const rows: DepositRow[] = [
  { id: "o2", kind: "order", supplierId: "s1", supplier: "Foshan Fabrics", payee: "Foshan Fabrics", po: "PO-3002", currency: "CNY", amount: 1000, paid: 300, pending: 700, date: "2026-11-02", mode: "", reference: "", notes: "", status: "partly paid", href: "/orders/PO-3002/payments", payments: 1 },
  { id: "p1", kind: "order", supplierId: "s1", supplier: "Foshan Fabrics", payee: "Sino Freight", po: "PO-3001", currency: "CNY", amount: 300, paid: 300, pending: 0, date: "2026-10-21", mode: "Bank transfer", reference: "UTR 9", notes: "Half", status: "paid", href: "/orders/PO-3001", payeeRole: "agent" },
  { id: "d1", kind: "give", supplierId: "s1", supplier: "Foshan Fabrics", payee: "Foshan Fabrics", po: null, currency: "USD", amount: 200, paid: 50, pending: 150, date: "2026-10-05", mode: "", reference: "", notes: "", status: "partly settled", href: "/deposits/suppliers/s1" },
  { id: "d2", kind: "receive", supplierId: "s1", supplier: "Foshan Fabrics", payee: "", po: null, currency: "CNY", amount: 500, paid: 0, pending: 500, date: "2026-10-10", mode: "", reference: "Mould", notes: "", status: "open", href: "/deposits/suppliers/s1" },
];
const suppliers = [{ id: "s1", name: "Foshan Fabrics" }];

describe("depositsFile", () => {
  it("writes the rows shown as one table per currency, amounts under headers naming the currency", () => {
    const file = depositsFile("pending", rows, "All deposits", TODAY);
    expect(file).toMatchObject({ title: "Pending deposits", filename: `deposits-pending-${TODAY}`, filters: "All deposits" });
    expect(file.sections).toHaveLength(2);
    expect(file.sections[0]!.columns.map((c) => c.header)).toEqual(["Supplier", "PO", "Kind", "Paid to", "Amount (CNY)", "Paid / settled (CNY)", "Pending (CNY)", "Date", "Mode", "Reference", "Notes", "Status", "Payments"]);
    // Payments: the obligation row's count; blank on the others.
    expect(file.sections[0]!.rows).toEqual([
      ["Foshan Fabrics", "PO-3002", "Order deposit", "Foshan Fabrics", 1000, 300, 700, "2026-11-02", "", "", "", "Partly paid", 1],
      ["Foshan Fabrics", "PO-3001", "Order deposit (to shipping agent)", "Sino Freight", 300, 300, 0, "2026-10-21", "Bank transfer", "UTR 9", "Half", "Paid", ""],
      ["Foshan Fabrics", "", "To receive", "", 500, 0, 500, "2026-10-10", "", "Mould", "", "Open", ""],
    ]);
    expect(file.sections[1]!.rows).toEqual([["Foshan Fabrics", "", "To give", "Foshan Fabrics", 200, 50, 150, "2026-10-05", "", "", "", "Partly settled", ""]]);
    // Nothing shown: one empty CNY table, written as "No rows".
    expect(csvRows(depositsFile("all", [], "All deposits", TODAY)).at(-1)).toEqual(["No rows"]);
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
  it("has the Summary, Deposit to Give, Deposit to Receive and Transactions sheets, never netting the directions", () => {
    const file = statementFile(statement, TODAY);
    expect(file).toMatchObject({ title: "Supplier deposits: Foshan Fabrics", filename: `supplier-deposits-foshan-fabrics-${TODAY}`, filters: "Supplier: Foshan Fabrics" });
    expect(file.sections.map((s) => s.sheet)).toEqual(["Summary", "Deposit to Give", "Deposit to Receive", "Transactions"]);
    expect(file.sections[0]!.rows).toEqual([
      ["Give", 1000, 300, 700],
      ["Receive", 500, 100, 400],
    ]);
    expect(file.sections[1]!.rows).toEqual([["2026-10-01", 1000, 300, 700, "Partly settled", "", "Tooling"]]);
    expect(file.sections[2]!.rows).toEqual([["2026-10-10", 500, 100, 400, "Partly settled", "Mould", ""]]);
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
