import { describe, expect, it } from "vitest";

import {
  agentSchemaFor,
  balanceNow,
  defaultCurrency,
  defaultRate,
  emptySupplierPayment,
  isBlocked,
  MESSAGES,
  paymentINR,
  supplierSchemaFor,
  type SupplierPaymentInput,
  toAgentPaymentBody,
  toSupplierPaymentBody,
} from "./record-payment-form";

const today = "2026-11-10";
const USD = { id: "s2", name: "Boston Denim", currency: "USD", exchangeRate: 88, held: false, currencyOptions: ["CNY", "USD"], balances: [{ currency: "CNY", balanceCny: -1200 }] };
const filled: SupplierPaymentInput = { supplierId: "s2", currency: "USD", amount: "2,345.67", paidOn: today, rateInr: "88.5", mode: "  Wire ", reference: "", notes: "" };
const errorsFor = (overrides: Partial<SupplierPaymentInput>, options = USD.currencyOptions) => {
  const values = { ...filled, ...overrides };
  const result = supplierSchemaFor(today, options, values.currency).safeParse(values);
  return result.success ? {} : Object.fromEntries(result.error.issues.map((issue) => [issue.path[0], issue.message]));
};

describe("supplier payment (PAY-2, no order)", () => {
  it("parses a filled form: numbers, trimmed mode, the currency kept", () => {
    expect(supplierSchemaFor(today, USD.currencyOptions, "USD").parse(filled)).toEqual({ ...filled, amount: 2345.67, rateInr: 88.5, mode: "Wire" });
  });

  it("takes a currency from the supplier's options only (D10)", () => {
    expect(errorsFor({ currency: "INR" })).toEqual({ currency: MESSAGES.currency });
    expect(errorsFor({ currency: "CNY", rateInr: "12" })).toEqual({});
    expect(errorsFor({ supplierId: "" }, [])).toMatchObject({ supplierId: MESSAGES.supplier, currency: MESSAGES.currency });
  });

  it("needs a rate above 0 for a non-INR currency; INR takes none and sends none", () => {
    expect(errorsFor({ rateInr: "" })).toEqual({ rateInr: MESSAGES.rateInr });
    expect(errorsFor({ rateInr: "0" })).toEqual({ rateInr: MESSAGES.rateInr });
    const inr = supplierSchemaFor(today, ["INR"], "INR").parse({ ...filled, currency: "INR", rateInr: "" });
    expect(inr.rateInr).toBeUndefined();
    expect(toSupplierPaymentBody(inr, "req-1")).not.toHaveProperty("rateInr");
  });

  it("mirrors the API's other rules", () => {
    expect(errorsFor({ amount: "0" })).toEqual({ amount: MESSAGES.amount });
    expect(errorsFor({ amount: "abc" })).toEqual({ amount: MESSAGES.amount });
    expect(errorsFor({ paidOn: "2026-11-11" })).toEqual({ paidOn: MESSAGES.paidOnFuture });
    expect(errorsFor({ paidOn: "" })).toEqual({ paidOn: MESSAGES.paidOn });
    expect(errorsFor({ mode: "   " })).toEqual({ mode: MESSAGES.mode });
    expect(errorsFor({ reference: "x".repeat(101) })).toEqual({ reference: MESSAGES.referenceTooLong });
  });

  it("sends the supplier body with the request id; empty reference and notes left out", () => {
    const values = supplierSchemaFor(today, USD.currencyOptions, "USD").parse({ ...filled, reference: " UTR 9 " });
    expect(toSupplierPaymentBody(values, "req-1")).toEqual({
      supplierId: "s2",
      currency: "USD",
      amount: 2345.67,
      paidOn: today,
      rateInr: 88.5,
      mode: "Wire",
      reference: "UTR 9",
      clientRequestId: "req-1",
    });
  });

  it("starts in the supplier's own currency with its saved rate; another currency has no saved rate", () => {
    expect(defaultCurrency(USD)).toBe("USD");
    expect(defaultCurrency({ ...USD, currency: "EUR", currencyOptions: ["CNY"] })).toBe("CNY");
    expect(defaultCurrency(undefined)).toBe("");
    expect(defaultRate(USD, "USD")).toBe("88");
    expect(defaultRate(USD, "CNY")).toBe("");
    expect(defaultRate({ ...USD, exchangeRate: null }, "USD")).toBe("");
    expect(defaultRate({ currency: "INR", exchangeRate: 1 }, "INR")).toBe("");
    expect(emptySupplierPayment(USD, today)).toEqual({ supplierId: "s2", currency: "USD", amount: "", paidOn: today, rateInr: "88", mode: "", reference: "", notes: "" });
  });

  it("reads the balance now from ADV-5 (no account yet is 0), and blocks a held supplier without another currency", () => {
    expect(balanceNow(USD, "CNY")).toBe(-1200);
    expect(balanceNow(USD, "USD")).toBe(0);
    expect(isBlocked({ held: true, currencyOptions: [] })).toBe(true);
    expect(isBlocked({ held: true, currencyOptions: ["USD"] })).toBe(false);
    expect(isBlocked({ held: false, currencyOptions: [] })).toBe(false);
    expect(isBlocked(undefined)).toBe(false);
  });

  it("previews INR to the paisa, 0 until both numbers are there", () => {
    expect(paymentINR("2,345.67", "11.8765")).toBe(27858.35);
    expect(paymentINR("", "11")).toBe(0);
    expect(paymentINR("abc", "11")).toBe(0);
  });
});

describe("sea freight payment (PAY-2, agent body)", () => {
  it("needs the agent and Deposit or Balance, and sends the order's agent body", () => {
    const schema = agentSchemaFor(today, "CNY");
    const bad = schema.safeParse({ agentId: "", kind: "Payment", amount: "10", paidOn: today, rateInr: "12", mode: "Cash", reference: "", notes: "" });
    expect(bad.success ? {} : Object.fromEntries(bad.error.issues.map((i) => [i.path[0], i.message]))).toEqual({ agentId: MESSAGES.agent, kind: MESSAGES.kind });
    const values = schema.parse({ agentId: "a1", kind: "Balance", amount: "500", paidOn: today, rateInr: "12.1", mode: "Cash", reference: "", notes: " FOB freight " });
    expect(toAgentPaymentBody(values, "o1", "req-9")).toEqual({
      orderId: "o1",
      payeeRole: "agent",
      agentId: "a1",
      kind: "Balance",
      amountCny: 500,
      paidOn: today,
      rateInr: 12.1,
      mode: "Cash",
      notes: "FOB freight",
      clientRequestId: "req-9",
    });
  });
});
