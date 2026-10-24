"use client";

import { differenceInCalendarDays, parseISO } from "date-fns";
import Link from "next/link";
import { useState } from "react";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/shared/cards";
import { FormFooter, NativeSelect, RequiredMark } from "@/components/shared/form";
import { KeyValueList } from "@/components/shared/key-value-list";
import { ProgressBar } from "@/components/shared/progress";
import { notInPrototype } from "@/components/shared/prototype";
import { Journey } from "@/components/shared/timeline";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatNumber, formatQty, formatShortDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { Terms } from "@/types/domain";

import { contents, orderLoaded, parseCount } from "./containers-logic";
import type { LoadContainerData } from "./data/queries";

// Measured from 23_8_Container_loading_-_Stage_3_form.jpeg: 12.5 px bold labels 5 px above 42 px fields, 12 px
// table headers in a 30 px row, 60 px item rows. Cards use titleGap="none" and place their content where the
// reference has it.
const fieldClass = "gap-[5px]";
const labelClass = "gap-0.5 text-[12.5px] leading-[15px] font-bold text-label";
const headClass = "h-[30px] px-1.5 text-[12px] font-bold text-table-head-foreground";
const cellClass = "px-1.5 py-0";
const lineInputClass = "h-[38px] pr-2.5 text-right text-sm font-bold text-label";

const TERMS: Terms[] = ["FOB", "CNF"];
const TERMS_TONE: Record<Terms, string> = {
  FOB: "border-info/25 bg-info-soft text-info",
  CNF: "border-purple-border bg-purple-soft text-purple",
};

/** Per-line terms, drawn like the FOB/CNF badge with a ▾. Native select, so it is keyboard-accessible. */
function LineTermsSelect({ value, onChange, label }: { value: Terms; onChange: (value: Terms) => void; label: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-[35px] w-[65px] items-center rounded-md border focus-within:ring-3 focus-within:ring-ring/40",
        TERMS_TONE[value],
      )}
    >
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value as Terms)}
        className="h-full w-full cursor-pointer appearance-none bg-transparent pr-4 pl-3 text-sm font-bold outline-none"
      >
        {TERMS.map((terms) => (
          <option key={terms}>{terms}</option>
        ))}
      </select>
      <svg aria-hidden viewBox="0 0 7 8" className="pointer-events-none absolute top-[14px] right-[10.5px] h-2 w-[7px] fill-current">
        <path d="M0 0h7L3.5 8z" />
      </svg>
    </span>
  );
}

/** Load container, Stage 3 (23_8_Container_loading_-_Stage_3_form.jpeg), prefilled for FCIU 5527310. */
export function LoadContainerScreen({ data }: { data: LoadContainerData }) {
  // Mock mutation: client state only, resets on reload
  const [edits, setEdits] = useState(() =>
    data.lines.map((line) => ({ bundles: String(line.bundles), quantity: formatQty(line.quantity, line.unit), terms: line.terms })),
  );
  const lines = data.lines.map((line, i) => ({
    ...line,
    bundles: parseCount(edits[i].bundles),
    quantity: parseCount(edits[i].quantity),
    terms: edits[i].terms,
  }));
  const edit = (index: number, patch: Partial<(typeof edits)[number]>) =>
    setEdits((current) => current.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  const glance = contents(lines);
  const seaDays = differenceInCalendarDays(parseISO(data.eta), parseISO(data.etd));

  return (
    <>
      <PageHeader
        title="Load container"
        parent={{ label: "Containers", href: "/containers" }}
        actions={
          <Button asChild variant="outline">
            <Link href="/containers">Cancel</Link>
          </Button>
        }
      />
      <PageContainer>
        <div className="grid items-start gap-(--page-gap) lg:grid-cols-[minmax(0,1fr)_400px]">
          <form
            className="flex min-w-0 flex-col gap-(--page-gap)"
            onSubmit={(event) => {
              event.preventDefault();
              notInPrototype("Save container");
            }}
          >
            <SectionCard title="Container details" titleGap="none">
              <FieldGroup className="mt-3 grid gap-x-4 gap-y-[14px] sm:grid-cols-3">
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="container-number" className={labelClass}>
                    Container number <RequiredMark />
                  </FieldLabel>
                  <Input size="sm" id="container-number" required defaultValue={data.number} />
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="shipping-agent" className={labelClass}>
                    Shipping agent <RequiredMark />
                  </FieldLabel>
                  <NativeSelect size="sm" id="shipping-agent" required defaultValue={data.agent}>
                    {data.agents.map((agent) => (
                      <option key={agent}>{agent}</option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="container-terms" className={labelClass}>
                    Container terms <RequiredMark />
                  </FieldLabel>
                  <NativeSelect size="sm" id="container-terms" required defaultValue={data.terms}>
                    {TERMS.map((terms) => (
                      <option key={terms}>{terms}</option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="loaded-on" className={labelClass}>
                    Loaded on
                  </FieldLabel>
                  <Input size="sm" id="loaded-on" defaultValue={formatDate(data.loadedOn)} />
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="etd" className={labelClass}>
                    Expected departure (ETD)
                  </FieldLabel>
                  <Input size="sm" id="etd" defaultValue={formatDate(data.etd)} />
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="eta" className={labelClass}>
                    Expected arrival in India (ETA)
                  </FieldLabel>
                  <Input size="sm" id="eta" defaultValue={formatDate(data.eta)} />
                </Field>
                <Field className={cn(fieldClass, "sm:col-span-2")}>
                  <FieldLabel htmlFor="port-of-loading" className={labelClass}>
                    Port of loading
                  </FieldLabel>
                  <Input size="sm" id="port-of-loading" defaultValue={data.portOfLoading} />
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="port-of-arrival" className={labelClass}>
                    Port of arrival
                  </FieldLabel>
                  <Input size="sm" id="port-of-arrival" defaultValue={data.portOfArrival} />
                </Field>
              </FieldGroup>
            </SectionCard>

            <SectionCard title="What is loaded in this container" titleGap="none">
              <Table className="mt-3">
                <TableHeader>
                  <TableRow className="bg-table-head hover:bg-table-head">
                    <TableHead className={cn(headClass, "w-[81px]")}>PO</TableHead>
                    <TableHead className={headClass}>Item</TableHead>
                    <TableHead className={cn(headClass, "w-[103px] text-right")}>Bundles</TableHead>
                    <TableHead className={cn(headClass, "w-[167px] text-right")}>Quantity</TableHead>
                    <TableHead className={cn(headClass, "w-[136px] text-right")}>Terms</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, i) => {
                    const name = `${line.po} ${line.item}`;
                    return (
                      <TableRow key={line.id} className="h-[60px] border-border-subtle hover:bg-transparent">
                        <TableCell className={cn(cellClass, "font-bold")}>{line.po}</TableCell>
                        <TableCell className={cellClass}>{line.item}</TableCell>
                        {/* The reference sets the inputs 8 px from the row top, above the text line. */}
                        <TableCell className={cn(cellClass, "pt-2 text-right align-top")}>
                          <Input
                            aria-label={`Bundles, ${name}`}
                            inputMode="numeric"
                            value={edits[i].bundles}
                            onChange={(event) => edit(i, { bundles: event.target.value })}
                            className={cn(lineInputClass, "w-[91px]")}
                          />
                        </TableCell>
                        <TableCell className={cn(cellClass, "pt-2 text-right align-top")}>
                          <Input
                            aria-label={`Quantity, ${name}`}
                            value={edits[i].quantity}
                            onChange={(event) => edit(i, { quantity: event.target.value })}
                            className={cn(lineInputClass, "w-[155px]")}
                          />
                        </TableCell>
                        <TableCell className={cn(cellClass, "text-right")}>
                          <LineTermsSelect label={`Terms, ${name}`} value={line.terms} onChange={(terms) => edit(i, { terms })} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <button
                type="button"
                onClick={() => notInPrototype("Add item from another order")}
                className="mt-2 rounded-sm text-[13.5px] leading-5 font-bold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                + Add item from another order
              </button>

              <p className="mt-[11px] rounded-[10px] border bg-table-head px-3.5 py-[10.5px] text-[13px] leading-5 text-label">
                <strong>FOB</strong>: we pay the freight from the China port. <strong>CNF</strong>: the supplier pays the freight
                up to India. Each item can have its own term.
              </p>

              <FormFooter className="mt-[17px] gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-[150px] min-w-0 text-[15px]"
                  onClick={() => notInPrototype("Save draft")}
                >
                  Save draft
                </Button>
                <Button type="submit" size="lg" className="w-[210px] min-w-0 text-[15px]">
                  Save container
                </Button>
              </FormFooter>
            </SectionCard>
          </form>

          <div className="flex flex-col gap-(--page-gap)">
            <SectionCard title="Journey" titleGap="none">
              <Journey
                size="sm"
                align="edges"
                className="mt-3"
                steps={[
                  { title: formatShortDate(data.loadedOn), lines: ["Loaded"], marker: "dot" },
                  { title: formatShortDate(data.etd), lines: ["Departs"], marker: "ring" },
                  { title: formatShortDate(data.eta), lines: ["Arrives"], marker: "ring" },
                ]}
              />
              <p className="mt-2 text-sm leading-5 text-label">
                About {seaDays} days at sea. Agent: {data.agent}.
              </p>
            </SectionCard>

            <SectionCard title="Contents at a glance" titleGap="none" aria-label="Contents at a glance">
              <KeyValueList
                boldValues
                className="mt-[10px]"
                items={[
                  { label: "Orders in this container", value: glance.orders },
                  { label: "Item lines", value: glance.lines },
                  { label: "Total bundles", value: formatNumber(glance.bundles) },
                ]}
              />
            </SectionCard>

            <SectionCard title="Where each order is loaded" titleGap="none">
              <ul className="mt-3">
                {data.orderLoads.map((load) => {
                  const loaded = orderLoaded(load, lines);
                  const title = `${load.po} · ${load.item}`;
                  return (
                    <li key={load.po} className="border-b border-border-subtle py-2.5 last:border-b-0 last:pb-0">
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-sm leading-5 font-bold">{title}</span>
                        <span className="text-[12.5px] leading-[18px] whitespace-nowrap text-muted-foreground">
                          {formatNumber(loaded)} of {formatNumber(load.ordered)}
                        </span>
                      </div>
                      <ProgressBar size="sm" value={loaded} max={load.ordered} label={`${title} loaded`} className="mt-[7px]" />
                      <p className="mt-[7px] text-[12.5px] leading-[17.5px] text-muted-foreground">{load.note}</p>
                    </li>
                  );
                })}
              </ul>
            </SectionCard>
          </div>
        </div>
      </PageContainer>
    </>
  );
}
