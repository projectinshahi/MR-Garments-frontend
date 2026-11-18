import { describe, expect, it } from "vitest";

import {
  emptyPayment,
  MESSAGES,
  paymentINR,
  recordPaymentSchema,
  SUPPLIER_PAYEE,
  toCreatePaymentBody,
  toSupplierAdvanceBody,
  type RecordPaymentInput,
} from "./record-payment-form";

const today = "2026-11-10";
const schema = recordPaymentSchema(today);
const filled: RecordPaymentInput = {
  orderId: "o1",
  supplierId: "",
  kind: "Balance",
  payee: SUPPLIER_PAYEE,
  amountCny: "2,345.67",
  paidOn: today,
  rateInr: "11.8765",
  mode: "  Bank transfer ",
};
const errorsFor = (overrides: Partial<RecordPaymentInput>) => {
  const result = schema.safeParse({ ...filled, ...overrides });
  return result.success ? {} : Object.fromEntries(result.error.issues.map((issue) => [issue.path[0], issue.message]));
};

describe("recordPaymentSchema", () => {
  it("accepts a filled form dated today, parsing numbers and trimming the mode", () => {
    expect(schema.parse(filled)).toEqual({ ...filled, target: "order", amountCny: 2345.67, rateInr: 11.8765, mode: "Bank transfer" });
  });

  it("starts empty except the supplier as payee and today's date, and says what each field needs", () => {
    // No payment type chosen (Deposits & Payments asks for it first); an order payment form ignores it.
    expect(emptyPayment("", today)).toMatchObject({ target: "", payee: SUPPLIER_PAYEE, paidOn: today });
    expect(errorsFor(emptyPayment("", today))).toEqual({
      orderId: MESSAGES.order,
      kind: MESSAGES.kind,
      amountCny: MESSAGES.amount,
      rateInr: MESSAGES.rateInr,
      mode: MESSAGES.mode,
    });
  });

  it("mirrors the API's rules", () => {
    expect(errorsFor({ kind: "Advance" })).toEqual({ kind: MESSAGES.kind });
    expect(errorsFor({ payee: "" })).toEqual({ payee: MESSAGES.payee });
    expect(errorsFor({ amountCny: "0" })).toEqual({ amountCny: MESSAGES.amount });
    expect(errorsFor({ amountCny: "abc" })).toEqual({ amountCny: MESSAGES.amount });
    expect(errorsFor({ amountCny: "1000000000000" })).toEqual({ amountCny: MESSAGES.amount });
    expect(errorsFor({ paidOn: "2026-11-11" })).toEqual({ paidOn: MESSAGES.paidOnFuture });
    expect(errorsFor({ paidOn: "" })).toEqual({ paidOn: MESSAGES.paidOn });
    expect(errorsFor({ rateInr: "0" })).toEqual({ rateInr: MESSAGES.rateInr });
    expect(errorsFor({ mode: "   " })).toEqual({ mode: MESSAGES.mode });
    expect(errorsFor({ mode: "x".repeat(101) })).toEqual({ mode: MESSAGES.modeTooLong });
    expect(errorsFor({ mode: "x".repeat(100) })).toEqual({});
  });
});

describe("toCreatePaymentBody", () => {
  it("pays the supplier with no agent, or the chosen agent", () => {
    const values = schema.parse(filled);
    expect(toCreatePaymentBody(values)).toEqual({
      orderId: "o1",
      kind: "Balance",
      payeeRole: "supplier",
      agentId: null,
      amountCny: 2345.67,
      paidOn: today,
      rateInr: 11.8765,
      mode: "Bank transfer",
    });
    expect(toCreatePaymentBody({ ...values, payee: "agent-1" })).toMatchObject({ payeeRole: "agent", agentId: "agent-1" });
  });

  it("an INR order needs no rate and sends none; a USD order needs one", () => {
    const inr = recordPaymentSchema(today, "INR").parse({ ...filled, rateInr: "" });
    expect(toCreatePaymentBody(inr)).not.toHaveProperty("rateInr");
    expect(recordPaymentSchema(today, "USD").safeParse({ ...filled, rateInr: "" }).error?.issues.map((issue) => issue.message)).toEqual([MESSAGES.rateInr]);
  });
});

describe("without an order (a deposit on the supplier's advance)", () => {
  const advance = (currency: "CNY" | "USD" | "INR" = "USD") => recordPaymentSchema(today, currency, "advance");
  const noOrder = { ...filled, orderId: "", supplierId: "s1", kind: "" };
  const issues = (result: { error?: { issues: { path: PropertyKey[]; message: string }[] } }) => result.error?.issues.map((issue) => [issue.path[0], issue.message]);

  it("needs the supplier instead of the order and the kind, and is a Deposit", () => {
    expect(advance().parse(noOrder)).toMatchObject({ target: "advance", orderId: "", supplierId: "s1", kind: "Deposit", amountCny: 2345.67, rateInr: 11.8765 });
    expect(issues(advance().safeParse({ ...noOrder, supplierId: "" }))).toEqual([["supplierId", MESSAGES.supplier]]);
    // With an order nothing changes: the order and kind are needed, the supplier is not.
    expect(errorsFor({ orderId: "", kind: "" })).toEqual({ orderId: MESSAGES.order, kind: MESSAGES.kind });
  });

  it("keeps the currency's rate rule: a USD or CNY supplier needs a rate, an INR one takes none", () => {
    expect(issues(advance("USD").safeParse({ ...noOrder, rateInr: "" }))).toEqual([["rateInr", MESSAGES.rateInr]]);
    expect(issues(advance("CNY").safeParse({ ...noOrder, rateInr: "0" }))).toEqual([["rateInr", MESSAGES.rateInr]]);
    expect(advance("INR").parse({ ...noOrder, rateInr: "" }).rateInr).toBeUndefined();
  });

  it("posts the ADV-2 body: amount, date, rate, mode and the reference and notes when typed; no order, kind, payee or supplier", () => {
    expect(toSupplierAdvanceBody(advance().parse({ ...noOrder, payee: "agent-1", reference: " UTR-9 ", notes: "" }))).toEqual({
      amount: 2345.67,
      paidOn: today,
      rateInr: 11.8765,
      mode: "Bank transfer",
      reference: "UTR-9",
    });
    expect(toSupplierAdvanceBody(advance("INR").parse({ ...noOrder, rateInr: "", notes: "Advance for winter" }))).toEqual({
      amount: 2345.67,
      paidOn: today,
      mode: "Bank transfer",
      notes: "Advance for winter",
    });
  });

  it("an order payment never sends the supplier or the payment type", () => {
    const body = toCreatePaymentBody(schema.parse({ ...filled, supplierId: "s1", target: "order" }));
    expect(body).not.toHaveProperty("supplierId");
    expect(body).not.toHaveProperty("target");
  });
});

describe("paymentINR", () => {
  it("is amount × rate to the paisa, and 0 until both are numbers", () => {
    expect(paymentINR("2,345.67", "11.8765")).toBe(27858.35);
    expect(paymentINR("", "11.8")).toBe(0);
    expect(paymentINR("100", "abc")).toBe(0);
  });
});
