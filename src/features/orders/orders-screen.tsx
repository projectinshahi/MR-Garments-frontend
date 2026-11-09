import type { OrdersListData } from "./data/queries";
import { OrdersList } from "./orders-list";
import { ClosedList, PendingList } from "./orders-tab-list";

export type OrdersView = "all" | "pending" | "closed";

/**
 * Orders lists: All orders (05: chips, counts, stage filter, row actions), and the phase 2 §5 Pending (stage 1) and
 * Closed (`closed`) tabs, each drawing the shared header and tab bar (orders-frame.tsx) over one ORD-1 load.
 * "+ New order" and the All rows' Edit show only to users who may place orders (ordersEdit >= Enter); Delete only with
 * admin Full (D1).
 */
export function OrdersScreen({ data, view = "all", canEdit, canDelete }: { data: OrdersListData; view?: OrdersView; canEdit: boolean; canDelete: boolean }) {
  if (view === "pending") return <PendingList {...data} canEdit={canEdit} />;
  if (view === "closed") return <ClosedList {...data} canEdit={canEdit} />;
  return <OrdersList {...data} canEdit={canEdit} canDelete={canDelete} />;
}
