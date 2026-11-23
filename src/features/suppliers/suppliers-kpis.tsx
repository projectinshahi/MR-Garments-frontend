import { CalendarDays, FileText, ShoppingCart, Truck, Users } from "lucide-react";

import { KpiCard, KpiRow } from "@/components/shared/cards";
import type { SuppliersSummary } from "@/lib/api/suppliers-types";
import { formatNumber } from "@/lib/formatters";
import type { MoneyTotal } from "@/types/domain";

import { moneyText } from "./suppliers-logic";

/** formatMoneyList's separator between currencies. */
const SEPARATOR = " · ";

/** Money in several currencies, broken only after a "·" (a no-break space keeps it with the amount before it). */
const wrapping = (totals: MoneyTotal[]) => moneyText(totals).replaceAll(SEPARATOR, "\u00a0\u00b7 ");

/**
 * A card's money value in several currencies (30 px): one amount per line when they don't fit side by side, with the
 * separator only between amounts on the same line. Each amount carries its separator on its left, pulled into the gap;
 * the first one on a line falls left of the box and is clipped there (left side only, so a long amount still shows in
 * full). Screen readers get the plain text.
 */
function MoneyValue({ totals }: { totals: MoneyTotal[] }) {
  const text = moneyText(totals);
  const amounts = text.split(SEPARATOR);
  if (amounts.length < 2) return text;
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden className="flex flex-wrap gap-x-[0.9em] [clip-path:inset(-1em_-100vw_-1em_0)]">
        {amounts.map((amount) => (
          <span key={amount} className="-ml-[0.9em] whitespace-nowrap before:inline-block before:w-[0.9em] before:text-center before:content-['\00b7']">
            {amount}
          </span>
        ))}
      </span>
    </>
  );
}

/**
 * The five cards over the Suppliers tabs (SUP-1), as the reference draws them: icon left in a tinted square, the
 * label beside it, the value and a sub-line under it. Five across from 1440 px (the reference), three from 1024 px, two
 * from 640 px, one on a phone: narrower cards can't hold a 30 px amount or the one-line labels (owner, 2026-11-21).
 * 90rem (1440 px) in rem, so the rule sorts after lg (64rem); a px breakpoint would be emitted first and lose to it.
 */
export function SupplierKpis({ summary }: { summary: SuppliersSummary }) {
  const { suppliers, openPos, inTransit, unpaid, upcomingPayments } = summary;
  return (
    <KpiRow gap="sm" className="grid-cols-1 sm:grid-cols-2 md:grid-flow-row lg:grid-cols-3 min-[90rem]:grid-cols-5">
      <KpiCard
        size="sm"
        icon={<Users />}
        tint="info"
        label="Total Suppliers"
        value={formatNumber(suppliers.total)}
        sub={`Active: ${formatNumber(suppliers.active)} · Inactive: ${formatNumber(suppliers.inactive)}`}
      />
      <KpiCard
        size="sm"
        icon={<ShoppingCart />}
        tint="success"
        label="Open POs"
        value={formatNumber(openPos.count)}
        sub={
          <>
            {/* Several currencies wrap between amounts (each "·" stays with the amount before it), never past the card. */}
            {/* Open POs are mostly still to be delivered, so the card shows their PO value (ordered x rate); an older API has value only. */}
            <span className="whitespace-normal">PO value: {wrapping(openPos.poValue ?? openPos.value)}</span>
            {/* A held account's orders are in neither figure above: named apart. */}
            {openPos.heldCount > 0 ? (
              <span className="block whitespace-normal">
                {formatNumber(openPos.heldCount)} PO{openPos.heldCount === 1 ? "" : "s"} pending review, not counted
              </span>
            ) : null}
          </>
        }
      />
      <KpiCard size="sm" icon={<Truck />} tint="warning" label="In Transit" value={formatNumber(inTransit.orders)} sub={`Est. arrivals: ${formatNumber(inTransit.arrivingNext7)}`} />
      <KpiCard size="sm" icon={<FileText />} tint="danger" label="Unpaid Amount" value={<MoneyValue totals={unpaid.amount} />} sub={`Across ${formatNumber(unpaid.suppliers)} supplier${unpaid.suppliers === 1 ? "" : "s"}`} />
      <KpiCard size="sm" icon={<CalendarDays />} tint="info" label="Upcoming Payments" value={<MoneyValue totals={upcomingPayments.amount} />} sub={`Next ${upcomingPayments.windowDays} days`} />
    </KpiRow>
  );
}
