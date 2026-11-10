import { CalendarDays, FileText, ShoppingCart, Truck, Users } from "lucide-react";

import { KpiCard, KpiRow } from "@/components/shared/cards";
import type { SuppliersSummary } from "@/lib/api/suppliers-types";
import { formatNumber } from "@/lib/formatters";

import { moneyText } from "./suppliers-logic";

/**
 * The five cards over the Suppliers tabs (SUP-1), as the reference draws them: icon left in a tinted square, the
 * label beside it, the value and a sub-line under it. Five across from xl, two or three per row below, one on a phone.
 */
export function SupplierKpis({ summary }: { summary: SuppliersSummary }) {
  const { suppliers, openPos, inTransit, unpaid, upcomingPayments } = summary;
  return (
    <KpiRow gap="sm" className="grid-cols-1 sm:grid-cols-2 md:grid-flow-row md:grid-cols-3 xl:grid-cols-5">
      <KpiCard
        size="sm"
        icon={<Users />}
        tint="info"
        label="Total Suppliers"
        value={formatNumber(suppliers.total)}
        sub={`Active: ${formatNumber(suppliers.active)} · Inactive: ${formatNumber(suppliers.inactive)}`}
      />
      <KpiCard size="sm" icon={<ShoppingCart />} tint="success" label="Open POs" value={formatNumber(openPos.count)} sub={`PO value: ${moneyText(openPos.value)}`} />
      <KpiCard size="sm" icon={<Truck />} tint="warning" label="In Transit" value={formatNumber(inTransit.orders)} sub={`Est. arrivals: ${formatNumber(inTransit.arrivingNext7)}`} />
      <KpiCard size="sm" icon={<FileText />} tint="danger" label="Unpaid Amount" value={moneyText(unpaid.amount)} sub={`Across ${formatNumber(unpaid.suppliers)} supplier${unpaid.suppliers === 1 ? "" : "s"}`} />
      <KpiCard size="sm" icon={<CalendarDays />} tint="info" label="Upcoming Payments" value={moneyText(upcomingPayments.amount)} sub={`Next ${upcomingPayments.windowDays} days`} />
    </KpiRow>
  );
}
