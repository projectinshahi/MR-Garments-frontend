import { describe, expect, it } from "vitest";

import { emptyPayment, MESSAGES, paymentINR, recordPaymentSchema, SUPPLIER_PAYEE, toCreatePaymentBody, type RecordPaymentInput } from "./record-payment-form";

const today = "2026-11-10";
const schema = recordPaymentSchema(today);
const filled: RecordPaymentInput = {
  orderId: "o1",
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
    expect(schema.parse(filled)).toEqual({ ...filled, amountCny: 2345.67, rateInr: 11.8765, mode: "Bank transfer" });
  });

  it("starts empty except the supplier as payee and today's date, and says what each field needs", () => {
    expect(emptyPayment("", today)).toMatchObject({ payee: SUPPLIER_PAYEE, paidOn: today });
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
});

describe("paymentINR", () => {
  it("is amount × rate to the paisa, and 0 until both are numbers", () => {
    expect(paymentINR("2,345.67", "11.8765")).toBe(27858.35);
    expect(paymentINR("", "11.8")).toBe(0);
    expect(paymentINR("100", "abc")).toBe(0);
  });
});
