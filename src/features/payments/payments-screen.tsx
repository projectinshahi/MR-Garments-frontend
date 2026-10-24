import { KpiCard, KpiRow } from "@/components/shared/cards";
import { formatINR, formatShortDate } from "@/lib/formatters";

import type { PaymentsData } from "./data/queries";
import { PaymentDetailCard } from "./payment-detail";
import { PaymentsView } from "./payments-view";

const payments = (count: number) => `${count} payment${count === 1 ? "" : "s"}`;

/** Deposits & Payments (16_5_Deposits_&_Payments.jpeg): KPI row, payments by order, and PO-2041's payment detail. */
export function PaymentsScreen({ data }: { data: PaymentsData }) {
  const { kpis, orders, detail } = data;

  return (
    <PaymentsView
      orders={orders}
      selectedPo={detail.po}
      kpis={
        <KpiRow gap="sm">
          <KpiCard
            size="xs"
            label="Paid so far (INR)"
            value={formatINR(kpis.paidSoFar)}
            sub={`across ${kpis.openOrders} open orders`}
          />
          <KpiCard
            size="xs"
            label="Due in next 7 days"
            value={formatINR(kpis.dueNext7Days)}
            sub={`${payments(kpis.dueNext7Count)} · ${kpis.dueNext7First.po} on ${formatShortDate(kpis.dueNext7First.due)}`}
          />
          <KpiCard
            size="xs"
            label="Due in next 30 days"
            value={formatINR(kpis.dueNext30Days)}
            sub={payments(kpis.dueNext30Count)}
          />
        </KpiRow>
      }
      detail={<PaymentDetailCard detail={detail} />}
    />
  );
}
