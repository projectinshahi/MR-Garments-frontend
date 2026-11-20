import { describe, expect, it } from "vitest";

import { toPdf } from "@/features/reports/pdf";
import { toXlsx } from "@/features/reports/xlsx";
import type { SupplierStatement } from "@/lib/api/deposits-types";

import { statementFile } from "./deposit-files";

// The supplier-deposit archive (SD-1): the supplier report writes it beside the ledger.

const TODAY = "2026-11-10";
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

