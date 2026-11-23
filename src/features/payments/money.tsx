import { StatusPill } from "@/components/shared/status-pill";
import type { PaymentRow } from "@/lib/api/ledger-types";
import type { MilestoneStatus, PaymentStatus as OrderPaymentStatus } from "@/lib/api/types";
import { formatMoney, formatShortDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { Currency, Tone } from "@/types/domain";

// Money wording of the unified supplier ledger (backend docs/unified-ledger.md), shared by Payments, the Supplier
// ledger, the orders lists and the order pages. A supplier account's balance is signed: positive is money available
// with the supplier, zero is settled, negative is payable to the supplier. An order's settled, outstanding and payment
// status are the API's FIFO projection; the Deposit Required is a milestone, never a balance. Currencies are never added.

export const round2 = (value: number) => Math.round(value * 100) / 100;
/** Voided payments are listed, flagged, and every total leaves them out. Here, not in data/queries.ts, so client code can import it. */
/** The payments that count in totals: not voided, and not in a held account (D4: listed, counted nowhere). */
export const live = <T extends Pick<PaymentRow, "voided"> & { held?: boolean }>(payments: T[]) => payments.filter((p) => !p.voided && !p.held);

/** A money figure the API sent as null (held account, not posted, no payments View): "–", never a made-up 0. */
export const DASH = "–";
export const moneyOrDash = (value: number | null | undefined, show: (value: number) => string) => (value == null ? DASH : show(value));

/** D4: a held account (SUP-010 CNY) has no figures and counts in no total. The API's own 409 message. */
export const HELD_MESSAGE = "This supplier's account is pending review.";
export const HELD_BALANCE = "Opening balance pending review";

/** The label of a signed balance: + available with the supplier, 0 settled, − payable to the supplier. */
export const balanceLabel = (balance: number) => (balance > 0 ? "Available with supplier" : balance < 0 ? "Payable to supplier" : "Settled");
export const balanceTone = (balance: number): Tone => (balance > 0 ? "success" : balance < 0 ? "danger" : "neutral");
/** "Payable to supplier ¥1,200.50", "Settled": the label and the amount without its sign (the label says which way). */
export const balanceText = (balance: number, currency: Currency) =>
  balance === 0 ? balanceLabel(0) : `${balanceLabel(balance)} ${formatMoney(Math.abs(balance), currency, { decimals: 2 })}`;

/** A balance figure: the amount without its sign, the label under it (or beside it, `inline`); held shows the review note. */
export function BalanceFigure({ balance, currency, held = false, inline = false, className }: { balance: number | null; currency: Currency; held?: boolean; inline?: boolean; className?: string }) {
  if (held || balance === null) return <span className={cn("text-muted-foreground", className)}>{held ? HELD_BALANCE : DASH}</span>;
  if (balance === 0) return <span className={cn("text-muted-foreground", className)}>{balanceLabel(0)}</span>;
  return (
    <span className={className}>
      {formatMoney(Math.abs(balance), currency, { decimals: 2 })}
      <span className={cn(inline ? "ml-1.5" : "block", "text-xs font-normal", balance > 0 ? "text-success" : "text-danger")}>{balanceLabel(balance)}</span>
    </span>
  );
}

/**
 * The order's FIFO payment status (API `paymentStatus`); null (held, not posted) shows nothing. "Awaiting goods":
 * nothing received yet, so nothing is due (its value is received quantity × rate).
 */
export const PAYMENT_STATUS: Record<OrderPaymentStatus, { label: string; tone: Tone }> = {
  awaiting_goods: { label: "Awaiting goods", tone: "neutral" },
  unpaid: { label: "Unpaid", tone: "neutral" },
  partly: { label: "Partly paid", tone: "warning" },
  paid: { label: "Paid", tone: "success" },
};
export function PaymentStatusPill({ status, held = false, className }: { status: OrderPaymentStatus | null | undefined; held?: boolean; className?: string }) {
  if (held) return <StatusPill tone="neutral" className={className}>Pending review</StatusPill>;
  const style = status ? PAYMENT_STATUS[status] : undefined;
  return style ? <StatusPill tone={style.tone} className={className}>{style.label}</StatusPill> : <span className={className}>{DASH}</span>;
}

/** The Deposit Required milestone (D11). "none" is never shown as a pill. */
export const MILESTONE_STATUS: Record<MilestoneStatus, { label: string; tone: Tone }> = {
  none: { label: "No deposit required", tone: "neutral" },
  unmet: { label: "Deposit not met", tone: "warning" },
  partly: { label: "Deposit partly met", tone: "info" },
  met: { label: "Deposit met", tone: "success" },
};
export function MilestonePill({ status, className }: { status: MilestoneStatus | null | undefined; className?: string }) {
  if (!status || status === "none") return null;
  const { label, tone } = MILESTONE_STATUS[status];
  return (
    <StatusPill tone={tone} className={className}>
      {label}
    </StatusPill>
  );
}

/** A payment's status: Voided (with its reason as the title), Pending review (a held account, D4), Paid, or Due. */
export function PaymentStatus({ payment }: { payment: Pick<PaymentRow, "voided" | "voidReason" | "status" | "dueDate"> & { held?: boolean } }) {
  if (payment.voided) return <StatusPill tone="danger" title={payment.voidReason || undefined}>Voided</StatusPill>;
  if (payment.held) return <StatusPill tone="neutral" title={HELD_MESSAGE}>Pending review</StatusPill>;
  if (payment.status === "paid") return <StatusPill tone="success">Paid</StatusPill>;
  return <StatusPill tone="warning">{payment.dueDate ? `Due ${formatShortDate(payment.dueDate)}` : "Due"}</StatusPill>;
}

/** "Payment" (to the supplier's account), or a legacy / sea freight row's Deposit or Balance. */
export const paymentType = (p: Pick<PaymentRow, "kind" | "payeeRole">) => (p.payeeRole === "agent" ? `Sea freight · ${p.kind}` : p.kind === "Payment" ? "Supplier payment" : `${p.kind} (legacy)`);
