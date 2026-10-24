"use client";

import Link from "next/link";
import { useState } from "react";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { CardNote, SectionCard } from "@/components/shared/cards";
import { FormFooter, NativeSelect, RequiredMark } from "@/components/shared/form";
import { KeyValueList } from "@/components/shared/key-value-list";
import { ProgressBar } from "@/components/shared/progress";
import { notInPrototype } from "@/components/shared/prototype";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatINR, formatNumber, formatQty } from "@/lib/formatters";
import { cn } from "@/lib/utils";

import type { ReceiveGoodsData } from "./data/queries";
import { capTeamPieces, costSoFar, splitSummary, teamCost } from "./warehouse-logic";

// Measured from 29_11_Warehouse_-_Stage_6_form.jpeg: 12.5 px bold labels 5 px above 14 px fields, a 30 px table
// header with 12 px text, 16 px between stacked cards and 18 px under each card's last line. Cards use
// titleGap="none" and place their content as shown.
const cardClass = "pb-[18px]";
const fieldClass = "gap-[5px]";
const labelClass = "gap-0.5 text-[12.5px] leading-[15px] font-bold text-label";
const inputClass = "pl-3 text-sm";
const headClass = "h-[30px] px-1.5 text-[12px] font-bold text-table-head-foreground";
const cellClass = "px-1.5 py-0";
const TEAM_WIDTHS = ["w-[114px]", "w-[154px]", "w-[122.5px]"];

/** Receive goods, Stage 6 (29_11_Warehouse_-_Stage_6_form.jpeg), prefilled for PO-2028. */
export function ReceiveGoodsScreen({ data }: { data: ReceiveGoodsData }) {
  // Mock mutation: client state only, resets on reload
  const [pieces, setPieces] = useState(() => data.teams.map((team) => team.pieces));
  const [bundles, setBundles] = useState(String(data.bundlesReceived));
  const { assigned, left } = splitSummary(data.received, pieces);
  const cost = costSoFar(data.cost, data.received);

  return (
    <>
      <PageHeader
        title="Receive goods"
        parent={{ label: "Warehouse", href: "/warehouse" }}
        actions={
          <Button asChild variant="outline" className="text-label">
            <Link href="/warehouse">Cancel</Link>
          </Button>
        }
      />
      <PageContainer>
        <div className="grid items-start gap-(--page-gap) lg:grid-cols-[minmax(0,1fr)_400px]">
          <form
            className="flex min-w-0 flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              notInPrototype("Save and add to stock");
            }}
          >
            <SectionCard title="Arrival details" titleGap="none" className={cardClass}>
              <FieldGroup className="mt-3 grid gap-x-4 gap-y-[14px] sm:grid-cols-3">
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="vehicle-number" className={labelClass}>
                    Vehicle number
                  </FieldLabel>
                  <Input id="vehicle-number" readOnly value={data.vehicleNumber} className={inputClass} />
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="lr-number" className={labelClass}>
                    LR number
                  </FieldLabel>
                  <Input id="lr-number" readOnly value={data.lrNumber} className={inputClass} />
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="container" className={labelClass}>
                    Container
                  </FieldLabel>
                  <Input id="container" readOnly value={data.container} className={inputClass} />
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="unloaded-on" className={labelClass}>
                    Unloaded on <RequiredMark />
                  </FieldLabel>
                  <Input id="unloaded-on" required defaultValue={formatDate(data.unloadedOn)} className={inputClass} />
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="warehouse" className={labelClass}>
                    Warehouse
                  </FieldLabel>
                  <NativeSelect id="warehouse" defaultValue={data.warehouse}>
                    {data.warehouses.map((name) => (
                      <option key={name}>{name}</option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="received-by" className={labelClass}>
                    Received by <RequiredMark />
                  </FieldLabel>
                  <Input id="received-by" required defaultValue={data.receivedBy} className={inputClass} />
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="bundles-received" className={labelClass}>
                    Bundles received <RequiredMark />
                  </FieldLabel>
                  <Input
                    id="bundles-received"
                    required
                    inputMode="numeric"
                    value={bundles}
                    onChange={(event) => setBundles(event.target.value.replace(/\D/g, ""))}
                    className={inputClass}
                  />
                  {Number(bundles) === data.bundlesLoaded ? (
                    <p className="mt-px text-[12.5px] leading-[15px] font-bold text-success-strong">
                      ✓ Matches the {data.bundlesLoaded} bundles loaded
                    </p>
                  ) : null}
                </Field>
              </FieldGroup>
            </SectionCard>

            <SectionCard
              title="Goods received, by team"
              aside={<CardNote className="text-[13px]">Split the quantity between the teams</CardNote>}
              titleGap="none"
              className={cardClass}
            >
              <Table className="mt-[13px]">
                <TableHeader>
                  <TableRow className="bg-table-head hover:bg-table-head">
                    <TableHead className={headClass}>Item</TableHead>
                    <TableHead className={cn(headClass, "w-[100px] text-right")}>Received</TableHead>
                    {data.teams.map((team, i) => (
                      <TableHead key={team.id} className={cn(headClass, TEAM_WIDTHS[i], "text-right")}>
                        {team.name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="h-[65px] border-0 hover:bg-transparent">
                    <TableCell className={cellClass}>
                      <span className="block leading-4 font-bold">{data.item}</span>
                      <span className="block text-[12.5px] leading-[14px] text-muted-foreground">{data.po}</span>
                    </TableCell>
                    <TableCell className={cn(cellClass, "text-right")}>{formatQty(data.received, "pcs")}</TableCell>
                    {data.teams.map((team, i) => (
                      <TableCell key={team.id} className={cn(cellClass, "pt-2.5 align-top")}>
                        <Input
                          aria-label={`${team.name}, ${data.item}`}
                          inputMode="numeric"
                          value={formatNumber(pieces[i])}
                          onChange={(event) => {
                            const value = Number(event.target.value.replace(/\D/g, "")) || 0;
                            setPieces((current) =>
                              current.map((p, j) => (j === i ? capTeamPieces(data.received, current, i, value) : p)),
                            );
                          }}
                          className="h-[38px] pr-2.5 text-right text-sm font-bold text-label"
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>

              <p
                role="status"
                className="mt-[11px] flex min-h-[38px] flex-wrap items-center justify-between gap-x-4 rounded-lg bg-success-soft py-1 pr-3.5 pl-4 text-sm leading-5 text-callout-success-foreground"
              >
                <span className="font-bold">
                  ✓ {formatNumber(assigned)} of {formatQty(data.received, "pcs")} given to teams
                </span>
                <span>{left > 0 ? `${formatQty(left, "pcs")} left unassigned` : "Nothing left unassigned"}</span>
              </p>

              <FormFooter className="mt-4 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-[150px] min-w-0 text-[15px] text-label"
                  onClick={() => notInPrototype("Save draft")}
                >
                  Save draft
                </Button>
                <Button type="submit" size="lg" className="w-[250px] min-w-0 text-[15px]">
                  Save and add to stock
                </Button>
              </FormFooter>
            </SectionCard>
          </form>

          <div className="flex flex-col gap-4">
            <SectionCard title="Cost so far" aside={<StatusPill tone="warning">Estimate</StatusPill>} titleGap="none">
              <div className="mt-3 border-b border-border-subtle pb-[10.5px]">
                <KeyValueList
                  size="sm"
                  items={[
                    { label: "Goods (paid to supplier)", value: formatINR(data.cost.goods) },
                    { label: "Sea freight", value: <span className="text-muted-foreground">In supplier price (CNF)</span> },
                    { label: "Duty, taxes and clearing", value: formatINR(data.cost.dutyTaxesClearing) },
                    { label: "Transport", value: formatINR(data.cost.transport) },
                  ]}
                  total={{ label: `Total for ${formatQty(data.received, "pcs")}`, value: formatINR(cost.total) }}
                />
              </div>
              <div className="mt-[14.5px] rounded-xl bg-callout-info px-[14.5px] pt-[9.5px] pb-3">
                <p className="text-[13px] leading-[18px] text-callout-info-foreground">Cost per piece so far</p>
                <p className="text-[36px] leading-10 font-bold tracking-tight">{formatINR(cost.perPiece, 2)}</p>
              </div>
            </SectionCard>

            <SectionCard title="Cost by team" titleGap="none" className={cardClass}>
              <ul className="mt-3">
                {data.teams.map((team, i) => (
                  <li
                    key={team.id}
                    className="grid grid-cols-[minmax(0,1fr)_81px] items-center border-b border-border-subtle pt-[10.5px] pb-[11px] last:border-b-0"
                  >
                    <div>
                      <p className="text-sm leading-[18px]">{team.name}</p>
                      <p className="text-[12.5px] leading-[15px] text-muted-foreground">{formatQty(pieces[i], "pcs")}</p>
                      <ProgressBar
                        size="sm"
                        value={pieces[i]}
                        max={data.received}
                        label={`${team.name} share of ${formatQty(data.received, "pcs")}`}
                        className="mt-[4.5px]"
                      />
                    </div>
                    <p className="text-right text-sm font-bold">{formatINR(teamCost(pieces[i], cost.perPiece))}</p>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>
        </div>
      </PageContainer>
    </>
  );
}
