"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/shared/cards";
import { FormFooter, NativeSelect, RequiredMark } from "@/components/shared/form";
import { KeyValueList } from "@/components/shared/key-value-list";
import { StatusPill } from "@/components/shared/status-pill";
import { Timeline } from "@/components/shared/timeline";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api/client";
import { handleApiError, notifyError, notifySuccess } from "@/lib/feedback";
import { formatCNY, formatNumber, formatQty } from "@/lib/formatters";
import { cn } from "@/lib/utils";

import type { RecordReceiptData } from "./data/queries";
import {
  deliveryEvents,
  emptyLines,
  lineShort,
  paymentEffect,
  receiptSchema,
  remarkRequired,
  toReceiptBody,
  type ReceiptFormValues,
} from "./receiving-logic";

// Measured from 21_7_Receiving_(China)_-_Stage_2_form.jpeg: 12.5 px bold labels 5 px above the field, 12 px table
// headers. Cards use titleGap="none" and place their content where the reference has it.
const fieldClass = "gap-[5px]";
const labelClass = "gap-0.5 text-[12.5px] leading-[15px] font-bold text-label";
const headClass = "h-[30px] px-1.5 text-[12px] font-bold text-table-head-foreground";
const cellClass = "px-1.5 py-0";
const spacedCNY = (value: number) => formatCNY(value, { spaced: true });

/** REC-3 422 fields shown on this form, in screen order. Any other field's message is toasted. */
const FORM_FIELDS = ["orderId", "receivedOn", "locationId", "bundles", "deliveryNote", "lines", "shortRemark"] as const;
/** Proposed wording: no SUCCESS message fits a receipt yet. */
const RECEIPT_SAVED = "Receipt saved";

/**
 * Record receipt, Stage 2 (21_7_Receiving_(China)_-_Stage_2_form.jpeg). The order is chosen in the PO callout (the
 * reference has no picker); lines, payment and deliveries follow it. Saves through REC-3, then goes to the list.
 */
export function RecordReceiptScreen({ data }: { data: RecordReceiptData }) {
  const { options, today } = data;
  const router = useRouter();
  const firstOrder = options.orders[0]?.orderId ?? "";
  const defaults: ReceiptFormValues = {
    orderId: firstOrder,
    receivedOn: today,
    locationId: options.offices[0]?.id ?? "",
    bundles: "",
    deliveryNote: "",
    shortRemark: "",
    lines: emptyLines(options, firstOrder),
  };
  const { register, control, handleSubmit, setValue, setError, reset, formState } = useForm<ReceiptFormValues>({
    resolver: zodResolver(receiptSchema(options, today)),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = formState;
  const orderId = useWatch({ control, name: "orderId" });
  const typed = useWatch({ control, name: "lines" });
  const order = options.orders.find((o) => o.orderId === orderId);
  const lines = (order?.lines ?? []).map((line, i) => ({
    item: line.item,
    unit: line.unit,
    ordered: line.ordered,
    receivedEarlier: line.receivedEarlier,
    receivedNow: Number(typed[i]?.quantity) || 0,
    unitPrice: line.unitPriceCny ?? undefined,
  }));
  // REC-2 sends the money as null to users who can't view payments (China staff): no "Effect on payment" card for them.
  const showPayment = order?.orderValueCny !== null;
  const effect = paymentEffect({ orderValue: order?.orderValueCny ?? 0, depositsPaid: order?.depositsPaidCny ?? 0 }, lines);
  const deliveries = deliveryEvents(data.receipts, orderId);
  const linesError = errors.lines?.message ?? errors.lines?.root?.message;
  const remarkNeeded = remarkRequired(order, typed);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await apiClient.post<{ receipt: { id: string } }>("/receipts", toReceiptBody(values));
    } catch (error) {
      // A 409 without fields (order_not_receivable) is toasted with its own message by handleApiError.
      const fields = handleApiError(error) ?? {};
      FORM_FIELDS.filter((key) => fields[key]).forEach((key, index) =>
        setError(key, { type: "server", message: fields[key] }, { shouldFocus: index === 0 }),
      );
      Object.entries(fields)
        .filter(([key]) => !(FORM_FIELDS as readonly string[]).includes(key))
        .forEach(([, message]) => notifyError(message));
      return;
    }
    notifySuccess(RECEIPT_SAVED);
    // The page stays mounted (Activity): start the next visit from an empty form.
    reset(defaults);
    router.push("/receiving");
    router.refresh();
  });

  return (
    <>
      <PageHeader
        title="Record receipt"
        parent={{ label: "Receiving (China)", href: "/receiving" }}
        actions={
          <Button asChild variant="outline">
            <Link href="/receiving">Cancel</Link>
          </Button>
        }
      />
      <PageContainer>
        <div className="grid items-start gap-(--page-gap) lg:grid-cols-[minmax(0,1fr)_400px]">
          <form noValidate className="flex min-w-0 flex-col gap-(--page-gap)" onSubmit={onSubmit}>
            <SectionCard aria-label="Receipt details">
              <div className="flex min-h-[42px] flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-[10px] bg-callout-info px-3.5 py-1.5">
                <p className="flex flex-wrap items-center gap-x-2 text-sm">
                  {/* The order picker: drawn as the bold PO, a native select so it stays keyboard-friendly. */}
                  <select
                    aria-label="Order"
                    aria-invalid={!!errors.orderId}
                    className="-ml-1 cursor-pointer rounded-md bg-transparent px-1 text-[15px] font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/25"
                    {...register("orderId", { onChange: (event) => setValue("lines", emptyLines(options, event.target.value)) })}
                  >
                    {options.orders.length ? null : <option value="">No orders to receive</option>}
                    {options.orders.map((o) => (
                      <option key={o.orderId} value={o.orderId}>
                        {o.po}
                      </option>
                    ))}
                  </select>
                  {order ? (
                    <>
                      <span aria-hidden>·</span>
                      <span>{order.lines[0]?.item}</span>
                      <span aria-hidden>·</span>
                      <span>{order.supplier}</span>
                    </>
                  ) : null}
                </p>
                {order?.lines.some((l) => l.receivedEarlier > 0) ? <StatusPill tone="warning">Partly received</StatusPill> : null}
              </div>
              <FieldError className="mt-1" errors={[errors.orderId]} />

              <FieldGroup className="mt-[15px] grid gap-x-4 gap-y-[14px] sm:grid-cols-3">
                <Field className={fieldClass} data-invalid={!!errors.receivedOn}>
                  <FieldLabel htmlFor="received-on" className={labelClass}>
                    Received on <RequiredMark />
                  </FieldLabel>
                  <Input size="sm" id="received-on" type="date" max={today} required aria-invalid={!!errors.receivedOn} {...register("receivedOn")} />
                  <FieldError errors={[errors.receivedOn]} />
                </Field>
                <Field className={fieldClass} data-invalid={!!errors.locationId}>
                  <FieldLabel htmlFor="received-office" className={labelClass}>
                    Received at office <RequiredMark />
                  </FieldLabel>
                  <NativeSelect size="sm" id="received-office" required aria-invalid={!!errors.locationId} {...register("locationId")}>
                    {/* REC-2 offers active China offices only; India offices and warehouses never receive here. */}
                    {options.offices.length ? null : <option value="">No active China office</option>}
                    {options.offices.map((office) => (
                      <option key={office.id} value={office.id}>
                        {office.name}
                      </option>
                    ))}
                  </NativeSelect>
                  <FieldError errors={[errors.locationId]} />
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="received-by" className={labelClass}>
                    Received by <RequiredMark />
                  </FieldLabel>
                  {/* The signed-in user; the API records it. */}
                  <Input size="sm" id="received-by" readOnly value={data.receivedBy} className="read-only:bg-input-background" />
                </Field>
                <Field className={fieldClass} data-invalid={!!errors.bundles}>
                  <FieldLabel htmlFor="bundles-now" className={labelClass}>
                    Bundles received now <RequiredMark />
                  </FieldLabel>
                  <Input size="sm" id="bundles-now" required inputMode="numeric" aria-invalid={!!errors.bundles} {...register("bundles")} />
                  <FieldError errors={[errors.bundles]} />
                </Field>
                <Field className={fieldClass} data-invalid={!!errors.deliveryNote}>
                  <FieldLabel htmlFor="delivery-note" className={labelClass}>
                    Supplier delivery note no.
                  </FieldLabel>
                  <Input size="sm" id="delivery-note" autoComplete="off" aria-invalid={!!errors.deliveryNote} {...register("deliveryNote")} />
                  <FieldError errors={[errors.deliveryNote]} />
                </Field>
              </FieldGroup>
            </SectionCard>

            <SectionCard title="Ordered against received" titleGap="none">
              <Table className="mt-[9px]">
                <TableHeader>
                  <TableRow className="bg-table-head hover:bg-table-head">
                    <TableHead className={headClass}>Item</TableHead>
                    <TableHead className={cn(headClass, "w-[130px] text-right")}>Ordered</TableHead>
                    <TableHead className={cn(headClass, "w-[160px] text-right")}>Received earlier</TableHead>
                    <TableHead className={cn(headClass, "w-[142px] text-right")}>Received now</TableHead>
                    <TableHead className={cn(headClass, "w-[86px] text-right")}>Short</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, i) => {
                    const short = lineShort(line);
                    const error = errors.lines?.[i]?.quantity;
                    return (
                      <TableRow key={`${orderId}-${i}`} className="h-[60px] border-border-subtle hover:bg-transparent">
                        <TableCell className={cn(cellClass, "font-bold")}>{line.item}</TableCell>
                        <TableCell className={cn(cellClass, "text-right")}>{formatQty(line.ordered, line.unit)}</TableCell>
                        <TableCell className={cn(cellClass, "text-right")}>{formatQty(line.receivedEarlier, line.unit)}</TableCell>
                        {/* The reference sets the input 8 px from the row top, above the text line. */}
                        <TableCell className={cn(cellClass, "pt-2 text-right align-top")}>
                          <Input
                            aria-label={`Received now, ${line.item}`}
                            inputMode="numeric"
                            aria-invalid={!!error}
                            {...register(`lines.${i}.quantity`)}
                            className="h-[38px] w-[130px] pr-3 text-right text-sm font-bold text-label"
                          />
                          <FieldError className="pb-1 text-left" errors={[error]} />
                        </TableCell>
                        <TableCell className={cn(cellClass, "text-right", short > 0 && "font-bold text-danger")}>
                          {short > 0 ? formatQty(short, line.unit) : formatNumber(short)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {linesError ? <FieldError className="mt-2">{linesError}</FieldError> : null}

              <Field className={cn(fieldClass, "mt-[14px]")} data-invalid={!!errors.shortRemark}>
                {/* Required, as REC-3 requires it, only while a line is still short after this receipt. */}
                <FieldLabel htmlFor="short-remark" className={labelClass}>
                  Short remark {remarkNeeded ? <RequiredMark /> : null}
                </FieldLabel>
                <Textarea
                  id="short-remark"
                  className="min-h-[74px] resize-none"
                  aria-required={remarkNeeded}
                  aria-invalid={!!errors.shortRemark}
                  {...register("shortRemark")}
                />
                <FieldError errors={[errors.shortRemark]} />
              </Field>

              <FormFooter className="mt-4 gap-3">
                <Button type="submit" size="lg" className="w-[190px] min-w-0 text-[15px]" disabled={isSubmitting}>
                  Save receipt
                </Button>
              </FormFooter>
            </SectionCard>
          </form>

          <div className="flex flex-col gap-(--page-gap)">
            {showPayment ? (
              <SectionCard title="Effect on payment" titleGap="none">
                <KeyValueList
                  size="sm"
                  className="mt-[10px]"
                  items={[
                    { label: "Order value", value: spacedCNY(order?.orderValueCny ?? 0) },
                    { label: "Deposits paid", value: spacedCNY(order?.depositsPaidCny ?? 0) },
                    { label: "Balance before this receipt", value: spacedCNY(effect.balanceBefore) },
                    ...effect.deductions
                      .filter((d) => d.short > 0)
                      .map((d) => ({
                        label: `Short: ${formatQty(d.short, d.unit)} × ${formatCNY(d.unitPrice)}`,
                        value: <span className="font-bold text-danger">− {spacedCNY(d.amount)}</span>,
                      })),
                  ]}
                  total={{ label: "Balance to pay now", value: spacedCNY(effect.balanceNow) }}
                />
              </SectionCard>
            ) : null}
            <SectionCard title={order ? `Deliveries for ${order.po}` : "Deliveries"} titleGap="none">
              {deliveries.length ? (
                <Timeline
                  size="sm"
                  className="mt-2.5"
                  items={deliveries.map((event) => ({
                    title: event.title,
                    marker: event.marker,
                    detail: event.lines.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    )),
                  }))}
                />
              ) : (
                <p className="mt-2.5 text-[12.5px] text-muted-foreground">No deliveries yet.</p>
              )}
            </SectionCard>
          </div>
        </div>
      </PageContainer>
    </>
  );
}
