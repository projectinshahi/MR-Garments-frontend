import type { OrderLineItem, OrderListItem, Unit } from "@/lib/api/types";

// The products of an order, from every one of its lines (ORD-7), for the Orders list. ORD-1 describes an order by its
// first line only (item, quantity, unit), which is all the list could show before.

export type OrderProduct = { item: string; quantity: number; unit: Unit };

/**
 * Per order id, its products in line order. Two lines of the same item in the same unit are one product with both
 * quantities, so a name never shows twice and nothing is counted twice.
 */
export function productsByOrder(lines: Pick<OrderLineItem, "orderId" | "position" | "item" | "quantity" | "unit">[]) {
  const byOrder = new Map<string, OrderProduct[]>();
  for (const line of [...lines].sort((a, b) => a.position - b.position)) {
    const products = byOrder.get(line.orderId) ?? [];
    const same = products.find((product) => product.item === line.item && product.unit === line.unit);
    if (same) same.quantity += line.quantity;
    else products.push({ item: line.item, quantity: line.quantity, unit: line.unit });
    byOrder.set(line.orderId, products);
  }
  return byOrder;
}

/** The order's products; without its lines (ORD-7 unreadable), ORD-1's first line, as before. */
export const productsOf = (order: Pick<OrderListItem, "item" | "quantity" | "unit"> & { products?: OrderProduct[] }): OrderProduct[] =>
  order.products?.length ? order.products : [{ item: order.item, quantity: order.quantity, unit: order.unit }];

/** The total quantity per unit, in the order the units first appear: pieces and metres are never added together. */
export function totalsByUnit(products: OrderProduct[]) {
  const totals = new Map<Unit, number>();
  for (const product of products) totals.set(product.unit, (totals.get(product.unit) ?? 0) + product.quantity);
  return [...totals].map(([unit, quantity]) => ({ unit, quantity }));
}
