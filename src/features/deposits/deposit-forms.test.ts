import { describe, expect, it } from "vitest";

import { emptyDeposit, emptySettlement, MESSAGES, type NewDepositInput, newDepositSchema, type SettlementInput, settlementSchema, toCreateDepositBody, toSettlementBody } from "./deposit-forms";

const today = "2026-11-10";
const errorsOf = (result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  result.success ? {} : Object.fromEntries(result.error!.issues.map((issue) => [issue.path[0], issue.message]));

describe("newDepositSchema", () => {
  const schema = newDepositSchema(today);
  const filled: NewDepositInput = { direction: "give", amount: "1,234.50", currency: "USD", openedOn: today, reference: " INV-7 ", notes: " Returned mould " };

  it("parses a filled form, trimming the texts, and sends only what was typed", () => {
    const values = schema.parse(filled);
    expect(values).toEqual({ direction: "give", amount: 1234.5, currency: "USD", openedOn: today, reference: "INV-7", notes: "Returned mould" });
    expect(toCreateDepositBody(values)).toEqual({ direction: "give", amount: 1234.5, currency: "USD", openedOn: today, reference: "INV-7", notes: "Returned mould" });
    expect(toCreateDepositBody(schema.parse({ ...filled, reference: "", notes: "  " }))).toEqual({ direction: "give", amount: 1234.5, currency: "USD", openedOn: today });
  });

  it("starts with the supplier's currency and today, and says what each field needs", () => {
    const empty = emptyDeposit("CNY", today);
    expect(empty).toEqual({ direction: "", amount: "", currency: "CNY", openedOn: today, reference: "", notes: "" });
    expect(errorsOf(schema.safeParse(empty))).toEqual({ direction: MESSAGES.direction, amount: MESSAGES.amount });
  });

  it("mirrors the API's rules", () => {
    const errorsFor = (overrides: Partial<NewDepositInput>) => errorsOf(schema.safeParse({ ...filled, ...overrides }));
    expect(errorsFor({ direction: "lend" })).toEqual({ direction: MESSAGES.direction });
    expect(errorsFor({ amount: "0" })).toEqual({ amount: MESSAGES.amount });
    expect(errorsFor({ amount: "abc" })).toEqual({ amount: MESSAGES.amount });
    expect(errorsFor({ amount: "12.345" })).toEqual({ amount: MESSAGES.amount });
    expect(errorsFor({ amount: "1000000000000" })).toEqual({ amount: MESSAGES.amount });
    expect(errorsFor({ currency: "eur" })).toEqual({ currency: MESSAGES.currency });
    expect(errorsFor({ openedOn: "" })).toEqual({ openedOn: MESSAGES.openedOn });
    expect(errorsFor({ openedOn: "2026-11-11" })).toEqual({ openedOn: MESSAGES.future });
    expect(errorsFor({ reference: "r".repeat(101) })).toEqual({ reference: MESSAGES.referenceTooLong });
    expect(errorsFor({ notes: "n".repeat(1001) })).toEqual({ notes: MESSAGES.notesTooLong });
    expect(errorsFor({ reference: "r".repeat(100), notes: "n".repeat(1000) })).toEqual({});
  });
});

describe("settlementSchema", () => {
  const schema = settlementSchema(today);
  const filled: SettlementInput = { paidOn: "2026-11-09", amount: "700", mode: " Bank transfer ", reference: "", notes: "" };

  it("opens with today and the pending amount, parses the form and sends the body without empty texts", () => {
    expect(emptySettlement(700, today)).toEqual({ paidOn: today, amount: "700", mode: "", reference: "", notes: "" });
    expect(emptySettlement(1234.5, today).amount).toBe("1234.5");
    expect(toSettlementBody(schema.parse(filled))).toEqual({ paidOn: "2026-11-09", amount: 700, mode: "Bank transfer" });
    expect(toSettlementBody(schema.parse({ ...filled, reference: "TXN 1", notes: "last part" }))).toMatchObject({ reference: "TXN 1", notes: "last part" });
  });

  it("mirrors the API's rules", () => {
    const errorsFor = (overrides: Partial<SettlementInput>) => errorsOf(schema.safeParse({ ...filled, ...overrides }));
    expect(errorsOf(schema.safeParse(emptySettlement(700, today)))).toEqual({ mode: MESSAGES.mode });
    expect(errorsFor({ paidOn: "" })).toEqual({ paidOn: MESSAGES.paidOn });
    expect(errorsFor({ paidOn: "2026-11-11" })).toEqual({ paidOn: MESSAGES.future });
    expect(errorsFor({ amount: "0" })).toEqual({ amount: MESSAGES.amount });
    expect(errorsFor({ mode: "m".repeat(101) })).toEqual({ mode: MESSAGES.modeTooLong });
    expect(errorsFor({ reference: "r".repeat(101), notes: "n".repeat(1001) })).toEqual({ reference: MESSAGES.referenceTooLong, notes: MESSAGES.notesTooLong });
  });
});
