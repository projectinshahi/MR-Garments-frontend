"use client";

import Link from "next/link";
import { useState } from "react";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { CardNote, SectionCard } from "@/components/shared/cards";
import { FormFooter, NativeSelect, RequiredMark } from "@/components/shared/form";
import { KeyValueList } from "@/components/shared/key-value-list";
import { ProgressBar } from "@/components/shared/progress";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatExactINR, useStageSave } from "@/features/clearing/stage-form";
import { formatINR, formatNumber, formatQty } from "@/lib/formatters";
import { cn } from "@/lib/utils";

import type { ReceiveGoodsData } from "./data/queries";
import {
  capTeamPieces,
  costSoFar,
  RECEIPT_FIELDS,
  receiptValues,
  splitSummary,
  teamCost,
  teamPieces,
  toReceiptBody,
  unitOf,
  type ReceiptValues,
} from "./warehouse-logic";

// Measured from 29_11_Warehouse_-_Stage_6_form.jpeg: 12.5 px bold labels 5 px above 14 px fields, a 30 px table
// header with 12 px text, 16 px between stacked cards and 18 px under each card's last line. Cards use
// titleGap="none" and place their content as shown.
const fieldClass = "gap-[5px]";
const labelClass = "gap-0.5 text-[12.5px] leading-[15px] font-bold text-label";
const headClass = "h-[30px] px-1.5 text-[12px] font-bold text-table-head-foreground";
const cellClass = "px-1.5 py-0";
const TEAM_WIDTHS = ["w-[114px]", "w-[154px]", "w-[122.5px]"];

/** Proposed wording: no SUCCESS message fits a warehouse receipt yet. */
const SAVED = { draft: "Receipt draft saved", complete: "Goods added to stock" };

/**
 * Receive goods, Stage 6 (29_11_Warehouse_-_Stage_6_form.jpeg), for one unloaded trip: WH-2, saved with WH-3. The
 * team columns are the active teams; the cost cards show only when the API sends the cost (management). Read-only
 * once in stock, before unloading, and for users without warehouse Enter.
 */
export function ReceiveGoodsScreen({ data }: { data: ReceiveGoodsData }) {
  const { form, today, me, canEnter } = data;
  const { trip, receipt, lines, teams, cost } = form;
  const [values, setValues] = useState(() => receiptValues(form, today, me));
  const { errors, saving, save } = useStageSave(`/warehouse-receipts/${trip.id}`, RECEIPT_FIELDS, SAVED, "/warehouse");
  const set = (patch: Partial<ReceiptValues>) => setValues((current) => ({ ...current, ...patch }));
  const bind = (key: Exclude<keyof ReceiptValues, "split">, clean = (value: string) => value) => ({
    value: values[key],
    "aria-invalid": !!errors[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => set({ [key]: clean(event.target.value) }),
  });
  const { total, assigned, left } = splitSummary(lines, values.split);
  const unit = unitOf(lines);
  const sofar = cost ? costSoFar(cost) : null;
  const notice = trip.status !== "unloaded" ? "These goods haven't been unloaded yet." : receipt?.status === "stocked" ? "This record is complete and can't be changed." : null;
  const readOnly = !canEnter || !!notice;

  return (
    <>
      <PageHeader
        title="Receive goods"
        parent={{ label: "Warehouse", href: "/warehouse" }}
        actions={
          <Button asChild variant="outline">
            <Link href="/warehouse">Cancel</Link>
          </Button>
        }
      />
      <PageContainer>
        <div className="grid items-start gap-(--page-gap) lg:grid-cols-[minmax(0,1fr)_400px]">
          <form
            noValidate
            className="flex min-w-0 flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              // Enter in a field submits: that saves a draft. The final action, which can't be undone, needs its own click.
              void save(toReceiptBody(values), false);
            }}
          >
            {/* A disabled fieldset makes every field read-only at once. */}
            <fieldset disabled={readOnly} className="contents">
              <SectionCard title="Arrival details" titleGap="none" bottomGap="form">
                <FieldGroup className="mt-3 grid gap-x-4 gap-y-[14px] sm:grid-cols-3">
                  <Field className={fieldClass}>
                    <FieldLabel htmlFor="vehicle-number" className={labelClass}>
                      Vehicle number
                    </FieldLabel>
                    <Input id="vehicle-number" readOnly value={trip.vehicleNumber} size="sm" />
                  </Field>
                  <Field className={fieldClass}>
                    <FieldLabel htmlFor="lr-number" className={labelClass}>
                      LR number
                    </FieldLabel>
                    <Input id="lr-number" readOnly value={trip.lrNumber} size="sm" />
                  </Field>
                  <Field className={fieldClass}>
                    <FieldLabel htmlFor="container" className={labelClass}>
                      Container
                    </FieldLabel>
                    <Input id="container" readOnly value={trip.container} size="sm" />
                  </Field>
                  {/* The day the goods came into the warehouse (receivedOn): not before the trip's unloading. */}
                  <Field className={fieldClass} data-invalid={!!errors.receivedOn}>
                    <FieldLabel htmlFor="unloaded-on" className={labelClass}>
                      Unloaded on <RequiredMark />
                    </FieldLabel>
                    <Input id="unloaded-on" type="date" required min={trip.unloadedOn ?? undefined} max={today} size="sm" {...bind("receivedOn")} />
                    <FieldError>{errors.receivedOn}</FieldError>
                  </Field>
                  <Field className={fieldClass} data-invalid={!!errors.locationId}>
                    <FieldLabel htmlFor="warehouse" className={labelClass}>
                      Warehouse
                    </FieldLabel>
                    <NativeSelect size="sm" id="warehouse" {...bind("locationId")}>
                      {form.warehouses.length ? null : <option value="" />}
                      {form.warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </NativeSelect>
                    <FieldError>{errors.locationId}</FieldError>
                  </Field>
                  <Field className={fieldClass} data-invalid={!!errors.receivedBy}>
                    <FieldLabel htmlFor="received-by" className={labelClass}>
                      Received by <RequiredMark />
                    </FieldLabel>
                    <Input id="received-by" required size="sm" {...bind("receivedBy")} />
                    <FieldError>{errors.receivedBy}</FieldError>
                  </Field>
                  <Field className={fieldClass} data-invalid={!!errors.bundlesReceived}>
                    <FieldLabel htmlFor="bundles-received" className={labelClass}>
                      Bundles received <RequiredMark />
                    </FieldLabel>
                    <Input id="bundles-received" required inputMode="numeric" size="sm" {...bind("bundlesReceived", (value) => value.replace(/\D/g, ""))} />
                    {values.bundlesReceived !== "" && Number(values.bundlesReceived) === trip.bundlesLoaded ? (
                      <p className="mt-px text-[12.5px] leading-[15px] font-bold text-success-strong">✓ Matches the {trip.bundlesLoaded} bundles loaded</p>
                    ) : null}
                    <FieldError>{errors.bundlesReceived}</FieldError>
                  </Field>
                </FieldGroup>
              </SectionCard>

              <SectionCard
                title="Goods received, by team"
                aside={<CardNote size="sm">Split the quantity between the teams</CardNote>}
                titleGap="none"
                bottomGap="form"
              >
                <Table className="mt-[13px]">
                  <TableHeader>
                    <TableRow className="bg-table-head hover:bg-table-head">
                      <TableHead className={headClass}>Item</TableHead>
                      <TableHead className={cn(headClass, "w-[100px] text-right")}>Received</TableHead>
                      {teams.map((team, i) => (
                        <TableHead key={team.id} className={cn(headClass, TEAM_WIDTHS[i], "text-right")}>
                          {team.name}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line) => (
                      <TableRow key={line.orderLineId} className="h-[65px] border-0 hover:bg-transparent">
                        <TableCell className={cellClass}>
                          <span className="block leading-4 font-bold">{line.item}</span>
                          <span className="block text-[12.5px] leading-[14px] text-muted-foreground">{line.po}</span>
                        </TableCell>
                        <TableCell className={cn(cellClass, "text-right")}>{formatQty(line.quantity, line.unit)}</TableCell>
                        {teams.map((team) => (
                          <TableCell key={team.id} className={cn(cellClass, "pt-2.5 align-top")}>
                            <Input
                              aria-label={`${team.name}, ${line.item}`}
                              inputMode="numeric"
                              value={formatNumber(values.split[line.orderLineId]?.[team.id] ?? 0)}
                              onChange={(event) => {
                                const typed = Number(event.target.value.replace(/\D/g, "")) || 0;
                                setValues((current) => ({
                                  ...current,
                                  split: {
                                    ...current.split,
                                    [line.orderLineId]: { ...current.split[line.orderLineId], [team.id]: capTeamPieces(line, current.split, team.id, typed) },
                                  },
                                }));
                              }}
                              className="h-[38px] pr-2.5 text-right text-sm font-bold text-label"
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <p
                  role="status"
                  className="mt-[11px] flex min-h-[38px] flex-wrap items-center justify-between gap-x-4 rounded-lg bg-success-soft py-1 pr-3.5 pl-4 text-sm leading-5 text-callout-success-foreground"
                >
                  <span className="font-bold">
                    ✓ {formatNumber(assigned)} of {formatQty(total, unit)} given to teams
                  </span>
                  <span>{left > 0 ? `${formatQty(left, unit)} left unassigned` : "Nothing left unassigned"}</span>
                </p>
                <FieldError className="mt-2">{errors.lines}</FieldError>

                {readOnly ? (
                  notice ? <p className="mt-4 text-right text-sm leading-5 text-muted-foreground">{notice}</p> : null
                ) : (
                  <FormFooter className="mt-4 gap-3">
                    <Button
                      type="submit"
                      variant="outline"
                      size="lg"
                      className="w-[150px] min-w-0 text-[15px] text-label"
                      disabled={saving}
                    >
                      Save draft
                    </Button>
                    <Button type="button" size="lg" className="w-[250px] min-w-0 text-[15px]" disabled={saving} onClick={() => void save(toReceiptBody(values), true)}>
                      Save and add to stock
                    </Button>
                  </FormFooter>
                )}
              </SectionCard>
            </fieldset>
          </form>

          {cost && sofar ? (
            <div className="flex flex-col gap-4">
              <SectionCard
                title="Cost so far"
                aside={cost.final ? <StatusPill tone="success">Final</StatusPill> : <StatusPill tone="warning">Estimate</StatusPill>}
                titleGap="none"
              >
                <div className="mt-3 border-b border-border-subtle pb-[10.5px]">
                  <KeyValueList
                    size="sm"
                    density="compact"
                    items={[
                      { label: "Goods (paid to supplier)", value: formatExactINR(cost.goodsInr) },
                      {
                        label: "Sea freight",
                        // An order that also travels in a FOB container has sea freight even when this container is CNF: show it.
                        value:
                          trip.terms === "CNF" && cost.seaFreightInr === 0 ? (
                            <span className="text-muted-foreground">In supplier price (CNF)</span>
                          ) : (
                            formatExactINR(cost.seaFreightInr)
                          ),
                      },
                      { label: "Duty, taxes and clearing", value: cost.clearingInr === null ? "–" : formatExactINR(cost.clearingInr) },
                      { label: "Transport", value: cost.transportInr === null ? "–" : formatExactINR(cost.transportInr) },
                    ]}
                    total={{ label: `Total for ${formatQty(cost.orderedPieces, unit)}`, value: formatExactINR(sofar.total) }}
                  />
                </div>
                <div className="mt-[14.5px] rounded-xl bg-callout-info px-[14.5px] pt-[9.5px] pb-3">
                  <p className="text-[13px] leading-[18px] text-callout-info-foreground">Cost per piece so far</p>
                  <p className="text-[36px] leading-10 font-bold tracking-tight">{formatINR(sofar.perPiece, 2)}</p>
                </div>
              </SectionCard>

              <SectionCard title="Cost by team" titleGap="none" bottomGap="form">
                <ul className="mt-3">
                  {teams.map((team) => {
                    const pieces = teamPieces(values.split, team.id);
                    return (
                      <li
                        key={team.id}
                        className="grid grid-cols-[minmax(0,1fr)_81px] items-center border-b border-border-subtle pt-[10.5px] pb-[11px] last:border-b-0"
                      >
                        <div>
                          <p className="text-sm leading-[18px]">{team.name}</p>
                          <p className="text-[12.5px] leading-[15px] text-muted-foreground">{formatQty(pieces, unit)}</p>
                          <ProgressBar size="sm" value={pieces} max={total} label={`${team.name} share of ${formatQty(total, unit)}`} className="mt-[4.5px]" />
                        </div>
                        <p className="text-right text-sm font-bold">{formatINR(teamCost(pieces, sofar.perPiece))}</p>
                      </li>
                    );
                  })}
                </ul>
              </SectionCard>
            </div>
          ) : null}
        </div>
      </PageContainer>
    </>
  );
}
