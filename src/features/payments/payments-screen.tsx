import { KpiCard, KpiRow } from "@/components/shared/cards";
import { formatINR, formatMoneyList, formatShortDate } from "@/lib/formatters";

import type { DueWindow, PaymentsScreenData } from "./data/queries";
import { PaymentsView } from "./payments-view";

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;
const payments = (count: number) => plural(count, "payment");

/** Payments (16_5, unified supplier ledger): KPI row, every payment, payments by order and the selected order's card. */
export function PaymentsScreen({ data }: { data: PaymentsScreenData }) {
  const { kpis, orders, payments: records, totals, defaultPo, agents, suppliers, linkPo, canVoid } = data;

  return (
    <PaymentsView
      orders={orders}
      payments={records}
      defaultPo={defaultPo}
      agents={agents}
      suppliers={suppliers}
      linkPo={linkPo}
      canVoid={canVoid}
      totals={totals}
      kpis={
        <KpiRow gap="sm">
          <KpiCard
            size="xs"
            label="Paid so far (INR)"
            value={formatINR(kpis.paidSoFarInr)}
            // Every payee, voided payments left out; one without a rate has no INR figure.
            sub={`${payments(kpis.paidCount)} · all payees${kpis.unrated ? ` · ${kpis.unrated} without rate` : ""}`}
          />
          {/* Per currency from the supplier accounts (held left out), never added together. */}
          <KpiCard size="xs" label="Payable to suppliers" value={formatMoneyList(kpis.payable)} sub="accounts below zero" />
          <KpiCard size="xs" label="Available with suppliers" value={formatMoneyList(kpis.available)} sub="accounts above zero" />
          <KpiCard size="xs" label="Due in next 30 days" value={formatMoneyList(kpis.dueNext30.amounts)} sub={dueSub(kpis.dueNext30)} />
        </KpiRow>
      }
    />
  );
}

const dueSub = ({ count, first }: DueWindow) => (first ? `${payments(count)} · ${first.po ?? "supplier"} on ${formatShortDate(first.due)}` : payments(count));
