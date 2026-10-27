import { z } from "zod";

import type { CreateOrderBody, OrderOptions } from "@/lib/api/types";

import { parseNumber } from "./order-totals";

// New order form (15): what the inputs hold (strings, as typed), its client-side checks matching ORD-3, and the
// ORD-3 body. The reference has "+ Add item" and "+ Add deposit" but no remove control, so a row left completely
// empty is ignored rather than rejected. Messages are proposed wording, except the delivery-date one (contract).

/** A deposit's payee: "supplier" (the order's supplier) or a shipping agent's id. */
export const SUPPLIER_PAYEE = "supplier";

const isWhole = (text: string) => Number.isInteger(parseNumber(text)) && parseNumber(text) > 0;
const isPositive = (text: string) => parseNumber(text) > 0;
const issue = (ctx: z.RefinementCtx, path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });

export const isBlankLine = (line: { itemId: string; rateCny: string; quantity: string }) =>
  !line.itemId && !line.rateCny.trim() && !line.quantity.trim();
export const isBlankDeposit = (deposit: { amountCny: string }) => !deposit.amountCny.trim();

const lineSchema = z.object({ itemId: z.string(), rateCny: z.string(), quantity: z.string() }).superRefine((line, ctx) => {
  if (isBlankLine(line)) return;
  if (!line.itemId) issue(ctx, "itemId", "Choose an item.");
  if (!isPositive(line.rateCny)) issue(ctx, "rateCny", "Enter the rate.");
  if (!isWhole(line.quantity)) issue(ctx, "quantity", "Enter a whole quantity.");
});

const depositSchema = z
  .object({ payee: z.string(), amountCny: z.string(), paidOn: z.string(), rateInr: z.string(), mode: z.string() })
  .superRefine((deposit, ctx) => {
    if (isBlankDeposit(deposit)) return;
    if (!isPositive(deposit.amountCny)) issue(ctx, "amountCny", "Enter the amount.");
    if (!deposit.payee) issue(ctx, "payee", "Choose who was paid.");
    if (!deposit.paidOn) issue(ctx, "paidOn", "Choose the date paid.");
    if (!isPositive(deposit.rateInr)) issue(ctx, "rateInr", "Enter the rate.");
    if (!deposit.mode.trim()) issue(ctx, "mode", "Enter the mode.");
  });

export const newOrderSchema = z
  .object({
    supplierId: z.string().min(1, "Choose a supplier."),
    orderDate: z.string().min(1, "Choose the order date."),
    deliveryDate: z.string().min(1, "Choose the delivery date."),
    lines: z
      .array(lineSchema)
      .refine((lines) => lines.some((line) => !isBlankLine(line)), "Add at least one item.")
      .refine((lines) => lines.filter((line) => !isBlankLine(line)).length <= 50, "Add at most 50 items."),
    deposits: z.array(depositSchema).refine((deposits) => deposits.filter((d) => !isBlankDeposit(d)).length <= 10, "Add at most 10 deposits."),
  })
  .refine((order) => !order.orderDate || !order.deliveryDate || order.deliveryDate >= order.orderDate, {
    path: ["deliveryDate"],
    message: "The delivery date can't be before the order date.",
  });
export type NewOrderValues = z.infer<typeof newOrderSchema>;

export const emptyLine = (): NewOrderValues["lines"][number] => ({ itemId: "", rateCny: "", quantity: "" });
export const emptyDeposit = (paidOn: string): NewOrderValues["deposits"][number] => ({
  payee: SUPPLIER_PAYEE,
  amountCny: "",
  paidOn,
  rateInr: "",
  mode: "",
});

/** The ORD-3 body: blank rows dropped, numbers parsed, payees resolved to the supplier's or agent's name. */
export function toCreateOrderBody(values: NewOrderValues, options: Pick<OrderOptions, "suppliers" | "agents">): CreateOrderBody {
  const supplierName = options.suppliers.find((s) => s.id === values.supplierId)?.name ?? "";
  return {
    supplierId: values.supplierId,
    orderDate: values.orderDate,
    deliveryDate: values.deliveryDate,
    lines: values.lines
      .filter((line) => !isBlankLine(line))
      .map((line) => ({ itemId: line.itemId, quantity: parseNumber(line.quantity), rateCny: parseNumber(line.rateCny) })),
    deposits: values.deposits
      .filter((deposit) => !isBlankDeposit(deposit))
      .map((deposit) => {
        const supplier = deposit.payee === SUPPLIER_PAYEE;
        return {
          payee: supplier ? supplierName : (options.agents.find((a) => a.id === deposit.payee)?.name ?? ""),
          payeeRole: supplier ? "supplier" : "agent",
          amountCny: parseNumber(deposit.amountCny),
          paidOn: deposit.paidOn,
          rateInr: parseNumber(deposit.rateInr),
          mode: deposit.mode.trim(),
        };
      }),
  };
}
