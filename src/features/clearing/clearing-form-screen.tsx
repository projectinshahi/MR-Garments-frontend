"use client";

import Link from "next/link";
import { useState } from "react";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Callout, CardNote, SectionCard } from "@/components/shared/cards";
import { FormFooter, NativeSelect, RequiredMark } from "@/components/shared/form";
import { notInPrototype } from "@/components/shared/prototype";
import { Timeline } from "@/components/shared/timeline";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatINR, formatNumber, formatQty } from "@/lib/formatters";
import { cn } from "@/lib/utils";

import { clearingTotal } from "./clearing-logic";
import type { ClearingFormData } from "./data/queries";

// Measured from 25_9_Clearing_(India)_-_Stage_4_form.jpeg: 12.5 px bold labels 5 px above 14 px fields, 16 px between
// the cards, 12 px table headers. Cards use titleGap="none" and place their content where the reference has it.
const fieldClass = "gap-[5px]";
const labelClass = "gap-0.5 text-[12.5px] leading-[15px] font-bold text-label";
const inputClass = "px-3 text-sm";
const headClass = "h-[30px] px-1.5 text-[12px] font-bold text-table-head-foreground";
const cellClass = "h-[33px] px-1.5 py-0 text-sm";

const digits = (value: string) => value.replace(/\D/g, "");

/** One duty line: label (with an optional muted sub-label) and a right-aligned amount in INR. */
function AmountRow({ id, label, sub, value, onChange }: { id: string; label: string; sub?: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex h-[50px] items-center justify-between gap-4 border-b border-border-subtle px-1.5 last:border-b-0">
      <div className="flex flex-col">
        <label htmlFor={id} className="text-sm leading-4">
          {label}
        </label>
        {sub ? (
          <span id={`${id}-sub`} className="text-[12.5px] leading-4 text-muted-foreground">
            {sub}
          </span>
        ) : null}
      </div>
      {/* The reference sets the field 2.5 px above the row's center. */}
      <Input
        id={id}
        aria-describedby={sub ? `${id}-sub` : undefined}
        inputMode="numeric"
        value={value ? formatNumber(Number(value)) : ""}
        onChange={(event) => onChange(digits(event.target.value))}
        className="mb-[5px] h-[34px] w-[188px] px-2.5 text-right text-sm font-bold text-label"
      />
    </div>
  );
}

/** Clearing (India), Stage 4 form (25_9_Clearing_(India)_-_Stage_4_form.jpeg), for one container. */
export function ClearingFormScreen({ data }: { data: ClearingFormData }) {
  // Mock mutation: client state only, resets on reload
  const [goodsValue, setGoodsValue] = useState(String(data.goodsValue));
  const [amounts, setAmounts] = useState(() => data.charges.map((charge) => String(charge.amount)));
  const total = clearingTotal(amounts.map((amount) => ({ amount: Number(amount) || 0 })));

  return (
    <>
      <PageHeader
        title={`Container ${data.container}`}
        parent={{ label: "Clearing (India)", href: "/clearing" }}
        actions={
          <Button asChild variant="outline" className="text-label">
            <Link href="/clearing">Cancel</Link>
          </Button>
        }
      />
      <PageContainer>
        <div className="grid items-start gap-x-(--page-gap) gap-y-4 lg:grid-cols-[minmax(0,1fr)_400px]">
          <form
            className="flex min-w-0 flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              notInPrototype("Mark cleared, hand to transport");
            }}
          >
            <SectionCard title="Clearing details" titleGap="none" className="pb-[18px]">
              <FieldGroup className="mt-3 grid gap-x-4 gap-y-[14px] sm:grid-cols-3">
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="container-number" className={labelClass}>
                    Container number
                  </FieldLabel>
                  <Input id="container-number" defaultValue={data.container} className={inputClass} />
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="arrived-at-port" className={labelClass}>
                    Arrived at port
                  </FieldLabel>
                  <Input id="arrived-at-port" defaultValue={formatDate(data.arrivedAtPort)} className={inputClass} />
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="clearing-agent" className={labelClass}>
                    Clearing agent <RequiredMark />
                  </FieldLabel>
                  <NativeSelect id="clearing-agent" required defaultValue={data.agent}>
                    {data.agents.map((agent) => (
                      <option key={agent}>{agent}</option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="handed-to-agent" className={labelClass}>
                    Handed to agent on
                  </FieldLabel>
                  <Input id="handed-to-agent" defaultValue={formatDate(data.handedToAgentOn)} className={inputClass} />
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="agent-contact" className={labelClass}>
                    Agent contact person
                  </FieldLabel>
                  <Input id="agent-contact" defaultValue={data.contactPerson} className={inputClass} />
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="agent-phone" className={labelClass}>
                    Agent phone
                  </FieldLabel>
                  <Input id="agent-phone" type="tel" defaultValue={data.phone} className={inputClass} />
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="bill-of-entry" className={labelClass}>
                    Bill of entry no.
                  </FieldLabel>
                  <Input id="bill-of-entry" defaultValue={data.billOfEntry} className={inputClass} />
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="duty-paid-on" className={labelClass}>
                    Duty paid on
                  </FieldLabel>
                  <Input
                    id="duty-paid-on"
                    placeholder="Select date"
                    defaultValue={data.dutyPaidOn ? formatDate(data.dutyPaidOn) : ""}
                    className={cn(inputClass, !data.dutyPaidOn && "border-dashed")}
                  />
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="cleared-on" className={labelClass}>
                    Cleared on
                  </FieldLabel>
                  <Input
                    id="cleared-on"
                    placeholder="Select date"
                    defaultValue={data.clearedOn ? formatDate(data.clearedOn) : ""}
                    className={cn(inputClass, !data.clearedOn && "border-dashed")}
                  />
                </Field>
              </FieldGroup>
            </SectionCard>

            <SectionCard
              title="Duty calculation from the agent"
              aside={<CardNote className="text-[13px]">Amounts in INR</CardNote>}
              titleGap="none"
              className="pb-[18px]"
            >
              <div className="mt-3">
                <AmountRow id="goods-value" label="Value of goods for duty" sub="As shown in the agent's papers" value={goodsValue} onChange={setGoodsValue} />
                {data.charges.map((charge, i) => (
                  <AmountRow
                    key={charge.id}
                    id={charge.id}
                    label={charge.label}
                    value={amounts[i]}
                    onChange={(value) => setAmounts((current) => current.map((v, j) => (j === i ? value : v)))}
                  />
                ))}
              </div>
              <div className="mt-[5px] flex h-[49px] items-center justify-between gap-4 border-t-2 border-navy px-2">
                <p className="flex flex-wrap items-baseline gap-x-[7px]">
                  <span className="text-base font-bold">Total clearing cost</span>
                  <span className="text-[12.5px] text-muted-foreground">(duty, taxes and charges)</span>
                </p>
                <output htmlFor={data.charges.map((charge) => charge.id).join(" ")} className="text-[19.5px] font-bold">
                  {formatINR(total)}
                </output>
              </div>
              <FormFooter className="mt-1 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-[149px] min-w-0 border-input text-[15px] text-label"
                  onClick={() => notInPrototype("Save draft")}
                >
                  Save draft
                </Button>
                <Button type="submit" size="lg" className="w-[300px] min-w-0 text-[15px]">
                  Mark cleared, hand to transport
                </Button>
              </FormFooter>
            </SectionCard>
          </form>

          <div className="flex flex-col gap-4">
            <SectionCard title="Clearing progress" titleGap="none" className="pb-4">
              <Timeline
                size="sm"
                className="mt-[11px]"
                items={data.progress.map((step) => ({
                  title: step.title,
                  marker: step.marker,
                  number: step.number,
                  detail: step.detail ? <span className="block leading-[15px]">{step.detail}</span> : undefined,
                }))}
              />
            </SectionCard>

            <SectionCard title="Goods in this container" titleGap="none" className="pb-4">
              <Table className="mt-3">
                <TableHeader>
                  <TableRow className="bg-table-head hover:bg-table-head">
                    <TableHead className={cn(headClass, "w-[84px]")}>PO</TableHead>
                    <TableHead className={headClass}>Item</TableHead>
                    <TableHead className={cn(headClass, "w-[90px] text-right")}>Bundles</TableHead>
                    <TableHead className={cn(headClass, "w-[90px] text-right")}>Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.goods.map((line) => (
                    <TableRow key={line.po} className="hover:bg-transparent">
                      <TableCell className={cn(cellClass, "font-bold")}>{line.po}</TableCell>
                      <TableCell className={cellClass}>{line.item}</TableCell>
                      <TableCell className={cn(cellClass, "text-right")}>{formatNumber(line.bundles)}</TableCell>
                      <TableCell className={cn(cellClass, "text-right")}>{formatQty(line.quantity, line.unit)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-[7px] text-[13px] leading-[18px] text-muted-foreground">
                Terms: {data.terms} · Supplier: {data.supplier}
              </p>
            </SectionCard>

            {/* A bordered info panel: 13.5 px label, 32 px total, 13 px note. */}
            <Callout size="sm" className="rounded-xl border border-info/15 px-5 pt-[15px] pb-[18px]">
              <p>Adds to landed cost</p>
              <p className="mt-[3px] text-[32px] leading-[38px] font-bold text-foreground">{formatINR(total)}</p>
              <p className="mt-[5px] text-[13px] leading-[19.5px]">Staff enter these figures from the agent&apos;s papers. The agent does not log in.</p>
            </Callout>
          </div>
        </div>
      </PageContainer>
    </>
  );
}
