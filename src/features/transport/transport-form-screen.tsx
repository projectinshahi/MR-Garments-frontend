"use client";

import Link from "next/link";
import { useState } from "react";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Callout, CardNote, SectionCard } from "@/components/shared/cards";
import { FormFooter, NativeSelect, RequiredMark } from "@/components/shared/form";
import { KeyValueList } from "@/components/shared/key-value-list";
import { notInPrototype } from "@/components/shared/prototype";
import { StatusPill } from "@/components/shared/status-pill";
import { Timeline } from "@/components/shared/timeline";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatINR, formatNumber, formatQty } from "@/lib/formatters";
import { cn } from "@/lib/utils";

import type { TransportFormData } from "./data/queries";

// Measured from 27_10_Transport_-_Stage_5_form.jpeg: 12.5 px bold labels on a 16 px line, 5 px above the field;
// 14 px field text 12 px from the edge; cards end 18 px under their last control; slate outline-button labels.
const fieldClass = "gap-[5px]";
const labelClass = "gap-0.5 text-[12.5px] leading-4 font-bold text-label";
const headClass = "h-[30px] px-1.5 text-[12px] font-bold text-table-head-foreground";
const cellClass = "px-1.5 py-0";

type Values = Record<
  | "company"
  | "lr"
  | "bundlesLoaded"
  | "vehicle"
  | "driver"
  | "driverPhone"
  | "loadedOn"
  | "loadedFrom"
  | "loadedBy"
  | "unloadedOn"
  | "bundlesReceived"
  | "receivedBy",
  string
>;

/** Transport form, Stage 5 (27_10_Transport_-_Stage_5_form.jpeg): one container's vehicle, loading and unloading. */
export function TransportFormScreen({ data }: { data: TransportFormData }) {
  // Mock mutation: client state only, resets on reload
  const [values, setValues] = useState<Values>(() => ({
    company: data.company,
    lr: data.lr,
    bundlesLoaded: String(data.bundlesLoaded),
    vehicle: data.vehicle,
    driver: data.driver,
    driverPhone: data.driverPhone,
    loadedOn: formatDate(data.loading.loadedOn),
    loadedFrom: data.loading.loadedFrom,
    loadedBy: data.loading.loadedBy,
    unloadedOn: "",
    bundlesReceived: "",
    receivedBy: "",
  }));
  const bind = (key: keyof Values) => ({
    value: values[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setValues((current) => ({ ...current, [key]: event.target.value })),
  });
  const chargesTotal = data.charges.reduce((sum, charge) => sum + charge.amount, 0);

  return (
    <>
      <PageHeader
        title={`Container ${data.container}`}
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
            className="flex min-w-0 flex-col gap-(--page-gap)"
            onSubmit={(event) => {
              event.preventDefault();
              notInPrototype("Save and mark unloaded");
            }}
          >
            <SectionCard title="Transport details" titleGap="none" bottomGap="form">
              <FieldGroup className="mt-[11px] grid gap-x-4 gap-y-[13px] sm:grid-cols-3">
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="transport-name" className={labelClass}>
                    Transport name <RequiredMark />
                  </FieldLabel>
                  <NativeSelect size="sm" id="transport-name" required {...bind("company")}>
                    {data.companies.map((company) => (
                      <option key={company}>{company}</option>
                    ))}
                  </NativeSelect>
                </Field>
                <TextField id="lr-number" label="LR number" required {...bind("lr")} />
                <TextField id="bundles-loaded" label="Bundles loaded" required inputMode="numeric" {...bind("bundlesLoaded")} />
                <TextField id="vehicle-number" label="Vehicle number" required {...bind("vehicle")} />
                <TextField id="driver-name" label="Driver name" {...bind("driver")} />
                <TextField id="driver-phone" label="Driver phone" required type="tel" {...bind("driverPhone")} />
              </FieldGroup>
            </SectionCard>

            <SectionCard title="Loading and unloading" titleGap="none" bottomGap="form">
              <div className="mt-3 grid gap-[18px] sm:grid-cols-2">
                <Panel title="Loading at the port" status={<StatusPill tone="success">Done</StatusPill>}>
                  <TextField id="loaded-on" label="Loaded on" className="bg-card" {...bind("loadedOn")} />
                  <TextField id="loaded-from" label="Loaded from" className="bg-card" {...bind("loadedFrom")} />
                  <TextField id="loaded-by" label="Loaded by" className="bg-card" {...bind("loadedBy")} />
                </Panel>
                <Panel title="Unloading at our warehouse" status={<StatusPill tone="warning">Waiting</StatusPill>}>
                  <TextField id="unloaded-on" label="Unloaded on" placeholder="Select date" className="border-dashed bg-card" {...bind("unloadedOn")} />
                  <TextField
                    id="bundles-received"
                    label="Bundles received"
                    placeholder="Enter number"
                    inputMode="numeric"
                    className="border-dashed bg-card"
                    {...bind("bundlesReceived")}
                  />
                  <TextField id="received-by" label="Received by" placeholder="Enter name" className="border-dashed bg-card" {...bind("receivedBy")} />
                </Panel>
              </div>

              <Callout tone="warning" size="xs" className="mt-[11px]">
                If the bundles received are fewer than the {formatNumber(data.bundlesLoaded)} loaded, the system asks for a short
                remark before saving.
              </Callout>

              <FormFooter className="mt-4 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-[149px] min-w-0 text-[15px] text-label"
                  onClick={() => notInPrototype("Save draft")}
                >
                  Save draft
                </Button>
                <Button type="submit" size="lg" className="px-9 text-[15px]">
                  Save and mark unloaded
                </Button>
              </FormFooter>
            </SectionCard>
          </form>

          <div className="flex flex-col gap-4">
            <SectionCard title="Transport progress" titleGap="none" className="pb-[17px]">
              <Timeline
                size="xs"
                className="mt-2.5"
                items={data.progress.map((step) => ({
                  title: step.title,
                  marker: step.marker,
                  number: step.number,
                  detail: step.detail,
                }))}
              />
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
                  {data.goods.map((line) => (
                    <TableRow key={line.po} className="h-[33px] hover:bg-transparent">
                      <TableCell className={cn(cellClass, "font-bold")}>{line.po}</TableCell>
                      <TableCell className={cellClass}>{line.item}</TableCell>
                      <TableCell className={cn(cellClass, "text-right")}>{formatNumber(line.bundles)}</TableCell>
                      <TableCell className={cn(cellClass, "text-right")}>{formatQty(line.qty, line.unit)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-2 text-[13px] leading-5 text-muted-foreground">Delivering to: {data.deliveringTo}</p>
            </SectionCard>

            <SectionCard title="Transport charges" titleGap="none" aside={<CardNote>INR</CardNote>} className="pb-[28px]">
              <KeyValueList
                size="sm"
                density="compact"
                className="mt-2.5 text-[14.5px]"
                items={data.charges.map((charge) => ({ label: charge.label, value: formatINR(charge.amount) }))}
                total={{ label: "Adds to landed cost", value: formatINR(chargesTotal) }}
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

function TextField({ id, label, required, className, ...props }: React.ComponentProps<typeof Input> & { id: string; label: string }) {
  return (
    <Field className={fieldClass}>
      <FieldLabel htmlFor={id} className={labelClass}>
        {label}
        {required ? <RequiredMark /> : null}
      </FieldLabel>
      <Input size="sm" id={id} required={required} className={className} {...props} />
    </Field>
  );
}
