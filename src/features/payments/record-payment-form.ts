import { z } from "zod";

import type { AdvanceSupplierOption } from "@/lib/api/deposits-types";
import type { PaymentRow } from "@/lib/api/ledger-types";
import type { CreateAgentPaymentBody, CreateSupplierPaymentBody, EditPaymentBody } from "@/lib/api/types";
import { formatMoney } from "@/lib/formatters";
import type { Currency } from "@/types/domain";

// Record payment (PAY-2) after the unified supplier ledger (backend docs/unified-ledger.md). A supplier payment is
// recorded against the supplier, never an order: supplier, currency (one of its `currencyOptions`), amount, rate
// (required for non-INR, none for INR), date, mode, reference, notes. It credits the supplier's account in that
// currency; the orders settle from the account oldest first. A shipping-agent payment (sea freight) stays on its order
// and is never posted. What the inputs hold is text, as typed; the checks mirror the API's.

export const MESSAGES = {
  supplier: "Choose a supplier from the list.",
  currency: "Choose one of this supplier's currencies.",
  agent: "Choose the shipping agent.",
  kind: "Choose Deposit or Balance.",
  amount: "Enter an amount above 0.",
  paidOn: "Enter the date the payment was made.",
  paidOnFuture: "The payment date can't be in the future.",
  rateInr: "Enter an INR rate above 0.",
  mode: "Enter the payment mode.",
  modeTooLong: "Use 100 characters or fewer for the mode.",
  referenceTooLong: "Use 100 characters or fewer for the reference.",
  notesTooLong: "Use 1,000 characters or fewer for the notes.",
  reason: "Enter the reason for changing the amount, date or rate.",
  reasonLegacy: "Enter the reason for the correction.",
  reasonTooLong: "Use 1,000 characters or fewer for the reason.",
};
const M = MESSAGES;

/** "2,345.50" → 2345.5; blank is 0, anything else unreadable is NaN. */
export const toNumber = (text: string) => Number(text.replace(/,/g, "").trim());

/** The INR equivalent shown as you type: amount × rate to the paisa, 0 until both are numbers. */
export const paymentINR = (amount: string, rateInr: string) => {
  const inr = Math.round(toNumber(amount) * toNumber(rateInr) * 100) / 100;
  return Number.isFinite(inr) ? inr : 0;
};

const decimal = (message: string, min: number, max: number) =>
  z.string().transform(toNumber).pipe(z.number({ error: message }).min(min, message).max(max, message));

/** The fields both payment forms share. `currency` decides the rate: INR takes none (the server stores 1). */
const common = (today: string, currency: Currency | undefined) => ({
  amount: decimal(M.amount, 0.01, 999_999_999_999),
  paidOn: z.iso.date({ error: M.paidOn }).refine((day) => day <= today, M.paidOnFuture),
  rateInr: currency === "INR" ? z.string().transform(() => undefined) : decimal(M.rateInr, 0.0001, 99_999_999),
  mode: z.string().trim().min(1, M.mode).max(100, M.modeTooLong),
  reference: z.string().trim().max(100, M.referenceTooLong),
  notes: z.string().trim().max(1000, M.notesTooLong),
});

/**
 * The supplier payment. `options`: the chosen supplier's currencies (D10), which the currency must be one of; built per
 * chosen `currency`, so an INR payment's rate is neither asked nor sent.
 */
export const supplierSchemaFor = (today: string, options: Currency[], currency: Currency | undefined) =>
  z.object({
    supplierId: z.string().min(1, M.supplier),
    currency: z.string().refine((code) => options.includes(code), M.currency),
    ...common(today, currency),
  });
export type SupplierPaymentInput = z.input<ReturnType<typeof supplierSchemaFor>>;
export type SupplierPaymentValues = z.output<ReturnType<typeof supplierSchemaFor>>;

/** The currency a new payment starts in: the supplier's own when it may be used, else its first option. */
export const defaultCurrency = (supplier: AdvanceSupplierOption | undefined): Currency =>
  !supplier ? "" : supplier.currencyOptions.includes(supplier.currency) ? supplier.currency : (supplier.currencyOptions[0] ?? "");

/**
 * The rate a payment starts with: the supplier's saved rate, which is for its current currency only; "" for INR, for
 * another currency, or while the supplier has none ("no saved rate").
 */
export const defaultRate = (supplier: Pick<AdvanceSupplierOption, "currency" | "exchangeRate"> | undefined, currency: Currency) =>
  !supplier || currency === "INR" || currency !== supplier.currency || supplier.exchangeRate === null ? "" : String(supplier.exchangeRate);

/** The supplier's signed balance in the currency now (ADV-5 `balances`; no account yet is 0). */
export const balanceNow = (supplier: Pick<AdvanceSupplierOption, "balances"> | undefined, currency: Currency) =>
  supplier?.balances.find((b) => b.currency === currency)?.balanceCny ?? 0;

/** Every free account is a choice; held: the current-currency account is pending review and no option is left. */
export const isBlocked = (supplier: Pick<AdvanceSupplierOption, "held" | "currencyOptions"> | undefined) => !!supplier && supplier.held && supplier.currencyOptions.length === 0;

export const emptySupplierPayment = (supplier: AdvanceSupplierOption | undefined, today: string): SupplierPaymentInput => {
  const currency = defaultCurrency(supplier);
  return { supplierId: supplier?.id ?? "", currency, amount: "", paidOn: today, rateInr: defaultRate(supplier, currency), mode: "", reference: "", notes: "" };
};

/** The PAY-2 supplier body. Empty reference and notes are left out (the API stores ""); the id is the dialog's, reused on retry. */
export function toSupplierPaymentBody(values: SupplierPaymentValues, clientRequestId: string): CreateSupplierPaymentBody {
  const { supplierId, currency, amount, paidOn, rateInr, mode, reference, notes } = values;
  return {
    supplierId,
    currency,
    amount,
    paidOn,
    ...(rateInr === undefined ? {} : { rateInr }),
    mode,
    ...(reference ? { reference } : {}),
    ...(notes ? { notes } : {}),
    clientRequestId,
  };
}

/** The shipping-agent payment (sea freight) of one order, in the order's currency. */
export const agentSchemaFor = (today: string, currency: Currency) =>
  z.object({
    agentId: z.string().min(1, M.agent),
    kind: z.string().pipe(z.enum(["Deposit", "Balance"], { error: M.kind })),
    ...common(today, currency),
  });
export type AgentPaymentInput = z.input<ReturnType<typeof agentSchemaFor>>;
export type AgentPaymentValues = z.output<ReturnType<typeof agentSchemaFor>>;

export const emptyAgentPayment = (today: string, rateInr: string): AgentPaymentInput => ({ agentId: "", kind: "", amount: "", paidOn: today, rateInr, mode: "", reference: "", notes: "" });

export function toAgentPaymentBody(values: AgentPaymentValues, orderId: string, clientRequestId: string): CreateAgentPaymentBody {
  const { agentId, kind, amount, paidOn, rateInr, mode, reference, notes } = values;
  return {
    orderId,
    payeeRole: "agent",
    agentId,
    kind,
    amountCny: amount,
    paidOn,
    ...(rateInr === undefined ? {} : { rateInr }),
    mode,
    ...(reference ? { reference } : {}),
    ...(notes ? { notes } : {}),
    clientRequestId,
  };
}

/** The payment as saved, which Edit payment (PAY-4) starts from. */
export type EditOriginal = Pick<PaymentRow, "currency" | "amountCny" | "paidOn" | "rateInr" | "mode" | "reference" | "notes">;

/** A new amount, date or rate: PAY-4 then voids the payment and records the corrected one, so it needs a reason. */
export const moneyChanged = (original: EditOriginal, values: { amount: number; paidOn: string; rateInr: number | undefined }) =>
  Math.round(values.amount * 100) !== Math.round(original.amountCny * 100) ||
  values.paidOn !== original.paidOn ||
  // INR takes no rate (stored as 1).
  Math.round((values.rateInr ?? 1) * 10_000) !== Math.round((original.rateInr ?? 1) * 10_000);

/**
 * How a legacy supplier row (Deposit or Balance, or recorded against a PO) is edited: every change is a correction, so
 * `reasonAlways`; a partly used one keeps its date and rate and needs an amount of at least `minAmount` (what it paid).
 */
export type EditRules = { reasonAlways?: boolean; minAmount?: number };

/** "At least ¥3,000.00": the smallest amount a partly used payment can be corrected to. */
export const minAmountText = (min: number, currency: Currency) => `At least ${formatMoney(min, currency, { decimals: 2 })}`;

/** Edit payment (PAY-4): PAY-2's money fields in the payment's currency, plus the reason a correction needs. */
export const editSchemaFor = (today: string, original: EditOriginal, { reasonAlways = false, minAmount }: EditRules = {}) =>
  z
    .object({ ...common(today, original.currency), reason: z.string().trim().max(1000, M.reasonTooLong) })
    .superRefine((values, ctx) => {
      if (!values.reason && (reasonAlways || moneyChanged(original, values)))
        ctx.addIssue({ code: "custom", path: ["reason"], message: reasonAlways ? M.reasonLegacy : M.reason });
      if (minAmount !== undefined && Math.round(values.amount * 100) < Math.round(minAmount * 100))
        ctx.addIssue({ code: "custom", path: ["amount"], message: `${minAmountText(minAmount, original.currency)}: that much of it already paid orders.` });
    });
export type EditPaymentInput = z.input<ReturnType<typeof editSchemaFor>>;
export type EditPaymentValues = z.output<ReturnType<typeof editSchemaFor>>;

export const editStart = (original: EditOriginal): EditPaymentInput => ({
  amount: String(original.amountCny),
  paidOn: original.paidOn ?? "",
  rateInr: original.currency === "INR" || original.rateInr === null ? "" : String(original.rateInr),
  mode: original.mode ?? "",
  reference: original.reference,
  notes: original.notes,
  reason: "",
});

/** The PAY-4 body: every field as it should be; the reason only for a correction. The id is the dialog's, reused on retry. */
export function toEditPaymentBody(original: EditOriginal, values: EditPaymentValues, clientRequestId: string, reasonAlways = false): EditPaymentBody {
  const { amount, paidOn, rateInr, mode, reference, notes, reason } = values;
  return {
    amount,
    paidOn,
    ...(rateInr === undefined ? {} : { rateInr }),
    mode,
    reference,
    notes,
    ...(reasonAlways || moneyChanged(original, values) ? { reason } : {}),
    clientRequestId,
  };
}

/** PAY-2/PAY-4 422 field → the form field it belongs under; fields a form doesn't have are toasted instead. */
export const FORM_FIELD: Record<string, "supplierId" | "currency" | "agentId" | "kind" | "amount" | "paidOn" | "rateInr" | "mode" | "reference" | "notes" | "reason"> = {
  supplierId: "supplierId",
  currency: "currency",
  agentId: "agentId",
  kind: "kind",
  amount: "amount",
  amountCny: "amount",
  paidOn: "paidOn",
  rateInr: "rateInr",
  mode: "mode",
  reference: "reference",
  notes: "notes",
  reason: "reason",
};
