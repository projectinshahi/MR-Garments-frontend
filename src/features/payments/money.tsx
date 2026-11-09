import { StatusPill } from "@/components/shared/status-pill";
import type { DepositStatus } from "@/lib/api/types";
import type { Tone } from "@/types/domain";

// The payee rules as the API states them (backend docs/phase2-fixes.md 1 and 2): `paidCny`/`paidInr` count every
// payee, `supplierPaidCny`/`supplierPaidInr` the supplier only, and the balance is what the supplier is still owed.
// Agent payments are sea freight: the difference between the two.

export const round2 = (value: number) => Math.round(value * 100) / 100;

/** Paid to shipping agents (sea freight): every paid payment less the supplier's, in the same currency. */
export const agentPaid = (paid: number, supplierPaid: number) => round2(paid - supplierPaid);

/** The order's deposit against what the supplier asked for (0009). Proposed wording; "none" is never shown as a pill. */
export const DEPOSIT_STATUS: Record<DepositStatus, { label: string; tone: Tone }> = {
  none: { label: "No deposit agreed", tone: "neutral" },
  due: { label: "Deposit due", tone: "warning" },
  partly: { label: "Deposit partly paid", tone: "info" },
  paid: { label: "Deposit paid", tone: "success" },
};

export function DepositStatusPill({ status, className }: { status: DepositStatus; className?: string }) {
  const { label, tone } = DEPOSIT_STATUS[status];
  return (
    <StatusPill tone={tone} className={className}>
      {label}
    </StatusPill>
  );
}
