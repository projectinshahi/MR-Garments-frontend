import type { DollarCostTotal } from "@/lib/api/reports-types";
import { formatMoney } from "@/lib/formatters";

// Dollar Cost as the reports show it. The figure itself is the API's (backend orders/money.ts `dollarCost`): the order
// value (received quantity × rate) in USD at the rates saved on the order, null when it has no USD rate saved.

export const NO_USD_RATE = "No USD rate saved";

export const DOLLAR_COST_NOTE =
  "Dollar Cost is the order value (received quantity × rate) in USD: a USD order's value, 0 while nothing is received; an order in another currency at the two rates saved when it was placed (value × its INR rate ÷ the USD rate of that day). An order with no USD rate saved shows \"No USD rate saved\" and adds to no total; today's rate is never used for a past order.";

/** "$1,200" or "No USD rate saved". */
export const dollarCostText = (value: number | null) => (value === null ? NO_USD_RATE : formatMoney(value, "USD"));

/** A total: "$1,200", or what is missing ("No USD rate saved for 3 orders"). */
export const dollarCostTotalText = (total: DollarCostTotal) =>
  total.usd === null ? `${NO_USD_RATE} for ${total.missing} order${total.missing === 1 ? "" : "s"}` : formatMoney(total.usd, "USD");
