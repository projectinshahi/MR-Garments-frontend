import { Callout, SectionCard } from "@/components/shared/cards";
import { KeyValueList } from "@/components/shared/key-value-list";
import { StatusPill } from "@/components/shared/status-pill";
import { ADVANCE_KIND_LABEL, ADVANCE_STATUS_LABEL, ADVANCE_STATUS_TONE, signedAdvance } from "@/features/deposits/advance-logic";
import { ApplyAdvanceButton } from "@/features/deposits/apply-advance";
import type { OrderView } from "@/features/order-detail/data/queries";
import { formatDate, formatINR, formatMoney, rateText } from "@/lib/formatters";

// The order's supplier advance (backend docs/supplier-advance.md) on the Overview and Payments tabs: what the order
// costs, how much of it the supplier's advance account covered, what was paid directly, and what is left. The advance is
// money the supplier already had; it is never shown inside the direct payments. Nothing renders against an older API.

type Order = Pick<
  OrderView,
  "po" | "orderValueCny" | "supplierPaidCny" | "advanceCny" | "advanceStatus" | "balanceCny" | "currency" | "advanceEntries" | "advanceInr" | "advanceAvailableCny"
>;

/** The order with an advance status the API sent; null against an older API. */
const known = (order: Order) => (order.advanceStatus === undefined || order.supplierPaidCny == null ? null : { ...order, advanceCny: order.advanceCny ?? 0, advanceStatus: order.advanceStatus });

/** The warning when the supplier's advance covered only part of the order and something is still to be paid. */
export function PartialAdvanceWarning({ order }: { order: Order }) {
  const o = known(order);
  if (!o || o.advanceStatus !== "partial") return null;
  const money = (value: number) => formatMoney(value, o.currency, { decimals: 2 });
  return (
    <Callout tone="warning" size="sm" role="status">
      <strong>Supplier advance was not enough.</strong> It covered {money(o.advanceCny)} of this {money(o.orderValueCny)} order; {money(o.balanceCny)} is still to be paid
      to the supplier.
    </Callout>
  );
}

/**
 * Order total, advance from the supplier account, direct payments, remaining, and the allocation status. With `canApply`
 * (payments Enter), an order still owing while the supplier has advance available (one recorded after the order was
 * placed) offers Apply advance (ADV-4).
 */
export function AdvanceBreakdown({ order, className, canApply = false }: { order: Order; className?: string; canApply?: boolean }) {
  const o = known(order);
  if (!o) return null;
  const money = (value: number) => formatMoney(value, o.currency, { decimals: 2 });
  const available = o.advanceAvailableCny ?? 0;
  return (
    <SectionCard title="Supplier advance" aside={<StatusPill tone={ADVANCE_STATUS_TONE[o.advanceStatus]}>{ADVANCE_STATUS_LABEL[o.advanceStatus]}</StatusPill>} titleGap="none" className={className}>
      <KeyValueList
        size="sm"
        className="mt-3"
        boldValues
        items={[
          { label: "Order total", value: money(o.orderValueCny) },
          { label: "Advance from supplier account", value: money(o.advanceCny) },
          { label: "Direct payments to supplier", value: money(o.supplierPaidCny!) },
        ]}
        total={{ label: "Remaining to pay", value: money(o.balanceCny) }}
      />
      {canApply && o.balanceCny > 0 && available > 0 ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <p className="text-sm text-muted-foreground">{money(available)} of supplier advance is available.</p>
          <ApplyAdvanceButton po={o.po} currency={o.currency} availableCny={available} balanceCny={o.balanceCny} />
        </div>
      ) : null}
    </SectionCard>
  );
}

/** Each allocation and reversal of the order: the advance it came from, its rate and INR (the landed cost's goods INR counts them). */
export function AdvanceEntriesCard({ order }: { order: Order }) {
  const entries = order.advanceEntries ?? [];
  if (entries.length === 0) return null;
  const money = (value: number) => formatMoney(value, order.currency, { decimals: 2 });
  return (
    <SectionCard title="Advance applied to this order" titleGap="none">
      <Callout size="sm" className="mt-3.5">
        The supplier advance is changed to INR at the rate the advance was paid at, not today&apos;s rate.
      </Callout>
      <KeyValueList
        size="sm"
        className="mt-3"
        boldValues
        items={entries.map((entry) => {
          const sign = signedAdvance(entry) < 0 ? "" : "−";
          return {
            label: `${formatDate(entry.entryDate)} · ${ADVANCE_KIND_LABEL[entry.kind]} · ${money(entry.amount)} at ${rateText(entry.currency, entry.exchangeRate)}${entry.advancePaidOn ? ` · advance of ${formatDate(entry.advancePaidOn)}` : ""}`,
            // One piece, so a reversal's sign never wraps away from its amount.
            value: <span className="whitespace-nowrap">{`${sign}${formatINR(entry.amountInr, 2)}`}</span>,
          };
        })}
        total={{ label: `Advance applied (${money(order.advanceCny ?? 0)}) in INR`, value: formatINR(order.advanceInr ?? 0, 2) }}
      />
    </SectionCard>
  );
}
