"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { dialogFooterButtonClass } from "@/components/shared/confirm-dialog";
import { NativeSelect, RequiredMark } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { lineAmount, orderTotals, parseNumber } from "@/features/order-form/order-totals";
import { apiClient } from "@/lib/api/client";
import type { OrderDetail, OrderOptions, UpdateOrderBody, UpdateOrderResponse } from "@/lib/api/types";
import { handleApiError, notifyError, notifySuccess } from "@/lib/feedback";
import { formatCNY, formatNumber, formatQty } from "@/lib/formatters";
import { cn } from "@/lib/utils";

// Edit order (ORD-5, D2). No reference design: the Settings dialog frame (53) with the New order lines table (15).
// Stage 1: both dates and the lines; stages 2-5: the delivery date only. Messages are proposed wording, the field
// checks the same as New order's.

/** What the dialog needs from ORD-4. */
export type EditableOrder = Pick<OrderDetail, "po" | "stage" | "orderDate" | "deliveryDate" | "paidCny" | "lines">;
/** ORD-2's active items. */
export type ItemOption = OrderOptions["items"][number];

export const EDIT_ORDER_TEXT = {
  saved: "Order saved",
  linesEditable: "Change the dates or the items. The supplier can't change, and the order total can't be less than what's already paid.",
  receivedOnly: "Goods have been received for this order, so only the delivery date can change.",
  belowPaid: (paid: number) => `The order total can't be less than the ${formatCNY(paid, { decimals: 2 })} already paid.`,
};

const MAX_LINES = 50;
const fieldClass = "gap-[5px]";
const labelClass = "gap-0.5 text-[12.5px] leading-[15px] font-bold text-label";
const headClass = "h-[30px] px-1.5 text-[12px] font-bold text-table-head-foreground";
const cellClass = "px-1.5 py-2";
const rowClass = "border-border-subtle hover:bg-transparent";
const messages = (...errors: ({ message?: string } | undefined)[]) => errors.filter((error) => error?.message);

const isWhole = (text: string) => Number.isInteger(parseNumber(text)) && parseNumber(text) > 0;
const lineSchema = z.object({
  /** The ORD-4 line this row keeps; none on an added row. */
  lineId: z.string().optional(),
  itemId: z.string().min(1, "Choose an item."),
  rateCny: z.string().refine((text) => parseNumber(text) > 0, "Enter the rate."),
  quantity: z.string().refine(isWhole, "Enter a whole quantity."),
});
type LineValues = z.infer<typeof lineSchema>;

const totalOf = (lines: Pick<LineValues, "rateCny" | "quantity">[]) =>
  orderTotals(lines.map((line) => ({ rate: parseNumber(line.rateCny), quantity: parseNumber(line.quantity) })), []).orderTotal;

const editSchema = (paid: number, linesEditable: boolean) =>
  z
    .object({
      orderDate: z.string().min(1, "Choose the order date."),
      deliveryDate: z.string().min(1, "Choose the delivery date."),
      lines: z.array(lineSchema).max(MAX_LINES, "Add at most 50 items."),
    })
    .refine((order) => !order.orderDate || !order.deliveryDate || order.deliveryDate >= order.orderDate, {
      path: ["deliveryDate"],
      message: "The delivery date can't be before the order date.",
    })
    .refine((order) => !linesEditable || totalOf(order.lines) >= paid, { path: ["lines"], message: EDIT_ORDER_TEXT.belowPaid(paid) });
type EditValues = z.infer<ReturnType<typeof editSchema>>;

/** The ORD-5 body: only the keys that changed; `lines` is the whole list (kept rows with their id) when any row changed. */
function toUpdateOrderBody(values: EditValues, order: EditableOrder, linesEditable: boolean): UpdateOrderBody {
  const body: UpdateOrderBody = {};
  if (values.deliveryDate !== order.deliveryDate) body.deliveryDate = values.deliveryDate;
  if (!linesEditable) return body;
  if (values.orderDate !== order.orderDate) body.orderDate = values.orderDate;
  const lines = values.lines.map(({ lineId, itemId, rateCny, quantity }) => ({
    ...(lineId ? { id: lineId } : {}),
    itemId,
    quantity: parseNumber(quantity),
    rateCny: parseNumber(rateCny),
  }));
  const unchanged =
    lines.length === order.lines.length &&
    lines.every((line, i) => {
      const was = order.lines[i]!;
      return line.id === was.id && line.itemId === was.item.id && line.quantity === was.quantity && line.rateCny === was.rateCny;
    });
  if (!unchanged) body.lines = lines;
  return body;
}

/**
 * The Edit order dialog. Save sends only what changed, then toasts, closes and reloads the page; the API's field
 * errors go under their fields (the lines one under the table); a refusal without fields toasts and keeps the dialog.
 */
export function EditOrderDialog({ order, items, open, onClose }: { order: EditableOrder; items: ItemOption[]; open: boolean; onClose: () => void }) {
  const linesEditable = order.stage === 1;
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent
        // Up to 50 lines: the dialog scrolls inside the screen, so Save stays reachable.
        className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto pb-[26px] sm:max-w-[720px]"
        // As the Settings dialogs: the dialog itself takes focus, no field.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus();
        }}
      >
        <DialogHeader className="gap-[7px]">
          <DialogTitle className="text-[21px] leading-[19px]">Edit order</DialogTitle>
          <DialogDescription className="text-sm leading-5">{linesEditable ? EDIT_ORDER_TEXT.linesEditable : EDIT_ORDER_TEXT.receivedOnly}</DialogDescription>
        </DialogHeader>
        {/* Content unmounts on close, so the form opens from the order every time. */}
        <EditOrderForm order={order} items={items} linesEditable={linesEditable} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}

function EditOrderForm({ order, items, linesEditable, onClose }: { order: EditableOrder; items: ItemOption[]; linesEditable: boolean; onClose: () => void }) {
  const router = useRouter();
  const { register, control, handleSubmit, setError, formState } = useForm<EditValues>({
    resolver: zodResolver(editSchema(order.paidCny, linesEditable)),
    defaultValues: {
      orderDate: order.orderDate,
      deliveryDate: order.deliveryDate,
      // Stages 2-5 show the lines read-only, straight from the order.
      lines: linesEditable
        ? order.lines.map((line) => ({ lineId: line.id, itemId: line.item.id, rateCny: String(line.rateCny), quantity: String(line.quantity) }))
        : [],
    },
  });
  const rows = useFieldArray({ control, name: "lines" });
  const lines = useWatch({ control, name: "lines" });
  const { errors, isSubmitting } = formState;
  const total = linesEditable ? totalOf(lines) : orderTotals(order.lines.map((l) => ({ rate: l.rateCny, quantity: l.quantity })), []).orderTotal;

  async function save(values: EditValues) {
    const body = toUpdateOrderBody(values, order, linesEditable);
    // Nothing changed, so nothing to send (ORD-5 needs at least one key).
    if (Object.keys(body).length === 0) return onClose();
    try {
      await apiClient.patch<UpdateOrderResponse>(`/orders/${encodeURIComponent(order.po)}`, body);
    } catch (error) {
      // 422: under its field, the first focused; a field this form doesn't show is toasted, never dropped. Anything
      // else (409 without fields, 5xx, network) toasts in handleApiError, and the dialog keeps the values.
      Object.entries(handleApiError(error) ?? {}).forEach(([field, message], index) => {
        if (field === "orderDate" || field === "deliveryDate" || field === "lines") setError(field, { message }, { shouldFocus: index === 0 });
        else notifyError(message);
      });
      return;
    }
    notifySuccess(EDIT_ORDER_TEXT.saved);
    onClose();
    router.refresh();
  }

  const lineErrors = rows.fields.flatMap((_, i) => {
    const e = errors.lines?.[i];
    return messages(e?.itemId, e?.rateCny, e?.quantity).map((error) => ({ message: `Line ${i + 1}: ${error?.message}` }));
  });

  return (
    // min-w-0: the lines table scrolls inside the dialog on a phone instead of widening it.
    <form noValidate onSubmit={handleSubmit(save)} className="mt-[14px] min-w-0">
      <div className="grid gap-x-4 gap-y-[14px] sm:grid-cols-2">
        <Field className={fieldClass} data-invalid={!!errors.orderDate}>
          <FieldLabel htmlFor="edit-order-date" className={labelClass}>
            Order date
          </FieldLabel>
          <Input id="edit-order-date" type="date" size="sm" readOnly={!linesEditable} aria-invalid={!!errors.orderDate} {...register("orderDate")} />
          <FieldError errors={[errors.orderDate]} />
        </Field>
        <Field className={fieldClass} data-invalid={!!errors.deliveryDate}>
          <FieldLabel htmlFor="edit-delivery-date" className={labelClass}>
            Delivery date <RequiredMark />
          </FieldLabel>
          <Input id="edit-delivery-date" type="date" size="sm" required aria-invalid={!!errors.deliveryDate} {...register("deliveryDate")} />
          <FieldError errors={[errors.deliveryDate]} />
        </Field>
      </div>

      <Table className="mt-5 min-w-[600px] table-fixed">
        <TableHeader>
          <TableRow className="bg-table-head hover:bg-table-head">
            <TableHead className={headClass}>Item</TableHead>
            <TableHead className={cn(headClass, "w-[100px]")}>Rate (¥)</TableHead>
            <TableHead className={cn(headClass, "w-[136px]")}>Quantity</TableHead>
            <TableHead className={cn(headClass, "w-[116px] text-right")}>Amount (¥)</TableHead>
            {linesEditable ? (
              <TableHead className={cn(headClass, "w-11")}>
                <span className="sr-only">Remove</span>
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {linesEditable
            ? rows.fields.map((field, i) => {
                const n = i + 1;
                const line = lines[i];
                const e = errors.lines?.[i];
                // A kept line whose item has since been deactivated still offers (and shows) that item.
                const kept = order.lines.find((l) => l.id === field.lineId);
                const inactive = kept && !items.some((item) => item.id === kept.item.id) ? kept : undefined;
                const unit = items.find((item) => item.id === line?.itemId)?.unit ?? (inactive?.item.id === line?.itemId ? inactive?.unit : "");
                const filled = !!line?.rateCny && !!line.quantity;
                return (
                  <TableRow key={field.id} className={rowClass}>
                    <TableCell className={cellClass}>
                      <NativeSelect
                        size="sm"
                        aria-label={`Item, line ${n}`}
                        aria-invalid={!!e?.itemId}
                        className="[&>select]:h-[38px] [&>select]:pl-2.5"
                        {...register(`lines.${i}.itemId`)}
                      >
                        <option value="">Select item</option>
                        {inactive ? <option value={inactive.item.id}>{inactive.item.name}</option> : null}
                        {items.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </NativeSelect>
                    </TableCell>
                    <TableCell className={cellClass}>
                      <Input
                        aria-label={`Rate (¥), line ${n}`}
                        aria-invalid={!!e?.rateCny}
                        inputMode="decimal"
                        className="h-[38px] px-2.5 text-right text-sm"
                        {...register(`lines.${i}.rateCny`)}
                      />
                    </TableCell>
                    <TableCell className={cellClass}>
                      {/* The unit sits inside the quantity box, as on New order. */}
                      <div
                        className={cn(
                          "flex h-[38px] items-center rounded-lg border border-input bg-input-background px-2.5 text-sm transition-colors focus-within:border-primary focus-within:ring-3 focus-within:ring-ring/25",
                          e?.quantity && "border-destructive",
                        )}
                      >
                        <input
                          aria-label={`Quantity, line ${n}`}
                          aria-invalid={!!e?.quantity}
                          inputMode="numeric"
                          className="h-full w-full min-w-0 bg-transparent text-right text-foreground outline-none"
                          {...register(`lines.${i}.quantity`)}
                        />
                        {unit ? <span className="pl-1">{unit}</span> : null}
                      </div>
                    </TableCell>
                    <TableCell className={cn(cellClass, "text-right")}>
                      {filled ? formatNumber(lineAmount({ rate: parseNumber(line.rateCny), quantity: parseNumber(line.quantity) }), 2) : ""}
                    </TableCell>
                    <TableCell className={cellClass}>
                      {/* An order keeps at least one line. */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove line ${n}`}
                        disabled={rows.fields.length === 1}
                        onClick={() => rows.remove(i)}
                      >
                        <XIcon />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            : order.lines.map((line) => (
                <TableRow key={line.id} className={rowClass}>
                  <TableCell className={cellClass}>{line.item.name}</TableCell>
                  <TableCell className={cellClass}>{formatNumber(line.rateCny, 2)}</TableCell>
                  <TableCell className={cellClass}>{formatQty(line.quantity, line.unit)}</TableCell>
                  <TableCell className={cn(cellClass, "text-right")}>{formatNumber(lineAmount({ rate: line.rateCny, quantity: line.quantity }), 2)}</TableCell>
                </TableRow>
              ))}
        </TableBody>
      </Table>
      <FieldError className="mt-2" errors={messages(errors.lines, errors.lines?.root, ...lineErrors)} />
      {linesEditable && rows.fields.length < MAX_LINES ? (
        <Button
          type="button"
          variant="link"
          className="mt-[13px] flex h-auto w-fit border-0 p-0 text-[13.5px] leading-[10px]"
          onClick={() => rows.append({ itemId: "", rateCny: "", quantity: "" })}
        >
          + Add item
        </Button>
      ) : null}

      <div className="mt-3 flex flex-wrap items-baseline justify-end gap-x-7 gap-y-1 border-t pt-[12.5px]">
        <span className="text-sm leading-4 text-muted-foreground">Paid so far {formatCNY(order.paidCny, { decimals: 2, spaced: true })}</span>
        <span className="text-[15px] leading-4">Order total</span>
        <output aria-label="Order total" className="text-[17px] leading-[19px] font-bold">
          {formatCNY(total, { decimals: 2, spaced: true })}
        </output>
      </div>

      <DialogFooter className="mt-5 pt-4">
        <Button type="button" variant="outline" className={cn(dialogFooterButtonClass, "border-input")} onClick={onClose}>
          Cancel
        </Button>
        {/* Disabled while the request runs, so one click saves once. */}
        <Button type="submit" className={dialogFooterButtonClass} disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save order"}
        </Button>
      </DialogFooter>
    </form>
  );
}
