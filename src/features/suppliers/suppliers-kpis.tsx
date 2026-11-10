import { CalendarClock, ClipboardList, Factory, Ship, Wallet } from "lucide-react";

import { KpiCard, KpiRow } from "@/components/shared/cards";
import type { SuppliersSummary } from "@/lib/api/suppliers-types";
import { formatNumber, formatShortDate } from "@/lib/formatters";

import { moneyText } from "./suppliers-logic";

const plural = (count: number, noun: string) => `${formatNumber(count)} ${noun}${count === 1 ? "" : "s"}`;

/** The five cards over the Suppliers tabs (SUP-1): five across from xl, two or three per row below, one on a phone. */
export function SupplierKpis({ summary }: { summary: SuppliersSummary }) {
  const { suppliers, openPos, inTransit, unpaid, upcomingPayments } = summary;
  const arrivals = inTransit.nextEta
    ? `next arrival ${formatShortDate(inTransit.nextEta)}${inTransit.arrivingNext7 ? `, ${plural(inTransit.arrivingNext7, "container")} this week` : ""}`
    : inTransit.orders
      ? "no arrival date yet"
      : "nothing on the way";
  return (
    <KpiRow gap="sm" className="grid-cols-1 sm:grid-cols-2 md:grid-flow-row md:grid-cols-3 xl:grid-cols-5">
      <KpiCard size="sm" icon={<Factory />} tint="info" label="Total Suppliers" value={formatNumber(suppliers.total)} sub={`${formatNumber(suppliers.active)} active, ${formatNumber(suppliers.inactive)} inactive`} />
      <KpiCard size="sm" icon={<ClipboardList />} tint="purple" label="Open POs" value={formatNumber(openPos.count)} sub={`worth ${moneyText(openPos.value)}`} />
      <KpiCard size="sm" icon={<Ship />} tint="warning" label="In Transit" value={formatNumber(inTransit.orders)} sub={arrivals} />
      <KpiCard size="sm" icon={<Wallet />} tint="danger" label="Unpaid Amount" value={moneyText(unpaid.amount)} sub={`${plural(unpaid.suppliers, "supplier")} with a balance`} />
      <KpiCard
        size="sm"
        icon={<CalendarClock />}
        tint="success"
        label="Upcoming Payments"
        value={moneyText(upcomingPayments.amount)}
        sub={`${plural(upcomingPayments.count, "payment")} due in next ${upcomingPayments.windowDays} days`}
      />
    </KpiRow>
  );
}
