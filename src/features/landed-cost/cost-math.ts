import type { GoodsPayment, OrderCostRow } from "./data/queries";

/** An order's cost is final once every bill is in; until then it is an estimate. */
export const isFinal = (row: OrderCostRow) => row.duty !== null && row.transport !== null;

/** Landed cost in INR: everything entered so far. */
export const landedCost = (row: OrderCostRow) => row.purchase + row.seaFreight + (row.duty ?? 0) + (row.transport ?? 0);

/** KPI figures: finished orders' total landed cost and pieces, and the orders still estimated. */
export function summarizeOrders(rows: OrderCostRow[]) {
  const finished = rows.filter(isFinal);
  return {
    finishedTotal: finished.reduce((sum, row) => sum + landedCost(row), 0),
    finishedPieces: finished.reduce((sum, row) => sum + row.qty, 0),
    finishedPOs: finished.map((row) => row.po),
    estimatePOs: rows.filter((row) => !isFinal(row)).map((row) => row.po),
  };
}

/** Share of the total per part, to one decimal place ("71.2%"). */
export function shareOfTotal(values: number[]) {
  const total = values.reduce((sum, value) => sum + value, 0);
  return { total, percents: values.map((value) => (total ? Math.round((value / total) * 1000) / 10 : 0)) };
}

/** Each payment is changed to INR at its own date's rate; the average rate is total INR over total yuan. */
export function convertPayments(payments: GoodsPayment[]) {
  const rows = payments.map((payment) => ({ ...payment, amountInr: payment.amountCny * payment.rate }));
  const totalCny = rows.reduce((sum, row) => sum + row.amountCny, 0);
  const totalInr = rows.reduce((sum, row) => sum + row.amountInr, 0);
  return { rows, totalCny, totalInr, averageRate: totalCny ? totalInr / totalCny : 0 };
}
