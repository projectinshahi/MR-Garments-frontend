"use client";

import Link from "next/link";
import { useState } from "react";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Callout, CardNote, SectionCard } from "@/components/shared/cards";
import { FormFooter, NativeSelect, RequiredMark } from "@/components/shared/form";
import { KeyValueList } from "@/components/shared/key-value-list";
import { StatusPill } from "@/components/shared/status-pill";
import { Timeline } from "@/components/shared/timeline";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { amountOf, cleanAmount, formatExactINR, showAmount, useStageSave } from "@/features/clearing/stage-form";
import { formatNumber, formatQty } from "@/lib/formatters";
import { cn } from "@/lib/utils";

import type { TransportFormData } from "./data/queries";
import { isShort, toTripBody, TRIP_FIELDS, transportSteps, tripValues, type TripValues } from "./transport-logic";

// Measured from 27_10_Transport_-_Stage_5_form.jpeg: 12.5 px bold labels on a 16 px line, 5 px above the field;
// 14 px field text 12 px from the edge; cards end 18 px under their last control; slate outline-button labels.
const fieldClass = "gap-[5px]";
const labelClass = "gap-0.5 text-[12.5px] leading-4 font-bold text-label";
const headClass = "h-[30px] px-1.5 text-[12px] font-bold text-table-head-foreground";
const cellClass = "px-1.5 py-0";

/** Proposed wording: no SUCCESS message fits a trip yet. */
const SAVED = { draft: "Transport draft saved", complete: "Trip marked as unloaded" };

type Bind = { value: string; "aria-invalid": boolean; onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void };

/**
 * Transport form, Stage 5 (27_10_Transport_-_Stage_5_form.jpeg): one container's vehicle, loading and unloading,
 * from TRN-2 and saved with TRN-3. The destination is picked in "Delivering to" and the charges in their card (the
 * reference draws them as text). Read-only once unloaded, before clearing, and for users without transport Enter.
 */
export function TransportFormScreen({ data }: { data: TransportFormData }) {
  const { form, today, canEnter } = data;
  const { container, clearing, trip } = form;
  const [values, setValues] = useState(() => tripValues(form, today));
  const { errors, saving, save } = useStageSave(`/transports/${container.id}`, TRIP_FIELDS, SAVED, "/transport");
  const set = (key: keyof TripValues, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const bind = (key: keyof TripValues, clean = (value: string) => value): Bind => ({
    value: values[key],
    "aria-invalid": !!errors[key],
    onChange: (event) => set(key, clean(event.target.value)),
  });
  const digits = (value: string) => value.replace(/\D/g, "");
  const unloaded = trip?.status === "unloaded";
  const notice = clearing?.status !== "cleared" ? "This container hasn't been cleared yet." : unloaded ? "This record is complete and can't be changed." : null;
  const readOnly = !canEnter || !!notice;
  const short = isShort(values);
  const charges = [
    { key: "freightInr", id: "freight", label: "Freight" },
    { key: "handlingInr", id: "loading-unloading", label: "Loading and unloading" },
  ] as const;
  const field = (id: string, key: keyof TripValues, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <TextField id={id} label={label} error={errors[key]} {...props} {...bind(key)} />
  );

  return (
    <>
      <PageHeader
        title={`Container ${container.number}`}
        parent={{ label: "Transport", href: "/transport" }}
        actions={
          <Button asChild variant="outline">
            <Link href="/transport">Cancel</Link>
          </Button>
        }
      />
      <PageContainer>
        <div className="grid items-start gap-(--page-gap) lg:grid-cols-[minmax(0,1fr)_400px]">
          <form
            noValidate
            className="flex min-w-0 flex-col gap-(--page-gap)"
            onSubmit={(event) => {
              event.preventDefault();
              void save(toTripBody(values), true);
            }}
          >
            {/* A disabled fieldset makes every field read-only at once. */}
            <fieldset disabled={readOnly} className="contents">
              <SectionCard title="Transport details" titleGap="none" bottomGap="form">
                <FieldGroup className="mt-[11px] grid gap-x-4 gap-y-[13px] sm:grid-cols-3">
                  <Field className={fieldClass} data-invalid={!!errors.transportCompanyId}>
                    <FieldLabel htmlFor="transport-name" className={labelClass}>
                      Transport name <RequiredMark />
                    </FieldLabel>
                    <NativeSelect size="sm" id="transport-name" required {...bind("transportCompanyId")}>
                      {form.companies.length ? null : <option value="" />}
                      {form.companies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </NativeSelect>
                    <FieldError>{errors.transportCompanyId}</FieldError>
                  </Field>
                  {field("lr-number", "lrNumber", "LR number", { required: true })}
                  <TextField id="bundles-loaded" label="Bundles loaded" required inputMode="numeric" error={errors.bundlesLoaded} {...bind("bundlesLoaded", digits)} />
                  {field("vehicle-number", "vehicleNumber", "Vehicle number", { required: true })}
                  {field("driver-name", "driverName", "Driver name")}
                  {field("driver-phone", "driverPhone", "Driver phone", { required: true, type: "tel" })}
                </FieldGroup>
              </SectionCard>

              <SectionCard title="Loading and unloading" titleGap="none" bottomGap="form">
                <div className="mt-3 grid gap-[18px] sm:grid-cols-2">
                  <Panel title="Loading at the port" status={trip ? <StatusPill tone="success">Done</StatusPill> : <StatusPill tone="warning">Waiting</StatusPill>}>
                    {field("loaded-on", "loadedOn", "Loaded on", { type: "date", max: today, className: "bg-card" })}
                    {field("loaded-from", "loadedFrom", "Loaded from", { className: "bg-card" })}
                    {field("loaded-by", "loadedBy", "Loaded by", { className: "bg-card" })}
                  </Panel>
                  <Panel title="Unloading at our warehouse" status={unloaded ? <StatusPill tone="success">Done</StatusPill> : <StatusPill tone="warning">Waiting</StatusPill>}>
                    {field("unloaded-on", "unloadedOn", "Unloaded on", { type: "date", max: today, className: cn("bg-card", !values.unloadedOn && "border-dashed") })}
                    <TextField
                      id="bundles-received"
                      label="Bundles received"
                      placeholder="Enter number"
                      inputMode="numeric"
                      error={errors.bundlesReceived}
                      className={cn("bg-card", !values.bundlesReceived && "border-dashed")}
                      {...bind("bundlesReceived", digits)}
                    />
                    {field("received-by", "receivedBy", "Received by", { placeholder: "Enter name", className: cn("bg-card", !values.receivedBy && "border-dashed") })}
                  </Panel>
                </div>

                <Callout tone="warning" size="xs" className="mt-[11px]">
                  If the bundles received are fewer than the {formatNumber(Number(values.bundlesLoaded) || 0)} loaded, the system asks for a short
                  remark before saving.
                </Callout>
                {short || values.shortRemark ? (
                  <Field className={cn(fieldClass, "mt-[11px]")} data-invalid={!!errors.shortRemark}>
                    <FieldLabel htmlFor="short-remark" className={labelClass}>
                      Short remark {short ? <RequiredMark /> : null}
                    </FieldLabel>
                    <Textarea id="short-remark" className="min-h-[60px] resize-none" aria-required={short} {...bind("shortRemark")} />
                    <FieldError>{errors.shortRemark}</FieldError>
                  </Field>
                ) : null}

                {readOnly ? (
                  notice ? <p className="mt-4 text-right text-sm leading-5 text-muted-foreground">{notice}</p> : null
                ) : (
                  <FormFooter className="mt-4 gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="w-[149px] min-w-0 text-[15px] text-label"
                      disabled={saving}
                      onClick={() => void save(toTripBody(values), false)}
                    >
                      Save draft
                    </Button>
                    <Button type="submit" size="lg" className="px-9 text-[15px]" disabled={saving}>
                      Save and mark unloaded
                    </Button>
                  </FormFooter>
                )}
              </SectionCard>
            </fieldset>
          </form>

          <div className="flex flex-col gap-4">
            <SectionCard title="Transport progress" titleGap="none" className="pb-[17px]">
              <Timeline size="xs" className="mt-2.5" items={transportSteps(form)} />
            </SectionCard>

            <SectionCard title="Goods on this vehicle" titleGap="none" className="pb-[15px]">
              <Table className="mt-3">
                <TableHeader>
                  <TableRow className="bg-table-head hover:bg-table-head">
                    <TableHead className={cn(headClass, "w-[84px]")}>PO</TableHead>
                    <TableHead className={headClass}>Item</TableHead>
                    <TableHead className={cn(headClass, "text-right")}>Bundles</TableHead>
                    <TableHead className={cn(headClass, "w-[90px] text-right")}>Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {form.goods.map((line) => (
                    <TableRow key={line.orderLineId} className="h-[33px] hover:bg-transparent">
                      <TableCell className={cn(cellClass, "font-bold")}>{line.po}</TableCell>
                      <TableCell className={cellClass}>{line.item}</TableCell>
                      <TableCell className={cn(cellClass, "text-right")}>{formatNumber(line.bundles)}</TableCell>
                      <TableCell className={cn(cellClass, "text-right")}>{formatQty(line.quantity, line.unit)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {/* The destination picker: drawn as the "Delivering to" text, a native select so it stays keyboard-friendly. */}
              <p className="mt-2 flex flex-wrap items-center gap-x-1 text-[13px] leading-5 text-muted-foreground">
                <label htmlFor="delivering-to">Delivering to:</label>
                <select
                  id="delivering-to"
                  disabled={readOnly}
                  className="-ml-0.5 cursor-pointer rounded-sm bg-transparent text-[13px] text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/25 disabled:cursor-default disabled:appearance-none"
                  {...bind("destinationId")}
                >
                  {form.warehouses.length ? null : <option value="">No warehouse</option>}
                  {form.warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </p>
              <FieldError>{errors.destinationId}</FieldError>
            </SectionCard>

            <SectionCard title="Transport charges" titleGap="none" aside={<CardNote>INR</CardNote>} className="pb-[28px]">
              <KeyValueList
                size="sm"
                density="compact"
                className="mt-2.5 text-[14.5px]"
                items={charges.map(({ key, id, label }) => ({
                  label: readOnly ? label : <label htmlFor={id}>{label}</label>,
                  value: readOnly ? (
                    formatExactINR(amountOf(values[key]))
                  ) : (
                    <span className="flex flex-col items-end">
                      <Input
                        id={id}
                        inputMode="decimal"
                        aria-invalid={!!errors[key]}
                        value={showAmount(values[key])}
                        onChange={(event) => set(key, cleanAmount(event.target.value))}
                        className="h-[30px] w-[130px] px-2 text-right text-[14.5px]"
                      />
                      <FieldError>{errors[key]}</FieldError>
                    </span>
                  ),
                }))}
                total={{ label: "Adds to landed cost", value: formatExactINR(amountOf(values.freightInr) + amountOf(values.handlingInr)) }}
              />
            </SectionCard>
          </div>
        </div>
      </PageContainer>
    </>
  );
}

/** Bordered inner panel: title and status pill, then three stacked fields. */
function Panel({ title, status, children }: { title: string; status: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-[10px] border bg-input-background px-4 pt-3 pb-3.5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[14.5px] leading-[22px] font-bold">{title}</h3>
        {status}
      </div>
      {children}
    </div>
  );
}

function TextField({ id, label, required, error, className, ...props }: React.ComponentProps<typeof Input> & { id: string; label: string; error?: string }) {
  return (
    <Field className={fieldClass} data-invalid={!!error}>
      <FieldLabel htmlFor={id} className={labelClass}>
        {label}
        {required ? <RequiredMark /> : null}
      </FieldLabel>
      <Input size="sm" id={id} required={required} className={className} {...props} />
      <FieldError>{error}</FieldError>
    </Field>
  );
}
