import { PageContainer } from "@/components/layout/page-header";
import { SectionCard } from "@/components/shared/cards";
import { KeyValueList } from "@/components/shared/key-value-list";
import type { OrderView } from "@/features/order-detail/data/queries";
import { OrderContextStrip } from "@/features/order-detail/shared/order-detail-frame";
import { formatDate } from "@/lib/formatters";

import { ItemsTable } from "./items-table";

/**
 * Order detail, tab b (07_3.1.b_Items.jpeg) from ORD-4: the order lines on the left, the order's facts on the right.
 * Nothing records colour/style, bundles, sizes, terms or notes per order, so those parts are left out.
 */
export function ItemsScreen({ order }: { order: OrderView }) {
  const { supplier } = order;
  return (
    <PageContainer>
      <OrderContextStrip order={order} fact={`Order date ${formatDate(order.orderDate)}`} />
      <div className="grid gap-(--page-gap) lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-(--page-gap)">
          <SectionCard title="Items ordered" bottomGap="tight">
            <ItemsTable lines={order.lines} />
          </SectionCard>
        </div>

        <div className="flex min-w-0 flex-col gap-(--page-gap)">
          <SectionCard title="Order terms" titleGap="none">
            <KeyValueList
              className="mt-3"
              boldValues
              items={[
                { label: "Supplier", value: supplier.name },
                ...[
                  { label: "Contact", value: supplier.contactPerson },
                  { label: "Phone", value: supplier.phone },
                  { label: "City", value: supplier.city },
                ].filter((row) => row.value),
                { label: "Order date", value: formatDate(order.orderDate) },
                { label: "Delivery date", value: formatDate(order.deliveryDate) },
                { label: "Currency", value: "¥ Chinese yuan" },
              ]}
            />
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  );
}
