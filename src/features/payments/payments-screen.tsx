import { KpiCard, KpiRow } from "@/components/shared/cards";
import { formatINR, formatMoneyList, formatShortDate } from "@/lib/formatters";

import type { DueWindow, PaymentsScreenData } from "./data/queries";
import { PaymentsView } from "./payments-view";

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;
const payments = (count: number) => plural(count, "payment");

/** Deposits & Payments (16_5_Deposits_&_Payments.jpeg): KPI row, payments by order, and the selected order's payments. */
export function PaymentsScreen({ data }: { data: PaymentsScreenData }) {
  const { kpis, orders, payments: records, defaultPo, agents, linkPo, canDelete } = data;

  return (
    <PaymentsView
      orders={orders}
      payments={records}
      defaultPo={defaultPo}
      agents={agents}
      linkPo={linkPo}
      canDelete={canDelete}
      kpis={
        <KpiRow gap="sm">
          <KpiCard
            size="xs"
            label="Paid so far (INR)"
            value={formatINR(kpis.paidSoFarInr)}
            // Every payee (phase 2 fixes, 1): agent payments are sea freight, but they left the company for the order.
            sub={`across ${plural(kpis.paidOrders, "order")} · all payees`}
          />
          {/* Due payments have no INR rate until paid (PAY-1): each currency's amount, never added together. */}
          <KpiCard size="xs" label="Due in next 7 days" value={formatMoneyList(kpis.dueNext7.amounts)} sub={dueSub(kpis.dueNext7)} />
          <KpiCard
            size="xs"
            label="Due in next 30 days"
            value={formatMoneyList(kpis.dueNext30.amounts)}
            sub={payments(kpis.dueNext30.count)}
          />
        </KpiRow>
      }
    />
  );
}

const dueSub = ({ count, first }: DueWindow) =>
  first ? `${payments(count)} · ${first.po} on ${formatShortDate(first.due)}` : payments(count);
