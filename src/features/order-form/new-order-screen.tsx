"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch, type FieldPath } from "react-hook-form";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Callout, SectionCard } from "@/components/shared/cards";
import { FormFooter, NativeSelect, RequiredMark } from "@/components/shared/form";
import { KeyValueList } from "@/components/shared/key-value-list";
import { orderHref } from "@/components/shared/po-link";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { balanceText, HELD_MESSAGE, round2 } from "@/features/payments/money";
import { apiClient } from "@/lib/api/client";
import type { CreateOrderResponse } from "@/lib/api/types";
import { handleApiError, notifyError, notifySuccess } from "@/lib/feedback";
import { currencySymbol, currencyLabel, formatMoney, formatNumber, rateText } from "@/lib/formatters";
import { cn } from "@/lib/utils";

import type { NewOrderData } from "./data/queries";
import { CONTAINER_TERMS, emptyLine, newOrderSchema, TERMS_HELP, toCreateOrderBody, type NewOrderValues } from "./new-order-form";
import { lineAmount, orderTotal, parseNumber } from "./order-totals";

// Measured from 15_4_New_order.jpeg: 12.5 px bold labels 5 px above 42 px fields with 14 px text, 12 px table
// headers, 38 px item inputs with 10 px padding. Cards use titleGap="none" and place content where the reference has it.
const fieldClass = "gap-[5px]";
const labelClass = "gap-0.5 text-[12.5px] leading-[15px] font-bold text-label";
const headClass = "h-[30px] px-1.5 text-[12px] font-bold text-table-head-foreground";
const cellClass = "px-1.5 py-2";
const lineInput = "h-[38px] px-2.5 text-sm";
// "+ Add item": a 13.5 px bold text link on a 10 px line, flush with the card edge.
// Block-level (flex w-fit) so the card's line-height strut does not add height under them.
const addLinkClass = "mt-[13px] flex h-auto w-fit border-0 p-0 text-[13.5px] leading-[10px]";
const messages = (...errors: ({ message?: string } | undefined)[]) => errors.filter((error) => error?.message);

/** New order, Stage 1: order and deposit (15_4_New_order.jpeg). Places the order with ORD-3. */
export function NewOrderScreen({ data: { options, today } }: { data: NewOrderData }) {
  const router = useRouter();
  const defaultValues: NewOrderValues = {
    po: options.nextPo,
    supplierId: "",
    currency: "CNY",
    orderDate: today,
    deliveryDate: "",
    lines: [emptyLine()],
    depositRequiredCny: "",
    terms: "",
  };
  const { register, control, handleSubmit, setError, setValue, reset, formState } = useForm<NewOrderValues>({
    resolver: zodResolver(newOrderSchema),
    defaultValues,
  });
  const lineRows = useFieldArray({ control, name: "lines" });
  const { errors } = formState;

  const [supplierId, currency, lines] = useWatch({ control, name: ["supplierId", "currency", "lines"] });
  const supplier = options.suppliers.find((s) => s.id === supplierId);
  // Amounts are in the order's currency (the supplier's).
  const symbol = currencySymbol(currency);
  const inr = currency === "INR";
  const spaced = (value: number) => formatMoney(value, currency, { spaced: true, decimals: 2 });
  const unitOf = (itemId: string) => options.items.find((item) => item.id === itemId)?.unit ?? "";
  /** The chosen item's saved price fills the line's rate (still editable); an item without one clears it, so no stale rate stays. */
  const rateFor = (itemId: string) => {
    const price = options.items.find((item) => item.id === itemId)?.price ?? null;
    return price !== null && price > 0 ? String(price) : "";
  };
  const numericLines = lines.map((line) => ({ rate: parseNumber(line.rateCny), quantity: parseNumber(line.quantity) }));
  const total = orderTotal(numericLines);
  // ORD-2's signed balance in the order's currency (no account yet: 0); the order debits its value (a preview: the
  // API's figure is the one posted). A held supplier can't take an order (409 `account_held`).
  const balanceNow = supplier?.ledgerBalance?.find((b) => b.currency === currency)?.balanceCny ?? 0;
  const held = !!supplier?.held;

  async function place(order: NewOrderValues) {
    let created: CreateOrderResponse;
    try {
      created = await apiClient.post<CreateOrderResponse>("/orders", toCreateOrderBody(order));
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
    const ledger = created.ledger;
    notifySuccess(
      ledger
        ? `Order ${created.order.po} placed. Debited ${formatMoney(ledger.debitCny, ledger.currency, { decimals: 2 })}; supplier balance ${balanceText(ledger.balanceAfter, ledger.currency)}.`
        : `Order ${created.order.po} placed`,
    );
    router.push(orderHref(created.order.po));
    router.refresh();
  }

  const lineErrors = lineRows.fields.flatMap((_, i) => {
    const e = errors.lines?.[i];
    return messages(e?.itemId, e?.rateCny, e?.quantity).map((error) => ({ message: `Line ${i + 1}: ${error?.message}` }));
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
                <Field className={fieldClass} data-invalid={!!errors.po}>
                  <FieldLabel htmlFor="po-number" className={labelClass}>
                    Purchase order no.
                  </FieldLabel>
                  {/* The next number (ORD-2), which the user may change to any format; ORD-3 refuses one another order already uses. */}
                  <Input id="po-number" required maxLength={50} aria-invalid={!!errors.po} size="sm" {...register("po")} />
                  <FieldError errors={[errors.po]} />
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
                  <NativeSelect
                    size="sm"
                    id="supplier"
                    required
                    aria-invalid={!!errors.supplierId}
                    {...register("supplierId", {
                      // The order is in the supplier's currency (the API refuses another).
                      onChange: (event: { target: { value: string } }) => {
                        const chosen = options.suppliers.find((s) => s.id === event.target.value);
                        if (chosen) setValue("currency", chosen.currency);
                      },
                    })}
                  >
                    <option value="">Select supplier</option>
                    {options.suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </NativeSelect>
                  <FieldError errors={[errors.supplierId]} />
                </Field>
                <Field className={fieldClass} data-invalid={!!errors.currency}>
                  <FieldLabel htmlFor="currency" className={labelClass}>
                    Currency
                  </FieldLabel>
                  {/* The supplier's: shown, not chosen (the API refuses another). The hidden input keeps it in the form. */}
                  <Input id="currency" readOnly value={currencyLabel(currency)} size="sm" aria-describedby="currency-note" />
                  <input type="hidden" {...register("currency")} />
                  <FieldDescription id="currency-note" className="text-xs">
                    {!supplier
                      ? "The supplier's currency."
                      : inr
                        ? "INR is the base currency: no exchange rate."
                        : supplier.exchangeRate === null
                          ? "No exchange rate set for this supplier yet: set it under Suppliers."
                          : `Supplier rate now: ${rateText(currency, supplier.exchangeRate)}`}
                  </FieldDescription>
                  <FieldError errors={[errors.currency]} />
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
                <Field className={fieldClass} data-invalid={!!errors.terms}>
                  <FieldLabel htmlFor="container-terms" className={labelClass}>
                    Container terms <RequiredMark />
                  </FieldLabel>
                  {/* Chosen here, not on the Containers tab: a container loading this order takes these terms. */}
                  <NativeSelect size="sm" id="container-terms" required aria-invalid={!!errors.terms} aria-describedby="container-terms-note" {...register("terms")}>
                    <option value="">Select terms</option>
                    {CONTAINER_TERMS.map((terms) => (
                      <option key={terms}>{terms}</option>
                    ))}
                  </NativeSelect>
                  <FieldDescription id="container-terms-note" className="text-xs">
                    {TERMS_HELP}
                  </FieldDescription>
                  <FieldError errors={[errors.terms]} />
                </Field>
              </FieldGroup>
            </SectionCard>

            <SectionCard title="Items" titleGap="none">
              <Table className="mt-3 min-w-[600px] table-fixed">
                <TableHeader>
                  <TableRow className="bg-table-head hover:bg-table-head">
                    <TableHead className={headClass}>Item</TableHead>
                    <TableHead className={cn(headClass, "w-[107px]")}>Rate ({symbol})</TableHead>
                    <TableHead className={cn(headClass, "w-[158px]")}>Quantity</TableHead>
                    <TableHead className={cn(headClass, "w-[148px] text-right")}>Amount ({symbol})</TableHead>
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
                            {...register(`lines.${i}.itemId`, {
                              onChange: (event: React.ChangeEvent<HTMLSelectElement>) =>
                                setValue(`lines.${i}.rateCny`, rateFor(event.target.value), { shouldDirty: true, shouldValidate: formState.isSubmitted }),
                            })}
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
                            aria-label={`Rate (${symbol}), line ${n}`}
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
                            aria-label={`Amount (${symbol}), line ${n}`}
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
                  {formatMoney(total, currency, { decimals: 2, spaced: true })}
                </output>
              </div>
            </SectionCard>
          </div>

          <div className="flex min-w-0 flex-col gap-(--page-gap)">
            <SectionCard title="Deposit required" titleGap="none">
              {/* Optional (0009, D11): what the supplier asked for, in the order's currency. A milestone of the order, met once the supplier account has settled that much of it; never a payment. */}
              <Field className={cn(fieldClass, "mt-3")} data-invalid={!!errors.depositRequiredCny}>
                <FieldLabel htmlFor="deposit-required" className={labelClass}>
                  Deposit required ({symbol})
                </FieldLabel>
                <Input
                  id="deposit-required"
                  inputMode="decimal"
                  placeholder="None agreed"
                  aria-invalid={!!errors.depositRequiredCny}
                  aria-describedby="deposit-required-note"
                  size="sm"
                  className="text-right"
                  {...register("depositRequiredCny")}
                />
                <FieldDescription id="deposit-required-note" className="text-xs">
                  A milestone, not a payment. Record what the supplier was paid with Record payment.
                </FieldDescription>
                <FieldError errors={[errors.depositRequiredCny]} />
              </Field>
            </SectionCard>

            <SectionCard title="Summary" titleGap="none" bottomGap="form">
              {held ? (
                <Callout tone="warning" size="sm" role="alert" className="mt-2.5">
                  {HELD_MESSAGE} No order can be placed for it until the review is done.
                </Callout>
              ) : null}
              <KeyValueList
                density="compact"
                className="mt-2.5 border-b border-border-subtle"
                items={[
                  { label: "Order total", value: spaced(total) },
                  // No balances without payments View (ORD-2 sends ledgerBalance null): only the total.
                  ...(supplier && !held && supplier.ledgerBalance
                    ? [
                        { label: "Supplier balance now", value: balanceText(balanceNow, currency) },
                        {
                          label: <span className="text-base leading-5 font-bold">Supplier balance after this order</span>,
                          value: <span className="text-base leading-5 font-bold">{balanceText(round2(balanceNow - total), currency)}</span>,
                        },
                      ]
                    : []),
                ]}
              />
              <FormFooter className="mt-3.5 gap-3">
                {/* Disabled while the request runs (no spinner is designed), so one click places one order. */}
                <Button type="submit" size="lg" className="min-w-0 flex-1 text-[15px]" disabled={formState.isSubmitting || held}>
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
