import { type Column, money, perCurrency, rate, type ReportFile, type Section, summarySection } from "@/features/reports/report-files";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { PaymentsResponse } from "@/lib/api/types";

import { CONTAINER_STATUS, type ContainerRow } from "./containers-logic";

// Shipping (Containers) report download (backend docs/report-downloads.md): every container the page's search, agent,
// terms and status filters match, one row per PO in them with its supplier, and the shipping-agent payments of those
// POs (sea freight, PAY-1) when the user may view payments. Freight is recorded per PO as agent payments, never per
// container; duty and clearing charges are in the Clearing report.

const text = (header: string): Column => ({ header });
const date = (header: string): Column => ({ header, date: true });

type AgentPayments = PaymentsResponse["payments"] | "denied";

/** PAY-1's payments for the download; "denied" when the role can't view payments (the file then says so). */
export const fetchAgentPayments = (): Promise<AgentPayments> =>
  apiClient.get<PaymentsResponse>("/payments").then(
    (response) => response.payments,
    (error: unknown) => {
      if (error instanceof ApiError && error.status === 403) return "denied" as const;
      throw error;
    },
  );

export function containersFile(rows: ContainerRow[], filters: string, today: string, payments: AgentPayments): ReportFile {
  const pos = rows.flatMap((c) => c.orders.map((o) => ({ ...o, container: c })));
  const shipped = new Set(pos.map((o) => o.po));
  const freight = payments === "denied" ? [] : payments.filter((p) => p.payeeRole === "agent" && shipped.has(p.po));
  const freightTables: Section[] =
    payments === "denied"
      ? []
      : perCurrency(freight).map(([currency, list]) => ({
          sheet: "Shipping-Agent Payments",
          title: `Shipping-agent payments (${currency})`,
          columns: [
            text("PO"),
            text("Paid to"),
            text("Payment type"),
            date("Paid on"),
            date("Due date"),
            text("Method"),
            money("Amount", currency),
            rate("Exchange rate", currency),
            money("INR equivalent", "INR"),
            text("Status"),
            text("Reference"),
          ],
          rows: list.map((p) => [p.po, p.payee, p.kind, p.paidOn, p.dueDate, p.mode, p.amountCny, p.rateInr, p.amountInr, p.status === "paid" ? "Paid" : "Due", p.reference || null]),
        }));
  const count = (status: ContainerRow["status"]) => rows.filter((c) => c.status === status).length;
  return {
    title: "Shipping (Containers)",
    filename: `containers-${today}`,
    filters,
    notes: [
      "Freight is recorded as payments to the shipping agent on each PO (FOB orders), not per container.",
      "Duty, taxes and clearing charges are in the Clearing (India) report.",
      ...(payments === "denied" ? ["Shipping-agent payments are left out: they need Payments access."] : []),
    ],
    sections: [
      summarySection([
        ["Containers", rows.length],
        ["Loading", count("loading")],
        ["On the sea", count("sea")],
        ["Arrived, in clearing", count("arrived")],
        ["Bundles", rows.reduce((sum, c) => sum + c.bundles, 0)],
        ["POs shipped", shipped.size],
        ...(payments === "denied" ? [] : [["Shipping-agent payments", freight.length] as [string, number]]),
      ]),
      {
        sheet: "Containers",
        title: "Containers",
        columns: [
          text("Container"),
          text("Shipping agent"),
          text("Terms"),
          text("Status"),
          date("Loaded on"),
          date("Departure (sailed)"),
          date("Arrival (ETA India)"),
          text("ETA"),
          text("Port of loading"),
          text("Port of arrival"),
          text("POs"),
          text("Suppliers"),
          text("Bundles"),
        ],
        rows: rows.map((c) => [
          c.number,
          c.agent,
          c.terms,
          CONTAINER_STATUS[c.status].label,
          c.loadedOn,
          c.sailedOn,
          c.etaIndia,
          c.etaEstimated ? "Estimated" : "Confirmed",
          c.portOfLoading || null,
          c.portOfArrival || null,
          c.orders.map((o) => (o.part ? `${o.po} (part)` : o.po)).join(", "),
          [...new Set(c.orders.flatMap((o) => (o.supplier ? [o.supplier] : [])))].join(", ") || null,
          c.bundles,
        ]),
      },
      {
        sheet: "Container POs",
        title: "POs per container",
        columns: [text("Container"), text("PO"), text("Supplier"), text("Load"), text("Status"), date("Departure (sailed)"), date("Arrival (ETA India)")],
        rows: pos.map((o) => [
          o.container.number,
          o.po,
          o.supplier ?? null,
          o.part ? "Part of the order" : "Whole order",
          CONTAINER_STATUS[o.container.status].label,
          o.container.sailedOn,
          o.container.etaIndia,
        ]),
      },
      ...freightTables,
    ],
  };
}
