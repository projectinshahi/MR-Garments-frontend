import { describe, expect, it } from "vitest";

import { toPaymentsData } from "./data/queries";
import { paymentsFile } from "./payment-files";
import { paymentOrder, paymentRow } from "./test-fixtures";

const TODAY = "2026-11-10";
const payments = [
  paymentRow("p1", { amountCny: 5_000, amountInr: 60_000, reference: "UTR 1" }),
  paymentRow("p2", { amountCny: 1_000, amountInr: 12_000, voided: true, voidReason: "Entered twice" }),
  paymentRow("p3", { po: "PO-1", payeeRole: "agent", payee: "Sino Freight", kind: "Balance", amountCny: 300, amountInr: 3_600 }),
];
const totals = [{ currency: "CNY", accounts: 1, balanceCny: -500, payableCny: 500, availableCny: 0, outstandingCny: 500 }];
const { orders } = toPaymentsData({ orders: [paymentOrder("PO-1")], payments }, TODAY);
const file = paymentsFile(orders, payments, "", TODAY, totals);
const section = (title: string) => file.sections.find((s) => s.title === title)!;
const column = (title: string, header: string) => {
  const s = section(title);
  const i = s.columns.findIndex((c) => c.header === header);
  return s.rows.map((r) => r[i]);
};

describe("paymentsFile (unified ledger)", () => {
  it("marks voided payments with their reason and leaves them out of every total", () => {
    expect(column("Supplier payments (CNY)", "Status")).toEqual(["Paid", "Voided"]);
    expect(column("Supplier payments (CNY)", "Void reason")).toEqual([null, "Entered twice"]);
    expect(column("Supplier payments (CNY)", "PO")).toEqual([null, null]);
    const total = section("Supplier payments (CNY)").total!;
    expect(total[0]).toBe("Total (voided left out)");
    expect(total.filter((cell) => typeof cell === "number")).toEqual([5_000, 60_000]);
    const summary = Object.fromEntries(section("Summary").rows.map(([k, v]) => [k, v]));
    expect(summary).toMatchObject({ "Paid, all payees (INR)": 63_600, "Supplier payments": 1, "Shipping-agent payments": 1, "Voided payments": 1, "Payable to suppliers": "CNY 500.00" });
  });

  it("writes the orders with the API's settled, outstanding, status and milestone, and sea freight apart", () => {
    expect(column("Payments by order (CNY)", "Settled (CNY)")).toEqual([4_000]);
    expect(column("Payments by order (CNY)", "Outstanding (CNY)")).toEqual([6_000]);
    expect(column("Payments by order (CNY)", "Payment status")).toEqual(["Partly paid"]);
    expect(column("Shipping-agent payments (CNY)", "Paid to (agent)")).toEqual(["Sino Freight"]);
  });
});
