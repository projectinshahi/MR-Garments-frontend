"use client";

import Link from "next/link";
import { useState } from "react";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Callout, CardNote, SectionCard } from "@/components/shared/cards";
import { FormFooter, NativeSelect, RequiredMark } from "@/components/shared/form";
import { Timeline } from "@/components/shared/timeline";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber, formatQty } from "@/lib/formatters";
import { cn } from "@/lib/utils";

import { CHARGES, CLEARING_FIELDS, clearingSteps, clearingTotal, clearingValues, toClearingBody, type ClearingValues } from "./clearing-logic";
import type { ClearingFormData } from "./data/queries";
import { amountOf, cleanAmount, formatExactINR, showAmount, useStageSave } from "./stage-form";

// Measured from 25_9_Clearing_(India)_-_Stage_4_form.jpeg: 12.5 px bold labels 5 px above 14 px fields, 16 px between
// the cards, 12 px table headers. Cards use titleGap="none" and place their content where the reference has it.
const fieldClass = "gap-[5px]";
const labelClass = "gap-0.5 text-[12.5px] leading-[15px] font-bold text-label";
const headClass = "h-[30px] px-1.5 text-[12px] font-bold text-table-head-foreground";
const cellClass = "h-[33px] px-1.5 py-0 text-sm";

/** Proposed wording: no SUCCESS message fits a clearing yet. */
const SAVED = { draft: "Clearing draft saved", complete: "Container cleared and handed to transport" };

/** One duty line: label (with an optional muted sub-label) and a right-aligned amount in INR. */
function AmountRow({
  id,
  label,
  sub,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  sub?: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex min-h-[50px] items-center justify-between gap-4 border-b border-border-subtle px-1.5 last:border-b-0">
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
      <div className="mb-[5px] flex w-[188px] flex-col">
        <Input
          id={id}
          aria-describedby={sub ? `${id}-sub` : undefined}
          aria-invalid={!!error}
          inputMode="decimal"
          value={showAmount(value)}
          onChange={(event) => onChange(cleanAmount(event.target.value))}
          className="h-[34px] px-2.5 text-right text-sm font-bold text-label"
        />
        <FieldError className="text-right">{error}</FieldError>
      </div>
    </div>
  );
}

/**
 * Clearing (India), Stage 4 form (25_9_Clearing_(India)_-_Stage_4_form.jpeg), for one container: CLR-2, saved with
 * CLR-3. Read-only once cleared, before the container arrives, and for users without clearing Enter.
 */
export function ClearingFormScreen({ data }: { data: ClearingFormData }) {
  const { form, today, canEnter } = data;
  const { container, clearing } = form;
  const [values, setValues] = useState(() => clearingValues(form, today));
  const { errors, saving, save } = useStageSave(`/clearings/${container.id}`, CLEARING_FIELDS, SAVED, "/clearing");
  const set = (key: keyof ClearingValues) => (value: string) => setValues((current) => ({ ...current, [key]: value }));
  const bind = (key: keyof ClearingValues) => ({
    value: values[key],
    "aria-invalid": !!errors[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => set(key)(event.target.value),
  });
  const agent = form.agents.find((a) => a.id === values.clearingAgentId);
  const total = clearingTotal(CHARGES.map(({ key }) => ({ amount: amountOf(values[key]) })));
  const closed = clearing?.status === "cleared";
  const notice = container.status !== "arrived" ? "This container hasn't arrived at the port yet." : closed ? "This record is complete and can't be changed." : null;
  const readOnly = !canEnter || !!notice;
  const dateField = (id: string, key: keyof ClearingValues, label: string, required = false) => (
    <Field className={fieldClass} data-invalid={!!errors[key]}>
      <FieldLabel htmlFor={id} className={labelClass}>
        {label} {required ? <RequiredMark /> : null}
      </FieldLabel>
      <Input id={id} type="date" max={today} required={required} size="sm" className={cn(!values[key] && "border-dashed")} {...bind(key)} />
      <FieldError>{errors[key]}</FieldError>
    </Field>
  );

  return (
    <>
      <PageHeader
        title={`Container ${container.number}`}
        parent={{ label: "Clearing (India)", href: "/clearing" }}
        actions={
          <Button asChild variant="outline">
            <Link href="/clearing">Cancel</Link>
          </Button>
        }
      />
      <PageContainer>
        <div className="grid items-start gap-x-(--page-gap) gap-y-4 lg:grid-cols-[minmax(0,1fr)_400px]">
          <form
            noValidate
            className="flex min-w-0 flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save(toClearingBody(values), true);
            }}
          >
            {/* A disabled fieldset makes every field read-only at once. */}
            <fieldset disabled={readOnly} className="contents">
              <SectionCard title="Clearing details" titleGap="none" bottomGap="form">
                <FieldGroup className="mt-3 grid gap-x-4 gap-y-[14px] sm:grid-cols-3">
                  <Field className={fieldClass}>
                    <FieldLabel htmlFor="container-number" className={labelClass}>
                      Container number
                    </FieldLabel>
                    <Input id="container-number" readOnly value={container.number} size="sm" />
                  </Field>
                  {dateField("arrived-at-port", "arrivedOn", "Arrived at port", true)}
                  <Field className={fieldClass} data-invalid={!!errors.clearingAgentId}>
                    <FieldLabel htmlFor="clearing-agent" className={labelClass}>
                      Clearing agent <RequiredMark />
                    </FieldLabel>
                    <NativeSelect size="sm" id="clearing-agent" required {...bind("clearingAgentId")}>
                      {form.agents.length ? null : <option value="" />}
                      {form.agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </NativeSelect>
                    <FieldError>{errors.clearingAgentId}</FieldError>
                  </Field>
                  {dateField("handed-to-agent", "handedOn", "Handed to agent on")}
                  {/* From the clearing agent master: change them in Settings. */}
                  <Field className={fieldClass}>
                    <FieldLabel htmlFor="agent-contact" className={labelClass}>
                      Agent contact person
                    </FieldLabel>
                    <Input id="agent-contact" readOnly value={agent?.contactPerson ?? ""} size="sm" />
                  </Field>
                  <Field className={fieldClass}>
                    <FieldLabel htmlFor="agent-phone" className={labelClass}>
                      Agent phone
                    </FieldLabel>
                    <Input id="agent-phone" type="tel" readOnly value={agent?.phone ?? ""} size="sm" />
                  </Field>
                  <Field className={fieldClass} data-invalid={!!errors.billOfEntry}>
                    <FieldLabel htmlFor="bill-of-entry" className={labelClass}>
                      Bill of entry no.
                    </FieldLabel>
                    <Input id="bill-of-entry" autoComplete="off" size="sm" {...bind("billOfEntry")} />
                    <FieldError>{errors.billOfEntry}</FieldError>
                  </Field>
                  {dateField("duty-paid-on", "dutyPaidOn", "Duty paid on")}
                  {dateField("cleared-on", "clearedOn", "Cleared on")}
                </FieldGroup>
              </SectionCard>

              <SectionCard
                title="Duty calculation from the agent"
                aside={<CardNote size="sm">Amounts in INR</CardNote>}
                titleGap="none"
                className="pb-[18px]"
              >
                <div className="mt-3">
                  <AmountRow
                    id="goods-value"
                    label="Value of goods for duty"
                    sub="As shown in the agent's papers"
                    value={values.goodsValueInr}
                    error={errors.goodsValueInr}
                    onChange={set("goodsValueInr")}
                  />
                  {CHARGES.map((charge) => (
                    <AmountRow key={charge.id} id={charge.id} label={charge.label} value={values[charge.key]} error={errors[charge.key]} onChange={set(charge.key)} />
                  ))}
                </div>
                <div className="mt-[5px] flex h-[49px] items-center justify-between gap-4 border-t-2 border-navy px-2">
                  <p className="flex flex-wrap items-baseline gap-x-[7px]">
                    <span className="text-base font-bold">Total clearing cost</span>
                    <span className="text-[12.5px] text-muted-foreground">(duty, taxes and charges)</span>
                  </p>
                  <output htmlFor={CHARGES.map((charge) => charge.id).join(" ")} className="text-[19.5px] font-bold">
                    {formatExactINR(total)}
                  </output>
                </div>
                {readOnly ? (
                  notice ? <p className="mt-1 text-right text-sm leading-5 text-muted-foreground">{notice}</p> : null
                ) : (
                  <FormFooter className="mt-1 gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="w-[149px] min-w-0 border-input text-[15px] text-label"
                      disabled={saving}
                      onClick={() => void save(toClearingBody(values), false)}
                    >
                      Save draft
                    </Button>
                    <Button type="submit" size="lg" className="w-[300px] min-w-0 text-[15px]" disabled={saving}>
                      Mark cleared, hand to transport
                    </Button>
                  </FormFooter>
                )}
              </SectionCard>
            </fieldset>
          </form>

          <div className="flex flex-col gap-4">
            <SectionCard title="Clearing progress" titleGap="none" className="pb-4">
              <Timeline size="xs" className="mt-[11px]" items={clearingSteps(form)} />
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
                  {form.goods.map((line) => (
                    <TableRow key={line.orderLineId} className="hover:bg-transparent">
                      <TableCell className={cn(cellClass, "font-bold")}>{line.po}</TableCell>
                      <TableCell className={cellClass}>{line.item}</TableCell>
                      <TableCell className={cn(cellClass, "text-right")}>{formatNumber(line.bundles)}</TableCell>
                      <TableCell className={cn(cellClass, "text-right")}>{formatQty(line.quantity, line.unit)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-[7px] text-[13px] leading-[18px] text-muted-foreground">
                Terms: {container.terms} · {form.suppliers.length > 1 ? "Suppliers" : "Supplier"}: {form.suppliers.join(", ") || "–"}
              </p>
            </SectionCard>

            {/* A bordered info panel: 13.5 px label, 32 px total, 13 px note. */}
            <Callout size="sm" className="rounded-xl border border-info/15 px-5 pt-[15px] pb-[18px]">
              <p>Adds to landed cost</p>
              <p className="mt-[3px] text-[32px] leading-[38px] font-bold text-foreground">{formatExactINR(total)}</p>
              <p className="mt-[5px] text-[13px] leading-[19.5px]">Staff enter these figures from the agent&apos;s papers. The agent does not log in.</p>
            </Callout>
          </div>
        </div>
      </PageContainer>
    </>
  );
}
