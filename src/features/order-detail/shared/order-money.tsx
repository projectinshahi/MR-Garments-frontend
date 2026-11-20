import Link from "next/link";

import { Callout, SectionCard } from "@/components/shared/cards";
import { KeyValueList } from "@/components/shared/key-value-list";
import type { OrderView } from "@/features/order-detail/data/queries";
import { BalanceFigure, HELD_BALANCE, HELD_MESSAGE, MilestonePill, moneyOrDash, PaymentStatusPill } from "@/features/payments/money";
import { ledgerHref } from "@/features/supplier-ledger/ledger-logic";
import { formatINR, formatMoney } from "@/lib/formatters";

// The order's money after the unified supplier ledger (ORD-4), shared by the Overview and Payments tabs: the order's
// value, what the supplier's account settled of it (FIFO, oldest order first), what is outstanding (never negative), the
// payment status, the Deposit Required milestone, sea freight paid to agents, and the supplier's signed balance beside
// them. Every figure is the API's; a held account shows the review note instead.

type Order = Pick<
  OrderView,
  | "currency"
  | "orderValueCny"
  | "held"
  | "settledCny"
  | "outstandingCny"
  | "paymentStatus"
  | "depositRequiredCny"
  | "depositSettledCny"
  | "depositPendingCny"
  | "depositStatus"
  | "agentPaidCny"
  | "agentPaidInr"
  | "paidInr"
  | "supplierAccount"
  | "supplier"
>;

/** Value, settled, outstanding with the status, the Deposit Required milestone, sea freight and INR paid. */
export function OrderMoney({ order }: { order: Order }) {
  const money = (value: number | null) => moneyOrDash(value, (v) => formatMoney(v, order.currency, { decimals: 2 }));
  return (
    <>
      {order.held ? (
        <Callout tone="warning" size="sm" role="status" className="mt-3">
          {HELD_MESSAGE}
        </Callout>
      ) : null}
      <KeyValueList
        size="sm"
        className="mt-3"
        items={[
          { label: "Order value", value: money(order.orderValueCny) },
          { label: "Settled from supplier account", value: money(order.settledCny) },
          {
            label: (
              <>
                Outstanding <PaymentStatusPill status={order.paymentStatus} held={order.held} className="ml-1 align-middle" />
              </>
            ),
            value: money(order.outstandingCny),
          },
          ...(order.depositRequiredCny == null
            ? []
            : [
                {
                  label: (
                    <>
                      Deposit required {money(order.depositRequiredCny)} <MilestonePill status={order.depositStatus} className="ml-1 align-middle" />
                    </>
                  ),
                  value: `${money(order.depositPendingCny)} pending`,
                },
              ]),
          ...(order.agentPaidCny ? [{ label: `Sea freight to agents ${money(order.agentPaidCny)}`, value: moneyOrDash(order.agentPaidInr, formatINR) }] : []),
          { label: "Paid (INR), goods + sea freight", value: moneyOrDash(order.paidInr, formatINR) },
        ]}
      />
    </>
  );
}

/** The supplier's account in the order's currency: its signed balance, open orders and a link to the ledger. */
export function SupplierAccountCard({ order, linked = true }: { order: Order; linked?: boolean }) {
  const account = order.supplierAccount;
  if (!account) return null;
  return (
    <SectionCard
      title="Supplier account"
      aside={
        linked ? (
          <Link href={ledgerHref(account.supplierId)} className="text-[13px] font-bold text-primary hover:underline">
            Open ledger
          </Link>
        ) : null
      }
      titleGap="none"
    >
      <p className="mt-3 text-[13px] text-muted-foreground">
        {order.supplier.name} · {account.currency}
      </p>
      <p className="mt-1 text-[22px] leading-7 font-bold">{account.held ? HELD_BALANCE : <BalanceFigure balance={account.balanceCny} currency={account.currency} />}</p>
      {account.held ? null : (
        <p className="mt-2 text-[13px] text-muted-foreground">
          {account.openOrders} open order{account.openOrders === 1 ? "" : "s"} · {moneyOrDash(account.outstandingCny, (v) => formatMoney(v, account.currency, { decimals: 2 }))} outstanding
        </p>
      )}
    </SectionCard>
  );
}
