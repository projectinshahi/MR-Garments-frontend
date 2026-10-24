"use client";

import Link from "next/link";
import { useState } from "react";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/shared/cards";
import { FormFooter, NativeSelect, RequiredMark } from "@/components/shared/form";
import { KeyValueList } from "@/components/shared/key-value-list";
import { notInPrototype } from "@/components/shared/prototype";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCNY, formatDate, formatINR, formatNumber, formatRate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

import type { Deposit, NewOrderData } from "./data/queries";
import { depositINR, lineAmount, orderTotals, parseNumber } from "./order-totals";

// Measured from 15_4_New_order.jpeg: 12.5 px bold labels 5 px above 42 px fields with 14 px text, 12 px table
// headers, 38 px item inputs with 10 px padding. Cards use titleGap="none" and place content where the reference has it.
const fieldClass = "gap-[5px]";
const labelClass = "gap-0.5 text-[12.5px] leading-[15px] font-bold text-label";
const fieldInput = "px-3 text-sm";
const headClass = "h-[30px] px-1.5 text-[12px] font-bold text-table-head-foreground";
const cellClass = "px-1.5 py-2";
const lineInput = "h-[38px] px-2.5 text-sm";
// "+ Add item" / "+ Add deposit": 13.5 px bold text links on a 10 px line, flush with the card edge.
// Block-level (flex w-fit) so the card's line-height strut does not add height under them.
const addLinkClass = "mt-[13px] flex h-auto w-fit border-0 p-0 text-[13.5px] leading-[10px]";
const spacedCNY = (value: number) => formatCNY(value, { spaced: true });

type LineDraft = { item: string; rate: string; quantity: string; unit: string };

/** New order, Stage 1: order and deposit (15_4_New_order.jpeg), prefilled for PO-2050. */
export function NewOrderScreen({ data }: { data: NewOrderData }) {
  // Mock mutation: client state only, resets on reload
  const [lines, setLines] = useState<LineDraft[]>(() =>
    data.lines.map((line) => ({ item: line.item, rate: formatRate(line.rate), quantity: formatNumber(line.quantity), unit: line.unit })),
  );
  const numeric = lines.map((line) => ({ rate: parseNumber(line.rate), quantity: parseNumber(line.quantity) }));
  const totals = orderTotals(numeric, data.deposits);

  const setLine = (index: number, patch: Partial<LineDraft>) =>
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  return (
    <>
      <PageHeader
        title="New order"
        parent={{ label: "Orders", href: "/orders" }}
        actions={
          <Button asChild variant="outline" className="text-label">
            <Link href="/orders">Cancel</Link>
          </Button>
        }
      />
      <PageContainer>
        <form
          className="grid items-start gap-(--page-gap) lg:grid-cols-[minmax(0,1fr)_410px]"
          onSubmit={(event) => {
            event.preventDefault();
            notInPrototype("Place order");
          }}
        >
          <div className="flex min-w-0 flex-col gap-(--page-gap)">
            <SectionCard title="Order details" titleGap="none">
              <FieldGroup className="mt-[11px] grid gap-x-4 gap-y-[14px] sm:grid-cols-3">
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="po-number" className={labelClass}>
                    Purchase order no.
                  </FieldLabel>
                  <Input id="po-number" defaultValue={data.po} className={fieldInput} />
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="order-date" className={labelClass}>
                    Order date
                  </FieldLabel>
                  <Input id="order-date" defaultValue={formatDate(data.orderDate)} className={fieldInput} />
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="delivery-date" className={labelClass}>
                    Delivery date <RequiredMark />
                  </FieldLabel>
                  <Input id="delivery-date" required defaultValue={formatDate(data.deliveryDate)} className={fieldInput} />
                </Field>
                <Field className={cn(fieldClass, "sm:col-span-2")}>
                  <FieldLabel htmlFor="supplier" className={labelClass}>
                    Supplier <RequiredMark />
                  </FieldLabel>
                  <NativeSelect id="supplier" required defaultValue={data.supplier}>
                    {data.suppliers.map((supplier) => (
                      <option key={supplier}>{supplier}</option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="currency" className={labelClass}>
                    Currency
                  </FieldLabel>
                  <NativeSelect id="currency" defaultValue={data.currency}>
                    <option>{data.currency}</option>
                  </NativeSelect>
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="contact-person" className={labelClass}>
                    Contact person
                  </FieldLabel>
                  <Input id="contact-person" defaultValue={data.contactPerson} className={fieldInput} />
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="phone" className={labelClass}>
                    Phone
                  </FieldLabel>
                  <Input id="phone" type="tel" defaultValue={data.phone} className={fieldInput} />
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="city" className={labelClass}>
                    City
                  </FieldLabel>
                  <Input id="city" defaultValue={data.city} className={fieldInput} />
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
                  {lines.map((line, i) => {
                    const n = i + 1;
                    const filled = line.rate !== "" && line.quantity !== "";
                    return (
                      <TableRow key={i} className="border-border-subtle hover:bg-transparent">
                        <TableCell className={cellClass}>
                          <Input
                            aria-label={`Item, line ${n}`}
                            value={line.item}
                            onChange={(event) => setLine(i, { item: event.target.value })}
                            className={lineInput}
                          />
                        </TableCell>
                        <TableCell className={cellClass}>
                          <Input
                            aria-label={`Rate (¥), line ${n}`}
                            inputMode="decimal"
                            value={line.rate}
                            onChange={(event) => setLine(i, { rate: event.target.value })}
                            className={cn(lineInput, "text-right")}
                          />
                        </TableCell>
                        <TableCell className={cellClass}>
                          {/* The unit sits inside the quantity box ("2,400 m"), as in the reference. */}
                          <div className="flex h-[38px] items-center rounded-lg border border-input bg-input-background px-2.5 text-sm transition-colors focus-within:border-primary focus-within:ring-3 focus-within:ring-ring/25">
                            <input
                              aria-label={`Quantity, line ${n}`}
                              inputMode="decimal"
                              value={line.quantity}
                              onChange={(event) => setLine(i, { quantity: event.target.value })}
                              className="h-full w-full min-w-0 bg-transparent text-right text-foreground outline-none"
                            />
                            {line.unit ? <span className="pl-1">{line.unit}</span> : null}
                          </div>
                        </TableCell>
                        <TableCell className={cellClass}>
                          <Input
                            aria-label={`Amount (¥), line ${n}`}
                            readOnly
                            value={filled ? formatNumber(lineAmount(numeric[i]), 2) : ""}
                            className={cn(lineInput, "text-right read-only:bg-input-background")}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <Button
                type="button"
                variant="link"
                className={addLinkClass}
                onClick={() => setLines((current) => [...current, { item: "", rate: "", quantity: "", unit: "" }])}
              >
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
              <div className="mt-3 flex flex-col gap-2.5">
                {data.deposits.map((deposit) => (
                  <DepositCard key={deposit.payee} deposit={deposit} />
                ))}
              </div>
              <Button
                type="button"
                variant="link"
                className={addLinkClass}
                onClick={() => notInPrototype("Add deposit")}
              >
                + Add deposit
              </Button>
            </SectionCard>

            <SectionCard title="Summary" titleGap="none">
              <KeyValueList
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
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="min-w-0 flex-1 border-input text-[15px] text-label"
                  onClick={() => notInPrototype("Save draft")}
                >
                  Save draft
                </Button>
                <Button type="submit" size="lg" className="min-w-0 flex-1 text-[15px]">
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

function DepositCard({ deposit }: { deposit: Deposit }) {
  const facts = [
    { label: "Paid on", value: formatDate(deposit.paidOn) },
    { label: "Rate to INR", value: formatRate(deposit.rate) },
    { label: "Mode", value: deposit.mode },
  ];
  return (
    <article className="rounded-[10px] border bg-input-background px-3.5 pt-2.5 pb-[11px]">
      <div className="flex items-baseline justify-between gap-4 text-sm leading-5 font-bold">
        <h3>
          {deposit.payee} ({deposit.payeeRole})
        </h3>
        <p>{spacedCNY(deposit.amount)}</p>
      </div>
      <dl className="mt-[5px] grid grid-cols-3 gap-x-2">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="text-[12.5px] leading-[17px] text-muted-foreground">{fact.label}</dt>
            <dd className="text-sm leading-[18px] font-bold">{fact.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-2 flex items-center justify-between gap-4 border-t border-dashed pt-[7px]">
        <span className="text-[13px] leading-5 text-muted-foreground">Amount in INR</span>
        <span className="text-[15px] leading-5 font-bold">{formatINR(depositINR(deposit))}</span>
      </div>
    </article>
  );
}
