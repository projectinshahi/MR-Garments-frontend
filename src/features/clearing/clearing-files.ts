import { type Column, money, type ReportFile, summarySection } from "@/features/reports/report-files";
import type { ClearingList, ClearingListRow } from "@/lib/api/stages-types";

import { clearingStatusLabel, timeAtPort } from "./clearing-logic";

// Customs / Clearing report download (backend docs/report-downloads.md): every arrived container the page's search,
// agent and status filters match, with its POs, the clearing dates and each recorded charge apart (CLR-3's figures, in
// INR); the total is their sum, as the list's Clearing cost. The value of goods for duty is shown but is not a cost.
// A container's charges are not split between its POs.

const text = (header: string): Column => ({ header });
const date = (header: string): Column => ({ header, date: true });
const inr = (header: string) => money(header, "INR");
const sum = (rows: ClearingListRow[], pick: (row: ClearingListRow) => number | null | undefined) =>
  Math.round(rows.reduce((total, row) => total + (pick(row) ?? 0), 0) * 100) / 100;

export function clearingFile(rows: ClearingListRow[], kpis: ClearingList["kpis"], filters: string, today: string): ReportFile {
  const recorded = rows.filter((row) => row.status !== "waiting");
  return {
    title: "Clearing (India)",
    filename: `clearing-${today}`,
    filters,
    notes: [
      "Charges are recorded per container in INR and are not split between its POs. Waiting containers have no clearing recorded yet.",
      "The value of goods for duty is what customs assessed; it is not part of the total charges.",
    ],
    sections: [
      summarySection([
        ["Containers", rows.length],
        ["Waiting for a clearing", rows.length - recorded.length],
        ["Cleared", rows.filter((row) => row.status === "cleared").length],
        ["Total recorded charges (INR)", sum(recorded, (row) => row.clearingCostInr)],
        ["In clearing now", kpis.inClearingNow],
        ["Cleared, last 30 days", kpis.clearedLast30Days],
        ["Average days to clear (last 30 days)", kpis.averageDaysToClear ?? "–"],
        ["Clearing cost, last 30 days (INR)", kpis.clearingCostLast30DaysInr],
      ]),
      {
        sheet: "Clearing",
        title: "Clearing by container",
        columns: [
          text("Container"),
          text("POs"),
          text("Clearing agent"),
          text("Terms"),
          date("Arrived at port"),
          date("Handed to agent"),
          text("Bill of entry"),
          date("Duty paid on"),
          date("Cleared on"),
          text("Status"),
          text("Time at port"),
          inr("Value of goods for duty"),
          inr("Customs duty"),
          inr("Other duties and taxes"),
          inr("Clearing agent charges"),
          inr("Port and terminal charges"),
          inr("Total recorded charges"),
          text("Transport trip (LR)"),
        ],
        rows: rows.map((row) => {
          const waiting = row.status === "waiting";
          return [
            row.number,
            row.orders.join(", "),
            row.agent?.name ?? null,
            row.terms,
            row.arrivedOn,
            row.handedOn,
            row.billOfEntry || null,
            row.dutyPaidOn,
            row.clearedOn,
            clearingStatusLabel(row),
            timeAtPort(row, today),
            row.goodsValueInr ?? null,
            waiting ? null : (row.customsDutyInr ?? null),
            waiting ? null : (row.otherDutiesInr ?? null),
            waiting ? null : (row.agentChargesInr ?? null),
            waiting ? null : (row.portChargesInr ?? null),
            waiting ? null : row.clearingCostInr,
            row.trip?.lrNumber ?? null,
          ];
        }),
        total: rows.length
          ? [
              `Total, ${rows.length} containers`,
              ...Array<null>(10).fill(null),
              sum(recorded, (row) => row.goodsValueInr),
              sum(recorded, (row) => row.customsDutyInr),
              sum(recorded, (row) => row.otherDutiesInr),
              sum(recorded, (row) => row.agentChargesInr),
              sum(recorded, (row) => row.portChargesInr),
              sum(recorded, (row) => row.clearingCostInr),
              null,
            ]
          : undefined,
      },
    ],
  };
}
