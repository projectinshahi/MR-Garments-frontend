import { orderDetailHeaders } from "@/features/order-detail/shared/fixtures";

/** POs with a designed detail view (prerendered through generateStaticParams). */
export async function listOrderDetailPOs() {
  return orderDetailHeaders.map((header) => header.po);
}

export async function getOrderDetailHeader(po: string) {
  const header = orderDetailHeaders.find((h) => h.po === po);
  return header ? structuredClone(header) : undefined;
}
