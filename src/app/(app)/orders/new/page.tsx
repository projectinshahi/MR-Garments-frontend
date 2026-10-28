import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/states";
import { hasAccess } from "@/config/navigation";
import { getNewOrder } from "@/features/order-form/data/queries";
import { NewOrderScreen } from "@/features/order-form/new-order-screen";
import { MESSAGES } from "@/lib/feedback";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "New order" };

export default async function NewOrderPage() {
  const me = await getMe();
  if (!me || !hasAccess(me, "ordersEdit", "Enter")) {
    // Viewers can open Orders but ORD-3 would refuse them, so they get no form.
    return (
      <>
        <PageHeader title="New order" parent={{ label: "Orders", href: "/orders" }} />
        <PageContainer>
          <EmptyState title={MESSAGES.noAccess} />
        </PageContainer>
      </>
    );
  }
  const data = await getNewOrder();
  // A new key after each placed order (the next PO changes) remounts the form empty, although the route stays mounted.
  return <NewOrderScreen key={data.options.nextPo} data={data} />;
}
