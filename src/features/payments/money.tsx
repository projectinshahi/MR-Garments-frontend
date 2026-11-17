import { StatusPill } from "@/components/shared/status-pill";
import type { DepositStatus } from "@/lib/api/types";
import { formatMoney } from "@/lib/formatters";
import type { Currency, Tone } from "@/types/domain";

// The payee rules as the API states them (backend docs/phase2-fixes.md 1 and 2): `paidCny`/`paidInr` count every
// payee, `supplierPaidCny`/`supplierPaidInr` the supplier only, and the balance is what the supplier is still owed.
// Agent payments are sea freight: the difference between the two.

export const round2 = (value: number) => Math.round(value * 100) / 100;

/** Paid to shipping agents (sea freight): every paid payment less the supplier's, in the same currency; null while the supplier figure is unknown. */
export const agentPaid = (paid: number, supplierPaid: number | null | undefined) => (supplierPaid == null ? null : round2(paid - supplierPaid));

/**
 * A money figure the API may not have sent yet (a frontend deployed before the migrated backend): "–" instead of a number
 * that would be wrong under the new label (the old `balanceCny` counted every payee). Never a silent fallback.
 */
export const DASH = "–";
export const moneyOrDash = (value: number | null | undefined, show: (value: number) => string) => (value == null ? DASH : show(value));

/** The order's deposit against what the supplier asked for (0009). Proposed wording; "none" is never shown as a pill. */
export const DEPOSIT_STATUS: Record<DepositStatus, { label: string; tone: Tone }> = {
  none: { label: "No deposit agreed", tone: "neutral" },
  due: { label: "Deposit due", tone: "warning" },
  partly: { label: "Deposit partly paid", tone: "info" },
  paid: { label: "Deposit paid", tone: "success" },
};

export function DepositStatusPill({ status, className }: { status: DepositStatus | undefined; className?: string }) {
  // An unknown or missing status (an older API) shows nothing rather than throwing.
  const style = status === undefined ? undefined : DEPOSIT_STATUS[status];
  if (!style) return null;
  const { label, tone } = style;
  return (
    <StatusPill tone={tone} className={className}>
      {label}
    </StatusPill>
  );
}

/**
 * A "Paid to supplier" cell: the supplier payments, with the supplier advance applied to the order on a second line
 * when there is one (backend docs/supplier-advance.md). The advance is not a payment and is never added into the figure;
 * the balance beside it counts both. `paid` null (an older API) shows a dash.
 */
export function PaidWithAdvance({ paid, advance, currency }: { paid: number | null; advance: number | undefined; currency: Currency }) {
  const money = (value: number) => formatMoney(value, currency, { decimals: 2 });
  return (
    <>
      {moneyOrDash(paid, money)}
      {advance ? <span className="block text-xs whitespace-nowrap text-muted-foreground">+ {money(advance)} advance</span> : null}
    </>
  );
}
