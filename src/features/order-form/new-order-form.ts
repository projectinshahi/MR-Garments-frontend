import { z } from "zod";

import type { ContainerTerms, CreateOrderBody } from "@/lib/api/types";

import { parseNumber } from "./order-totals";

// New order form (15): what the inputs hold (strings, as typed), its client-side checks matching ORD-3, and the
// ORD-3 body. The reference has "+ Add item" but no remove control, so a row left completely empty is ignored rather
// than rejected. Messages are proposed wording, except the delivery-date one (contract). Amounts are in the order's
// currency (the supplier's). Since the unified supplier ledger no payment is entered here (D6): supplier payments are
// recorded with Record payment, sea freight on the order page; the Deposit Required is a milestone of the order.

const isWhole = (text: string) => Number.isInteger(parseNumber(text)) && parseNumber(text) > 0;
const isPositive = (text: string) => parseNumber(text) > 0;
/** ORD-3/ORD-5's deposit requirement: above 0, up to 999,999,999,999, at most 2 decimals (commas allowed as typed). */
export const isDepositRequired = (text: string) => /^\d{1,12}(\.\d{1,2})?$/.test(text.replace(/,/g, "").trim()) && isPositive(text);
export const DEPOSIT_REQUIRED_MESSAGE = "Enter the deposit the supplier asked for: above 0, with at most 2 decimals.";
const issue = (ctx: z.RefinementCtx, path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });

export const isBlankLine = (line: { itemId: string; rateCny: string; quantity: string }) =>
  !line.itemId && !line.rateCny.trim() && !line.quantity.trim();

const lineSchema = z.object({ itemId: z.string(), rateCny: z.string(), quantity: z.string() }).superRefine((line, ctx) => {
  if (isBlankLine(line)) return;
  if (!line.itemId) issue(ctx, "itemId", "Choose an item.");
  if (!isPositive(line.rateCny)) issue(ctx, "rateCny", "Enter the rate.");
  if (!isWhole(line.quantity)) issue(ctx, "quantity", "Enter a whole quantity.");
});

/** Container terms (backend docs/order-container-terms.md): chosen on the order; containers loading it take them. */
export const CONTAINER_TERMS: ContainerTerms[] = ["FOB", "CNF"];
export const TERMS_MESSAGE = "Choose the container terms: FOB or CNF.";
export const TERMS_HELP = "FOB: we pay the freight from the China port. CNF: the supplier pays it up to India. Containers loading this order take these terms.";
const isTerms = (value: string): value is ContainerTerms => (CONTAINER_TERMS as string[]).includes(value);

export const newOrderSchema = z
  .object({
    // Offered by ORD-2 (nextPo); the user may replace it with any format (VM-11340, MR/2026/001), kept as typed apart
    // from the surrounding spaces. The length matches ORD-3's; "already used" is its 422.
    po: z.string().trim().min(1, "Enter the PO number.").max(50, "Use 50 characters or fewer."),
    supplierId: z.string().min(1, "Choose a supplier."),
    currency: z.string().regex(/^[A-Z]{3}$/),
    orderDate: z.string().min(1, "Choose the order date."),
    deliveryDate: z.string().min(1, "Choose the delivery date."),
    lines: z
      .array(lineSchema)
      .refine((lines) => lines.some((line) => !isBlankLine(line)), "Add at least one item.")
      .refine((lines) => lines.filter((line) => !isBlankLine(line)).length <= 50, "Add at most 50 items."),
    /** The deposit the supplier asked for, in the order's currency; blank when none was agreed. */
    depositRequiredCny: z.string().refine((text) => !text.trim() || isDepositRequired(text), DEPOSIT_REQUIRED_MESSAGE),
    /** FOB or CNF; starts unchosen, so nobody saves the wrong terms by default. */
    // A boolean check, not a type guard: the field starts as "" (unchosen).
    terms: z.string().refine((value): boolean => isTerms(value), TERMS_MESSAGE),
  })
  .refine((order) => !order.orderDate || !order.deliveryDate || order.deliveryDate >= order.orderDate, {
    path: ["deliveryDate"],
    message: "The delivery date can't be before the order date.",
  });
export type NewOrderValues = z.infer<typeof newOrderSchema>;

export const emptyLine = (): NewOrderValues["lines"][number] => ({ itemId: "", rateCny: "", quantity: "" });
/** The ORD-3 body: blank rows dropped, numbers parsed. No payments (D6). */
export function toCreateOrderBody(values: NewOrderValues): CreateOrderBody {
  return {
    po: values.po.trim(),
    supplierId: values.supplierId,
    currency: values.currency,
    orderDate: values.orderDate,
    deliveryDate: values.deliveryDate,
    ...(values.depositRequiredCny.trim() ? { depositRequiredCny: parseNumber(values.depositRequiredCny) } : {}),
    ...(isTerms(values.terms) ? { terms: values.terms } : {}),
    lines: values.lines
      .filter((line) => !isBlankLine(line))
      .map((line) => ({ itemId: line.itemId, quantity: parseNumber(line.quantity), rateCny: parseNumber(line.rateCny) })),
  };
}
