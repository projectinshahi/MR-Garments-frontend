import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { RouteTabs, type RouteTab } from "@/components/layout/route-tabs";
import { LoadingState } from "@/components/shared/states";
import { StatusPill } from "@/components/shared/status-pill";
import { getOrderDetail, type OrderView } from "@/features/order-detail/data/queries";
import { OrderDetailActions } from "@/features/order-detail/shared/order-detail-actions";
import { getActiveItems } from "@/features/orders/data/queries";
import { isEditableStage, orderPermissions } from "@/features/orders/order-permissions";
import { getMe } from "@/lib/session";

// Clearing & transport, Warehouse, Cost and History are hidden: ORD-4 has no per-order section for them yet (the stage
// screens record clearing, transport and warehouse per container since wave 3).
// Payments, Receiving and Containers show only when ORD-4 gives the section (the user may view it).
const TABS: { segment: string; label: string; chip: string; section?: "payments" | "receipts" | "containers" }[] = [
  { segment: "", label: "Overview", chip: "a" },
  { segment: "/items", label: "Items", chip: "b" },
  { segment: "/payments", label: "Deposits & payments", chip: "c", section: "payments" },
  { segment: "/receiving", label: "Receiving", chip: "d", section: "receipts" },
  { segment: "/containers", label: "Containers", chip: "e", section: "containers" },
];

/**
 * Header ("Orders / PO-2028", with Delete and Edit order for those allowed; Print order stays hidden, D5) and the tabs this user may
 * open, shared by the order-detail tabs.
 */
export async function OrderDetailFrame({ params, children }: { params: Promise<{ po: string }>; children: React.ReactNode }) {
  const { po } = await params;
  const [order, me] = await Promise.all([getOrderDetail(po), getMe()]);
  if (!order) notFound();
  const permissions = orderPermissions(me);
  const canEdit = permissions.canEdit && isEditableStage(order.stage);
  // Only an editor needs the item choices (ORD-2).
  const items = canEdit ? await getActiveItems() : [];
  const { stage, orderDate, deliveryDate, paidCny, lines } = order;
  const tabs: RouteTab[] = TABS.filter((tab) => !tab.section || order[tab.section] !== null).map((tab) => ({
    href: `/orders/${order.po}${tab.segment}`,
    label: tab.label,
    chip: tab.chip,
  }));

  return (
    <>
      <PageHeader
        title={order.po}
        parent={{ label: "Orders", href: "/orders" }}
        actions={
          <OrderDetailActions
            order={{ po: order.po, stage, orderDate, deliveryDate, paidCny, lines }}
            supplier={order.supplier.name}
            items={items}
            canEdit={canEdit}
            canDelete={permissions.canDelete}
          />
        }
      />
      <RouteTabs tabs={tabs} label="Order sections" />
      {/* Switching tabs keeps the header and shows this while the tab loads. */}
      <Suspense fallback={<LoadingState />}>{children}</Suspense>
    </>
  );
}

/** The strip above each tab's content: "Denim jeans · Guangzhou Textile Co. · ⟨fact⟩" with the status pill. */
export function OrderContextStrip({ order, fact }: { order: OrderView; fact: string }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 rounded-xl border bg-card px-5 py-3">
      <p className="text-[15px] text-muted-foreground">
        <span className="text-[17px] font-bold text-foreground">{order.item}</span> · {order.supplier.name} · {fact}
      </p>
      <StatusPill tone={order.status.tone}>{order.status.label}</StatusPill>
    </div>
  );
}
