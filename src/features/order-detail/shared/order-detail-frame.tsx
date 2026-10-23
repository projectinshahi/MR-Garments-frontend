import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { RouteTabs, type RouteTab } from "@/components/layout/route-tabs";
import { StatusPill } from "@/components/shared/status-pill";
import { OrderDetailActions } from "@/features/order-detail/shared/order-detail-actions";
import { getOrderDetailHeader } from "@/features/order-detail/shared/queries";

const TABS: { segment: string; label: string; chip: string }[] = [
  { segment: "", label: "Overview", chip: "a" },
  { segment: "/items", label: "Items", chip: "b" },
  { segment: "/payments", label: "Deposits & payments", chip: "c" },
  { segment: "/receiving", label: "Receiving", chip: "d" },
  { segment: "/containers", label: "Containers", chip: "e" },
  { segment: "/clearing-transport", label: "Clearing & transport", chip: "f" },
  { segment: "/warehouse", label: "Warehouse", chip: "g" },
  { segment: "/cost", label: "Cost", chip: "h" },
  { segment: "/history", label: "History", chip: "i" },
];

/** Header ("Orders / PO-2028", Print order, Edit order) and tabs a–i shared by the order-detail tabs. */
export async function OrderDetailFrame({ po, children }: { po: string; children: React.ReactNode }) {
  const header = await getOrderDetailHeader(po);
  if (!header) notFound();
  const tabs: RouteTab[] = TABS.map((tab) => ({ href: `/orders/${po}${tab.segment}`, label: tab.label, chip: tab.chip }));

  return (
    <>
      <PageHeader title={po} parent={{ label: "Orders", href: "/orders" }} actions={<OrderDetailActions />} />
      <RouteTabs tabs={tabs} label="Order sections" />
      {children}
    </>
  );
}

/**
 * The strip above each tab's content: "Denim jeans · Guangzhou Textile Co. · ⟨fact⟩" with the status pill.
 * Tabs b–i render it with their own fact ("Order date 5 Aug 2026", "1 container", …).
 */
export async function OrderContextStrip({ po, fact }: { po: string; fact: string }) {
  const header = await getOrderDetailHeader(po);
  if (!header) notFound();
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 rounded-xl border bg-card px-5 py-3">
      <p className="text-[15px] text-muted-foreground">
        <span className="text-[17px] font-bold text-foreground">{header.item}</span> · {header.supplier} · {fact}
      </p>
      <StatusPill tone={header.status.tone}>{header.status.label}</StatusPill>
    </div>
  );
}
