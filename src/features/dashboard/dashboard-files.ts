import { amountsText, type Cell, type Column, money, perCurrency, type ReportFile, type Section, summarySection } from "@/features/reports/report-files";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { ContainerListItem, DeliveryItem, OrderListItem, PaymentsResponse } from "@/lib/api/types";
import { formatDate, sumByCurrency } from "@/lib/formatters";
import { STAGES } from "@/types/domain";

import { type DashboardSources, isAvailable, type Source, toDashboard } from "./dashboard-logic";

// Dashboard report download (backend docs/report-downloads.md): the dashboard's KPIs and every row behind its four
// cards (the page shows five a card), from the same four calls and the same derivations (dashboard-logic.ts), plus a
// supplier summary from ORD-1 (each order's FIFO settlement) and the payable supplier balances from PAY-1's ledger totals. A source the role can't read is said, never guessed.
// The dashboard has no date filter: the file is as of today in India.

const text = (header: string): Column => ({ header });
const date = (header: string): Column => ({ header, date: true });
const round2 = (value: number) => Math.round(value * 100) / 100;

/** A 403 means the role can't see that source; any other failure is "failed" (the file says which). */
const settle = <T>(path: string): Promise<Source<T>> =>
  apiClient.get<T>(path).catch((error: unknown) => (error instanceof ApiError && error.status === 403 ? "denied" : "failed"));

export async function fetchDashboardSources(): Promise<DashboardSources> {
  const [orders, deliveries, payments, containers] = await Promise.all([
    settle<OrderListItem[]>("/orders"),
    settle<DeliveryItem[]>("/deliveries"),
    settle<PaymentsResponse>("/payments"),
    settle<ContainerListItem[]>("/containers"),
  ]);
  return { orders, deliveries, payments, containers };
}

const missing = (source: "denied" | "failed") => (source === "denied" ? "Not in your access" : "Could not be loaded");
/** The KPI value, or why it is missing. */
const kpi = <T>(source: Source<T>, value: (data: T) => Cell): Cell => (isAvailable(source) ? value(source) : missing(source));
/** A table that needs a source: the table, or a one-line table saying why there is none. */
const needs = <T>(source: Source<T>, title: string, sheet: string, build: (data: T) => Section[]): Section[] =>
  isAvailable(source) ? build(source) : [{ title, sheet, columns: [text(title)], rows: [[missing(source)]] }];

export function dashboardFile(sources: DashboardSources, today: string): ReportFile {
  const d = toDashboard(sources, today, Infinity);
  const orders = sources.orders;
  return {
    title: "Dashboard",
    filename: `dashboard-${today}`,
    filters: `As of ${formatDate(today)} (India)`,
    notes: [
      "Payments due carry no exchange rate until paid, so they are one total per currency. Payable to suppliers is the sum of the supplier ledger accounts below zero; an order's settled and outstanding amounts are the ledger's oldest-first settlement. Held accounts (pending review) count in no total.",
      "Warehouse stock and landed cost are in the Warehouse and Landed Cost reports.",
    ],
    sections: [
      summarySection([
        ["Active orders (stages 1-5)", kpi(d.orders, (o) => o.active)],
        ["Due in next 7 days", kpi(d.deliveries, (x) => x.dueNext7)],
        ["Late deliveries", kpi(d.deliveries, (x) => x.late)],
        ["Containers on the way", kpi(d.containers, (c) => c.onTheWay)],
        ["Containers arriving this week", kpi(d.containers, (c) => c.arrivingThisWeek)],
        ["Payments due in next 30 days", kpi(d.paymentsDue, (p) => amountsText(p.amounts))],
        // Every paid payment (supplier and shipping agent, orderless ones included) at its own rate; voided and held (D4) left out.
        ["Paid so far, all payees (INR)", kpi(sources.payments, (p) => round2(p.payments.reduce((sum, row) => sum + (!row.voided && !row.held && row.status === "paid" ? (row.amountInr ?? 0) : 0), 0)))],
        // A held account's orders (D4) are listed but add nothing to any value.
        ["Order value (received)", kpi(orders, (list) => amountsText(sumByCurrency(list.filter((o) => !o.held), (o) => o.currency, (o) => o.orderValueCny)))],
        ["PO value (ordered)", kpi(orders, (list) => amountsText(sumByCurrency(list.filter((o) => !o.held), (o) => o.currency, (o) => o.poValueCny)))],
        // The supplier ledger accounts below zero (PAY-1's LED-2 totals), held accounts left out.
        ["Payable to suppliers", kpi(sources.payments, (p) => amountsText((p.totals ?? []).filter((t) => t.payableCny > 0).map((t) => ({ currency: t.currency, amount: t.payableCny }))))],
      ]),
      ...needs(d.orders, "Orders by stage", "Orders by Stage", (o) => [
        { sheet: "Orders by Stage", title: "Orders by stage", columns: [text("Stage"), text("Orders")], rows: o.byStage.map((s) => [`${s.stage}. ${STAGES[s.stage - 1]}`, s.count]) },
      ]),
      ...needs(d.deliveries, "Late and upcoming deliveries", "Deliveries", (x) => [
        { sheet: "Deliveries", title: "Late and upcoming deliveries", columns: [text("PO"), text("Supplier"), date("Due"), text("Status")], rows: x.rows.map((r) => [r.po, r.supplier, r.due, r.status]) },
      ]),
      ...needs(d.paymentsDue, "Payments due", "Payments Due", (p) =>
        perCurrency(p.rows).map(([currency, list]) => ({
          sheet: "Payments Due",
          title: `Payments due in the next ${p.windowDays} days (${currency})`,
          columns: [date("Due"), text("PO"), text("Payee"), text("Payment type"), money("Amount", currency)],
          rows: list.map((r) => [r.due, r.po, r.payee, r.payment, r.amountCny]),
        })),
      ),
      ...needs(d.containers, "Containers on the way", "Containers", (c) => [
        { sheet: "Containers", title: "Containers on the way", columns: [text("Container"), text("Shipping agent"), text("Terms"), date("ETA India")], rows: c.rows.map((r) => [r.container, r.agent, r.terms, r.etaIndia]) },
      ]),
      ...needs(orders, "Supplier summary", "Suppliers", (list) => {
        const lines = [...new Set(list.map((o) => `${o.supplier.id}|${o.currency}`))].map((key) => {
          const mine = list.filter((o) => `${o.supplier.id}|${o.currency}` === key);
          return {
            supplier: mine[0]!.supplier.name,
            currency: mine[0]!.currency,
            orders: mine.length,
            active: mine.filter((o) => o.stage < 6).length,
            // Null while the account is held (D4), as settled and outstanding: no figure, never a made-up value.
            value: mine.some((o) => o.held) ? null : round2(mine.reduce((sum, o) => sum + o.orderValueCny, 0)),
            poValue: mine.some((o) => o.held) ? null : round2(mine.reduce((sum, o) => sum + o.poValueCny, 0)),
            // The FIFO settlement; null while the account is held or an order is not posted (no figure, never a made-up 0).
            settled: mine.some((o) => o.settledCny === null) ? null : round2(mine.reduce((sum, o) => sum + o.settledCny!, 0)),
            outstanding: mine.some((o) => o.outstandingCny === null) ? null : round2(mine.reduce((sum, o) => sum + o.outstandingCny!, 0)),
          };
        });
        return perCurrency(lines).map(([currency, rows]) => ({
          sheet: "Suppliers",
          title: `Supplier summary (${currency} orders)`,
          columns: [text("Supplier"), text("Orders"), text("Active orders"), money("PO value", currency), money("Order value (received)", currency), money("Settled", currency), money("Outstanding", currency)],
          rows: rows.map((r) => [r.supplier, r.orders, r.active, r.poValue, r.value, r.settled, r.outstanding]),
        }));
      }),
    ],
  };
}
