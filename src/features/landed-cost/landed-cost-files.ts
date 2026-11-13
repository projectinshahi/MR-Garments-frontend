import { type Column, money, perCurrency, rate, type ReportFile, summarySection } from "@/features/reports/report-files";

import { convertPayments, costByTeam } from "./cost-math";
import type { LandedCostData, LandedCostRow } from "./data/queries";

// Landed Cost report download (backend docs/report-downloads.md): every order the page's supplier and team filters
// keep, with the figures of the one landed-cost engine (GET /landed-cost: goods = supplier payments at each payment's
// own rate, sea freight = shipping-agent payments on FOB orders, clearing and transport = their recorded charges),
// never recomputed here. The PO value and the rate saved on the order are shown beside them; their INR product is the
// PO at that rate, not part of the landed cost. One table per order currency, as the PO value is in it.

const text = (header: string): Column => ({ header });
const date = (header: string): Column => ({ header, date: true });
const inr = (header: string) => money(header, "INR");
const round2 = (value: number) => Math.round(value * 100) / 100;
const sum = (rows: LandedCostRow[], pick: (row: LandedCostRow) => number | null | undefined) => round2(rows.reduce((total, row) => total + (pick(row) ?? 0), 0));
const status = (row: LandedCostRow) => (row.final ? "Final" : `Estimate, waiting for ${row.waitingFor ?? "costs"}`);

export function landedCostFile(data: LandedCostData, filters: string, today: string): ReportFile {
  const { orders, kpis } = data;
  return {
    title: "Landed Cost",
    filename: `landed-cost-${today}`,
    filters,
    notes: [
      "Goods are the payments to the supplier, each in INR at the rate typed for that payment; the average rate is goods INR / goods paid. Sea freight is the shipping-agent payments of FOB orders.",
      "PO value in INR is the PO at the rate saved on the order (none for orders placed before rates were saved); it is not part of the landed cost.",
      "Insurance, GST and other expenses are not recorded, so the landed cost holds only the parts listed.",
    ],
    sections: [
      summarySection([
        ["Orders with costs", orders.length],
        ["Final orders", kpis.finishedPos.length],
        ["Total landed cost, final orders (INR)", kpis.finishedTotalInr],
        ["Pieces costed, final orders", kpis.finishedPieces],
        ["Still an estimate", kpis.estimatePos.length],
        ["Total landed cost, all orders shown (INR)", sum(orders, (row) => row.totalInr)],
      ]),
      ...perCurrency(orders).map(([currency, list]) => ({
        sheet: "Landed Cost",
        title: `Landed cost by order (${currency} orders)`,
        columns: [
          text("PO"),
          date("Order date"),
          text("Supplier"),
          text("Main item"),
          text("Terms"),
          money("PO value", currency),
          rate("Rate saved on order", currency),
          inr("PO value at saved rate"),
          money("Goods paid", currency),
          rate("Average payment rate", currency),
          inr("Goods"),
          inr("Sea freight"),
          inr("Customs and clearing"),
          inr("Transport"),
          inr("Total landed cost"),
          text("Received pieces (stocked)"),
          inr("Landed cost per piece"),
          text("Status"),
        ],
        rows: list.map((row) => {
          const goods = convertPayments(row.goodsPayments);
          return [
            row.po,
            row.orderDate ?? null,
            row.supplier.name,
            row.item,
            row.terms === "mixed" ? "Mixed" : row.terms,
            row.orderValueCny ?? null,
            row.exchangeRate ?? null,
            row.orderValueCny !== undefined && row.exchangeRate != null ? round2(row.orderValueCny * row.exchangeRate) : null,
            round2(goods.totalCny),
            goods.totalCny ? Math.round(goods.averageRate * 10_000) / 10_000 : null,
            row.goodsInr,
            row.seaFreightInr,
            row.clearingInr,
            row.transportInr,
            row.totalInr,
            row.stockedPieces,
            row.perPieceInr,
            status(row),
          ];
        }),
        total: list.length
          ? [
              "Total",
              null,
              null,
              null,
              null,
              sum(list, (row) => row.orderValueCny),
              null,
              null,
              sum(list, (row) => convertPayments(row.goodsPayments).totalCny),
              null,
              sum(list, (row) => row.goodsInr),
              sum(list, (row) => row.seaFreightInr),
              sum(list, (row) => row.clearingInr),
              sum(list, (row) => row.transportInr),
              sum(list, (row) => row.totalInr),
              list.reduce((total, row) => total + row.stockedPieces, 0),
              null,
              null,
            ]
          : undefined,
      })),
      ...perCurrency(orders.flatMap((row) => row.goodsPayments.map((payment) => ({ ...payment, po: row.po, supplier: row.supplier.name, currency: row.currency })))).map(
        ([currency, list]) => ({
          sheet: "Goods Payments",
          title: `Goods payments (${currency})`,
          columns: [text("PO"), text("Supplier"), date("Paid on"), text("Payment type"), money("Amount", currency), rate("Exchange rate", currency), inr("INR")],
          rows: list.map((p) => [p.po, p.supplier, p.paidOn, p.kind, p.amountCny, p.rateInr, p.amountInr]),
        }),
      ),
      {
        sheet: "By Team",
        title: "Landed cost by team",
        columns: [text("Team"), text("Pieces"), inr("Landed cost"), inr("Per piece")],
        rows: costByTeam(orders, data.teams, data.teamId).map((team) => [team.team, team.pieces, round2(team.costInr), team.perPieceInr === null ? null : round2(team.perPieceInr)]),
      },
    ],
  };
}
