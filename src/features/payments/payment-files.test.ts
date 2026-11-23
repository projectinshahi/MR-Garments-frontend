import { describe, expect, it } from "vitest";

import { toPaymentsData } from "./data/queries";
import { paymentsFile } from "./payment-files";
import { HELD, paymentOrder, paymentRow } from "./test-fixtures";

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

describe("paymentsFile: a held account (D4, pre-release audit M1/M3)", () => {
  const list = [...payments, paymentRow("p4", { supplierId: "s9", supplier: "Shantou Toys", amountCny: 12_000, amountInr: 144_000, held: true })];
  const held = toPaymentsData({ orders: [paymentOrder("PO-1"), paymentOrder("PO-9", { ...HELD, orderValueCny: 7_000 })], payments: list }, TODAY);
  const heldFile = paymentsFile(held.orders, list, "", TODAY, totals);
  const of = (title: string) => heldFile.sections.find((s) => s.title === title)!;

  it("writes its payment as Pending review, counts it apart from the voided ones and leaves it out of every total", () => {
    const status = of("Supplier payments (CNY)").columns.findIndex((c) => c.header === "Status");
    expect(of("Supplier payments (CNY)").rows.map((r) => r[status])).toEqual(["Paid", "Voided", "Pending review"]);
    const total = of("Supplier payments (CNY)").total!;
    expect(total[0]).toBe("Total (voided and pending review left out)");
    expect(total.filter((cell) => typeof cell === "number")).toEqual([5_000, 60_000]);
    const summary = Object.fromEntries(of("Summary").rows.map(([k, v]) => [k, v]));
    expect(summary).toMatchObject({ "Voided payments": 1, "Payments pending review (held account)": 1, "Supplier payments": 1, "Paid, all payees (INR)": 63_600 });
  });

  it("lists its order as Pending review, and its value adds nothing to the order totals", () => {
    const summary = Object.fromEntries(of("Summary").rows.map(([k, v]) => [k, v]));
    expect(summary).toMatchObject({ Orders: 2, "Order value (received)": "CNY 10,000.00", "PO value (ordered)": "CNY 10,000.00", Settled: "CNY 4,000.00", Outstanding: "CNY 6,000.00" });
    const status = of("Payments by order (CNY)").columns.findIndex((c) => c.header === "Payment status");
    expect(of("Payments by order (CNY)").rows.map((r) => r[status])).toEqual(["Partly paid", "Pending review"]);
  });
});
