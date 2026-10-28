import { cache } from "react";

import { orderStatus, type OrderStatus } from "@/features/orders/order-status";
import { ApiError } from "@/lib/api/errors";
import { apiGet } from "@/lib/api/server";
import type { OrderDetail } from "@/lib/api/types";
import { todayInIndia } from "@/lib/today";

// Order detail (06-10) reads ORD-4. The call reads the session cookie, so the frame and tabs render inside Suspense;
// failures other than 404 throw to error.tsx.

export type OrderView = OrderDetail & { status: OrderStatus };
export type OrderPayment = NonNullable<OrderDetail["payments"]>[number];
export type OrderReceipt = NonNullable<OrderDetail["receipts"]>[number];
export type OrderContainer = NonNullable<OrderDetail["containers"]>[number];

/**
 * One order with its status for today in India, or null when the PO doesn't exist (ORD-4 404). Cached per request,
 * so the frame and the tab page share one call.
 */
export const getOrderDetail = cache(async (po: string): Promise<OrderView | null> => {
  let order: OrderDetail;
  try {
    order = await apiGet<OrderDetail>(`/orders/${encodeURIComponent(po)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
  return { ...order, status: orderStatus(order, todayInIndia()) };
});
