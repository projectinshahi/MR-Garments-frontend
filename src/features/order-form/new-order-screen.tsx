"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch, type FieldPath } from "react-hook-form";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/shared/cards";
import { FormFooter, NativeSelect, RequiredMark } from "@/components/shared/form";
import { KeyValueList } from "@/components/shared/key-value-list";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiClient } from "@/lib/api/client";
import type { CreateOrderResponse } from "@/lib/api/types";
import { handleApiError, notifyError, notifySuccess } from "@/lib/feedback";
import { formatCNY, formatINR, formatNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";

import type { NewOrderData } from "./data/queries";
import { emptyDeposit, emptyLine, newOrderSchema, SUPPLIER_PAYEE, toCreateOrderBody, type NewOrderValues } from "./new-order-form";
import { depositINR, lineAmount, orderTotals, parseNumber } from "./order-totals";

// Measured from 15_4_New_order.jpeg: 12.5 px bold labels 5 px above 42 px fields with 14 px text, 12 px table
// headers, 38 px item inputs with 10 px padding. Cards use titleGap="none" and place content where the reference has it.
const fieldClass = "gap-[5px]";
const labelClass = "gap-0.5 text-[12.5px] leading-[15px] font-bold text-label";
const headClass = "h-[30px] px-1.5 text-[12px] font-bold text-table-head-foreground";
const cellClass = "px-1.5 py-2";
const lineInput = "h-[38px] px-2.5 text-sm";
// "+ Add item" / "+ Add deposit": 13.5 px bold text links on a 10 px line, flush with the card edge.
// Block-level (flex w-fit) so the card's line-height strut does not add height under them.
const addLinkClass = "mt-[13px] flex h-auto w-fit border-0 p-0 text-[13.5px] leading-[10px]";
const factLabel = "text-[12.5px] leading-[17px] text-muted-foreground";
const factInput = "h-[34px] px-2 text-sm";
const spacedCNY = (value: number) => formatCNY(value, { spaced: true });
const messages = (...errors: ({ message?: string } | undefined)[]) => errors.filter((error) => error?.message);

/** New order, Stage 1: order and deposit (15_4_New_order.jpeg). Places the order with ORD-3. */
export function NewOrderScreen({ data: { options, today } }: { data: NewOrderData }) {
  const router = useRouter();
  const defaultValues: NewOrderValues = { supplierId: "", orderDate: today, deliveryDate: "", lines: [emptyLine()], deposits: [] };
  const { register, control, handleSubmit, setError, reset, formState } = useForm<NewOrderValues>({
    resolver: zodResolver(newOrderSchema),
    defaultValues,
  });
  const lineRows = useFieldArray({ control, name: "lines" });
  const depositRows = useFieldArray({ control, name: "deposits" });
  const { errors } = formState;

  const [supplierId, lines, deposits] = useWatch({ control, name: ["supplierId", "lines", "deposits"] });
  const supplier = options.suppliers.find((s) => s.id === supplierId);
  const unitOf = (itemId: string) => options.items.find((item) => item.id === itemId)?.unit ?? "";
  const numericLines = lines.map((line) => ({ rate: parseNumber(line.rateCny), quantity: parseNumber(line.quantity) }));
  const numericDeposits = deposits.map((d) => ({ amount: parseNumber(d.amountCny), rate: parseNumber(d.rateInr) }));
  const totals = orderTotals(numericLines, numericDeposits);

  async function place(order: NewOrderValues) {
    let created: CreateOrderResponse;
    try {
      created = await apiClient.post<CreateOrderResponse>("/orders", toCreateOrderBody(order, options));
    } catch (error) {
      // 422: each message under its field, the first focused; a field this form doesn't show is toasted, never
      // dropped. Other failures toast (handleApiError).
      Object.entries(handleApiError(error) ?? {}).forEach(([field, message], index) => {
        if (Object.hasOwn(defaultValues, field)) setError(field as FieldPath<NewOrderValues>, { message }, { shouldFocus: index === 0 });
        else notifyError(message);
      });
      return;
    }
    // The route stays mounted (Activity): empty the form so a later visit starts fresh.
    reset();
    notifySuccess(`Order ${created.order.po} placed`);
    router.push(`/orders/${created.order.po}`);
    router.refresh();
  }

  const lineErrors = lineRows.fields.flatMap((_, i) => {
    const e = errors.lines?.[i];
    return messages(e?.itemId, e?.rateCny, e?.quantity).map((error) => ({ message: `Line ${i + 1}: ${error?.message}` }));
  });
  const depositErrors = depositRows.fields.flatMap((_, i) => {
    const e = errors.deposits?.[i];
    return messages(e?.payee, e?.amountCny, e?.paidOn, e?.rateInr, e?.mode).map((error) => ({
      message: `Deposit ${i + 1}: ${error?.message}`,
    }));
  });

  return (
    <>
      <PageHeader
        title="New order"
        parent={{ label: "Orders", href: "/orders" }}
        actions={
          <Button asChild variant="outline">
            <Link href="/orders">Cancel</Link>
          </Button>
        }
      />
      <PageContainer>
        <form noValidate className="grid items-start gap-(--page-gap) lg:grid-cols-[minmax(0,1fr)_410px]" onSubmit={handleSubmit(place)}>
          <div className="flex min-w-0 flex-col gap-(--page-gap)">
            <SectionCard title="Order details" titleGap="none" bottomGap="form">
              <FieldGroup className="mt-[11px] grid gap-x-4 gap-y-[14px] sm:grid-cols-3">
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="po-number" className={labelClass}>
                    Purchase order no.
                  </FieldLabel>
                  {/* Assigned by the server when the order is placed. */}
                  <Input id="po-number" readOnly value={options.nextPo} size="sm" />
                </Field>
                <Field className={fieldClass} data-invalid={!!errors.orderDate}>
                  <FieldLabel htmlFor="order-date" className={labelClass}>
                    Order date
                  </FieldLabel>
                  <Input id="order-date" type="date" aria-invalid={!!errors.orderDate} size="sm" {...register("orderDate")} />
                  <FieldError errors={[errors.orderDate]} />
                </Field>
                <Field className={fieldClass} data-invalid={!!errors.deliveryDate}>
                  <FieldLabel htmlFor="delivery-date" className={labelClass}>
                    Delivery date <RequiredMark />
                  </FieldLabel>
                  <Input id="delivery-date" type="date" required aria-invalid={!!errors.deliveryDate} size="sm" {...register("deliveryDate")} />
                  <FieldError errors={[errors.deliveryDate]} />
                </Field>
                <Field className={cn(fieldClass, "sm:col-span-2")} data-invalid={!!errors.supplierId}>
                  <FieldLabel htmlFor="supplier" className={labelClass}>
                    Supplier <RequiredMark />
                  </FieldLabel>
                  <NativeSelect size="sm" id="supplier" required aria-invalid={!!errors.supplierId} {...register("supplierId")}>
                    <option value="">Select supplier</option>
                    {options.suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </NativeSelect>
                  <FieldError errors={[errors.supplierId]} />
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="currency" className={labelClass}>
                    Currency
                  </FieldLabel>
                  {/* CNY only (Q8). */}
                  <NativeSelect size="sm" id="currency">
                    <option>CNY (¥)</option>
                  </NativeSelect>
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="contact-person" className={labelClass}>
                    Contact person
                  </FieldLabel>
                  <Input id="contact-person" readOnly value={supplier?.contactPerson ?? ""} size="sm" />
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="phone" className={labelClass}>
                    Phone
                  </FieldLabel>
                  <Input id="phone" type="tel" readOnly value={supplier?.phone ?? ""} size="sm" />
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="city" className={labelClass}>
                    City
                  </FieldLabel>
                  <Input id="city" readOnly value={supplier?.city ?? ""} size="sm" />
                </Field>
              </FieldGroup>
            </SectionCard>

            <SectionCard title="Items" titleGap="none">
              <Table className="mt-3 min-w-[600px] table-fixed">
                <TableHeader>
                  <TableRow className="bg-table-head hover:bg-table-head">
                    <TableHead className={headClass}>Item</TableHead>
                    <TableHead className={cn(headClass, "w-[107px]")}>Rate (¥)</TableHead>
                    <TableHead className={cn(headClass, "w-[158px]")}>Quantity</TableHead>
                    <TableHead className={cn(headClass, "w-[148px] text-right")}>Amount (¥)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineRows.fields.map((field, i) => {
                    const n = i + 1;
                    const line = lines[i];
                    const unit = unitOf(line?.itemId ?? "");
                    const filled = !!line?.rateCny && !!line.quantity;
                    const e = errors.lines?.[i];
                    return (
                      <TableRow key={field.id} className="border-border-subtle hover:bg-transparent">
                        <TableCell className={cellClass}>
                          <NativeSelect
                            size="sm"
                            aria-label={`Item, line ${n}`}
                            aria-invalid={!!e?.itemId}
                            className="[&>select]:h-[38px] [&>select]:pl-2.5"
                            {...register(`lines.${i}.itemId`)}
                          >
                            <option value="">Select item</option>
                            {options.items.map((item) => (
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
                            className={cn(lineInput, "text-right")}
                            {...register(`lines.${i}.rateCny`)}
                          />
                        </TableCell>
                        <TableCell className={cellClass}>
                          {/* The unit sits inside the quantity box ("2,400 m"), as in the reference. */}
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
                        <TableCell className={cellClass}>
                          <Input
                            aria-label={`Amount (¥), line ${n}`}
                            readOnly
                            value={filled ? formatNumber(lineAmount(numericLines[i]!), 2) : ""}
                            className={cn(lineInput, "text-right read-only:bg-input-background")}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <FieldError className="mt-2" errors={messages(errors.lines, errors.lines?.root, ...lineErrors)} />

              <Button type="button" variant="link" className={addLinkClass} onClick={() => lineRows.append(emptyLine())}>
                + Add item
              </Button>

              <div className="mt-3 flex items-start justify-end gap-7 border-t pt-[12.5px]">
                <span className="text-[15px] leading-4">Order total</span>
                <output aria-label="Order total" className="text-[17px] leading-[19px] font-bold">
                  {formatCNY(totals.orderTotal, { decimals: 2, spaced: true })}
                </output>
              </div>
            </SectionCard>
          </div>

          <div className="flex min-w-0 flex-col gap-(--page-gap)">
            <SectionCard title="Deposits paid against this order" titleGap="none">
              {depositRows.fields.length > 0 ? (
                <div className="mt-3 flex flex-col gap-2.5">
                  {depositRows.fields.map((field, i) => {
                    const n = i + 1;
                    const e = errors.deposits?.[i];
                    const amountINR = depositINR(numericDeposits[i] ?? { amount: 0, rate: 0 });
                    return (
                      <article key={field.id} className="rounded-[10px] border bg-input-background px-3.5 pt-2.5 pb-[11px]">
                        <div className="flex items-center justify-between gap-3 text-sm leading-5 font-bold">
                          <NativeSelect
                            size="sm"
                            aria-label={`Paid to, deposit ${n}`}
                            aria-invalid={!!e?.payee}
                            className="[&>select]:h-[34px] [&>select]:font-bold"
                            {...register(`deposits.${i}.payee`)}
                          >
                            <option value={SUPPLIER_PAYEE}>{supplier ? `${supplier.name} (supplier)` : "Supplier"}</option>
                            {options.agents.map((agent) => (
                              <option key={agent.id} value={agent.id}>
                                {agent.name} (agent)
                              </option>
                            ))}
                          </NativeSelect>
                          <Input
                            aria-label={`Amount (¥), deposit ${n}`}
                            aria-invalid={!!e?.amountCny}
                            inputMode="decimal"
                            placeholder="¥"
                            className={cn(factInput, "w-[110px] shrink-0 text-right font-bold")}
                            {...register(`deposits.${i}.amountCny`)}
                          />
                        </div>
                        <div className="mt-[5px] grid grid-cols-[1.3fr_1fr_1fr] gap-x-2">
                          <label className="flex min-w-0 flex-col">
                            <span className={factLabel}>Paid on</span>
                            <Input type="date" aria-invalid={!!e?.paidOn} className={factInput} {...register(`deposits.${i}.paidOn`)} />
                          </label>
                          <label className="flex min-w-0 flex-col">
                            <span className={factLabel}>Rate to INR</span>
                            <Input inputMode="decimal" aria-invalid={!!e?.rateInr} className={factInput} {...register(`deposits.${i}.rateInr`)} />
                          </label>
                          <label className="flex min-w-0 flex-col">
                            <span className={factLabel}>Mode</span>
                            <Input aria-invalid={!!e?.mode} className={factInput} {...register(`deposits.${i}.mode`)} />
                          </label>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-4 border-t border-dashed pt-[7px]">
                          <span className="text-[13px] leading-5 text-muted-foreground">Amount in INR</span>
                          <span className="text-[15px] leading-5 font-bold">{formatINR(amountINR)}</span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : null}
              <FieldError className="mt-2" errors={messages(errors.deposits, errors.deposits?.root, ...depositErrors)} />
              <Button type="button" variant="link" className={addLinkClass} onClick={() => depositRows.append(emptyDeposit(today))}>
                + Add deposit
              </Button>
            </SectionCard>

            <SectionCard title="Summary" titleGap="none" bottomGap="form">
              <KeyValueList
                density="compact"
                className="mt-2.5 border-b border-border-subtle"
                items={[
                  { label: "Order total", value: spacedCNY(totals.orderTotal) },
                  { label: "Deposits paid", value: spacedCNY(totals.depositsPaid) },
                  { label: "Deposits in INR", value: formatINR(totals.depositsINR) },
                  {
                    label: <span className="text-base leading-5 font-bold">Balance to pay</span>,
                    value: <span className="text-base leading-5 font-bold">{spacedCNY(totals.balance)}</span>,
                  },
                ]}
              />
              <FormFooter className="mt-3.5 gap-3">
                {/* Disabled while the request runs (no spinner is designed), so one click places one order. */}
                <Button type="submit" size="lg" className="min-w-0 flex-1 text-[15px]" disabled={formState.isSubmitting}>
                  Place order
                </Button>
              </FormFooter>
            </SectionCard>
          </div>
        </form>
      </PageContainer>
    </>
  );
}
