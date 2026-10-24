"use client";

import Link from "next/link";
import { useState } from "react";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/shared/cards";
import { FormFooter, NativeSelect, RequiredMark } from "@/components/shared/form";
import { KeyValueList } from "@/components/shared/key-value-list";
import { notInPrototype } from "@/components/shared/prototype";
import { StatusPill } from "@/components/shared/status-pill";
import { Timeline } from "@/components/shared/timeline";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatCNY, formatDate, formatNumber, formatQty } from "@/lib/formatters";
import { cn } from "@/lib/utils";

import type { RecordReceiptData } from "./data/queries";
import { lineShort, paymentEffect } from "./receiving-logic";

// Measured from 21_7_Receiving_(China)_-_Stage_2_form.jpeg: 12.5 px bold labels 5 px above the field, 12 px table
// headers. Cards use titleGap="none" and place their content where the reference has it.
const fieldClass = "gap-[5px]";
const labelClass = "gap-0.5 text-[12.5px] leading-[15px] font-bold text-label";
const headClass = "h-[30px] px-1.5 text-[12px] font-bold text-table-head-foreground";
const cellClass = "px-1.5 py-0";
const spacedCNY = (value: number) => formatCNY(value, { spaced: true });

/** Record receipt, Stage 2 (21_7_Receiving_(China)_-_Stage_2_form.jpeg), prefilled for PO-2035. */
export function RecordReceiptScreen({ data }: { data: RecordReceiptData }) {
  // Mock mutation: client state only, resets on reload
  const [receivedNow, setReceivedNow] = useState(() => data.lines.map((line) => String(line.receivedNow)));
  const lines = data.lines.map((line, i) => ({ ...line, receivedNow: Number(receivedNow[i]) || 0 }));
  const effect = paymentEffect(data.payment, lines);

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
          <form
            className="flex min-w-0 flex-col gap-(--page-gap)"
            onSubmit={(event) => {
              event.preventDefault();
              notInPrototype("Save receipt");
            }}
          >
            <SectionCard aria-label="Receipt details">
              <div className="flex min-h-[42px] flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-[10px] bg-callout-info px-3.5 py-1.5">
                <p className="flex flex-wrap items-center gap-x-2 text-sm">
                  <span className="text-[15px] font-bold">{data.po}</span>
                  <span aria-hidden>·</span>
                  <span>{data.item}</span>
                  <span aria-hidden>·</span>
                  <span>{data.supplier}</span>
                </p>
                <StatusPill tone={data.status.tone}>{data.status.label}</StatusPill>
              </div>

              <FieldGroup className="mt-[15px] grid gap-x-4 gap-y-[14px] sm:grid-cols-3">
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="received-on" className={labelClass}>
                    Received on <RequiredMark />
                  </FieldLabel>
                  <Input id="received-on" required defaultValue={formatDate(data.receivedOn)} />
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="received-office" className={labelClass}>
                    Received at office <RequiredMark />
                  </FieldLabel>
                  <NativeSelect id="received-office" required defaultValue={data.office}>
                    {data.offices.map((office) => (
                      <option key={office}>{office}</option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="received-by" className={labelClass}>
                    Received by <RequiredMark />
                  </FieldLabel>
                  <Input id="received-by" required defaultValue={data.receivedBy} />
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="bundles-now" className={labelClass}>
                    Bundles received now <RequiredMark />
                  </FieldLabel>
                  <Input id="bundles-now" required inputMode="numeric" defaultValue={String(data.bundles)} />
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="delivery-note" className={labelClass}>
                    Supplier delivery note no.
                  </FieldLabel>
                  <Input id="delivery-note" defaultValue={data.deliveryNote} />
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="goods-photo" className={labelClass}>
                    Photo of goods
                  </FieldLabel>
                  <button
                    id="goods-photo"
                    type="button"
                    onClick={() => notInPrototype("Attach photo")}
                    className="flex h-[42px] w-full items-center rounded-lg border border-input bg-input-background px-3.5 text-[15px] text-placeholder outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/25"
                  >
                    Attach photo
                  </button>
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
                    return (
                      <TableRow key={line.item} className="h-[60px] border-border-subtle hover:bg-transparent">
                        <TableCell className={cn(cellClass, "font-bold")}>{line.item}</TableCell>
                        <TableCell className={cn(cellClass, "text-right")}>{formatQty(line.ordered, line.unit)}</TableCell>
                        <TableCell className={cn(cellClass, "text-right")}>{formatQty(line.receivedEarlier, line.unit)}</TableCell>
                        {/* The reference sets the input 8 px from the row top, above the text line. */}
                        <TableCell className={cn(cellClass, "pt-2 text-right align-top")}>
                          <Input
                            aria-label={`Received now, ${line.item}`}
                            inputMode="numeric"
                            value={receivedNow[i]}
                            onChange={(event) => {
                              const value = event.target.value.replace(/\D/g, "");
                              setReceivedNow((current) => current.map((v, j) => (j === i ? value : v)));
                            }}
                            className="h-[38px] w-[130px] pr-3 text-right text-sm font-bold text-label"
                          />
                        </TableCell>
                        <TableCell className={cn(cellClass, "text-right", short > 0 && "font-bold text-danger")}>
                          {short > 0 ? formatQty(short, line.unit) : formatNumber(short)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <Field className={cn(fieldClass, "mt-[14px]")}>
                <FieldLabel htmlFor="short-remark" className={labelClass}>
                  Short remark <RequiredMark />
                </FieldLabel>
                <Textarea id="short-remark" required defaultValue={data.shortRemark} className="min-h-[74px] resize-none" />
              </Field>

              <FormFooter className="mt-4 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-[150px] min-w-0 text-[15px]"
                  onClick={() => notInPrototype("Save draft")}
                >
                  Save draft
                </Button>
                <Button type="submit" size="lg" className="w-[190px] min-w-0 text-[15px]">
                  Save receipt
                </Button>
              </FormFooter>
            </SectionCard>
          </form>

          <div className="flex flex-col gap-(--page-gap)">
            <SectionCard title="Effect on payment" titleGap="none">
              <KeyValueList size="sm"
                className="mt-[10px]"
                items={[
                  { label: "Order value", value: spacedCNY(data.payment.orderValue) },
                  { label: "Deposits paid", value: spacedCNY(data.payment.depositsPaid) },
                  { label: "Balance before this receipt", value: spacedCNY(effect.balanceBefore) },
                  ...effect.deductions.map((d) => ({
                    label: `Short: ${formatQty(d.short, d.unit)} × ${formatCNY(d.unitPrice)}`,
                    value: <span className="font-bold text-danger">− {spacedCNY(d.amount)}</span>,
                  })),
                ]}
                total={{ label: "Balance to pay now", value: spacedCNY(effect.balanceNow) }}
              />
            </SectionCard>
            <SectionCard title={`Deliveries for ${data.po}`} titleGap="none">
              <Timeline size="sm"
                className="mt-2.5"
                items={data.deliveries.map((event) => ({
                  title: event.title,
                  marker: event.marker,
                  detail: event.lines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  )),
                }))}
              />
            </SectionCard>
          </div>
        </div>
      </PageContainer>
    </>
  );
}
