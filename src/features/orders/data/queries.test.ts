import { beforeEach, describe, expect, it, vi } from "vitest";

import { SETTLED } from "@/features/payments/test-fixtures";
import { ApiError } from "@/lib/api/errors";
import { apiGet } from "@/lib/api/server";
import type { OrderLineItem, OrderListItem, OrderOptions } from "@/lib/api/types";

import { getOrdersList } from "./queries";

vi.mock("@/lib/api/server", () => ({ apiGet: vi.fn() }));
vi.mock("@/lib/today", () => ({ todayInIndia: () => "2026-10-27" }));
const get = vi.mocked(apiGet);

const order = (po: string, patch: Partial<OrderListItem>): OrderListItem => ({
  id: po,
  exchangeRate: null,
  po,
  orderDate: "2026-10-01",
  deliveryDate: "2026-12-01",
  stage: 1,
  supplier: { id: "s-1", name: "Foshan Fabrics" },
  currency: "CNY",
  item: "Cotton denim fabric",
  quantity: 2400,
  unit: "m",
  received: 0,
  stocked: 0,
  closed: false,
  closedOn: null,
  orderValueCny: 44400,
  ...SETTLED,
  settledCny: 20000,
  outstandingCny: 24400,
  paymentStatus: "partly",
  settledInr: 232000,
  agentPaidCny: 0,
  agentPaidInr: 0,
  paidInr: 232000,
  ...patch,
});
const list = [
  order("PO-2053", { deliveryDate: "2026-10-27" }),
  order("PO-2052", { deliveryDate: "2026-10-23", stage: 2, supplier: { id: "s-9", name: "Old Supplier" } }),
  order("PO-2051", { stage: 3, received: 2000 }),
  order("PO-2050", { stage: 6, received: 2400, stocked: 2400, closed: true, closedOn: "2026-10-20" }),
];
const options: OrderOptions = {
  nextPo: "PO-2054",
  suppliers: [{ id: "s-1", name: "Foshan Fabrics", contactPerson: "", phone: "", city: "", currency: "CNY", exchangeRate: null, held: false, ledgerBalance: [] }],
  items: [],
  agents: [],
};
const line = (orderId: string, position: number, item: string, quantity: number, unit = "m"): OrderLineItem => ({
  orderId,
  po: orderId,
  currency: "CNY",
  position,
  item,
  unit,
  quantity,
  rateCny: 1,
  valueCny: quantity,
  received: 0,
  stocked: 0,
});
const LINES = [
  line("PO-2053", 0, "Cotton denim fabric", 2400),
  line("PO-2053", 1, "Polo shirts", 60, "pcs"),
  line("PO-2053", 2, "Silk scarves", 20, "pcs"),
  line("PO-2052", 0, "Cotton denim fabric", 2400),
];
const answer = (orders: OrderListItem[], lines: OrderLineItem[] | Error = LINES) =>
  ((path: string) =>
    path === "/order-lines" ? (lines instanceof Error ? Promise.reject(lines) : Promise.resolve(lines)) : Promise.resolve(path === "/orders" ? orders : options)) as typeof apiGet;

beforeEach(() => vi.clearAllMocks());

describe("getOrdersList", () => {
  it("reads ORD-1 and ORD-2 and derives each status and the chip counts for today in India", async () => {
    get.mockImplementation(answer(list));
    const { orders, counts, supplierNames } = await getOrdersList();

    expect(get).toHaveBeenCalledWith("/orders");
    expect(get).toHaveBeenCalledWith("/orders/options");
    expect(orders.map((o) => [o.po, o.supplier, o.status, o.tone])).toEqual([
      ["PO-2053", "Foshan Fabrics", "Due today", "warning"],
      ["PO-2052", "Old Supplier", "Late 4 days", "danger"],
      ["PO-2051", "Foshan Fabrics", "Short by 400 m", "warning"],
      ["PO-2050", "Foshan Fabrics", "Closed", "success"],
    ]);
    expect(orders[0]!.paidInr).toBe(232000);
    expect(counts).toEqual({ all: 4, late: 1, dueSoon: 1, shortReceived: 1 });
    expect(supplierNames).toEqual(["Foshan Fabrics", "Old Supplier"]);
  });

  it("reads every order's products from ORD-7 (ORD-1 names the first line only)", async () => {
    get.mockImplementation(answer(list));
    const { orders } = await getOrdersList();
    expect(get).toHaveBeenCalledWith("/order-lines");
    expect(orders.find((o) => o.po === "PO-2053")!.products).toEqual([
      { item: "Cotton denim fabric", quantity: 2400, unit: "m" },
      { item: "Polo shirts", quantity: 60, unit: "pcs" },
      { item: "Silk scarves", quantity: 20, unit: "pcs" },
    ]);
    expect(orders.find((o) => o.po === "PO-2052")!.products).toEqual([{ item: "Cotton denim fabric", quantity: 2400, unit: "m" }]);
    // An order ORD-7 doesn't list keeps ORD-1's first line (productsOf).
    expect(orders.find((o) => o.po === "PO-2051")!.products).toBeUndefined();
  });

  it("still lists every order when ORD-7 fails, each described by its first line", async () => {
    get.mockImplementation(answer(list, new ApiError(500, "internal", "Something went wrong.")));
    const { orders, counts } = await getOrdersList();
    expect(orders).toHaveLength(4);
    expect(orders.every((o) => o.products === undefined)).toBe(true);
    expect(counts.all).toBe(4);
  });

  it("returns no rows when the API has no orders", async () => {
    get.mockImplementation(answer([]));
    expect(await getOrdersList()).toEqual({
      orders: [],
      counts: { all: 0, late: 0, dueSoon: 0, shortReceived: 0 },
      supplierNames: ["Foshan Fabrics"],
    });
  });

  it("rejects when the API fails, with no fallback", async () => {
    get.mockRejectedValue(new ApiError(500, "internal", "Something went wrong."));
    await expect(getOrdersList()).rejects.toBeInstanceOf(ApiError);
  });
});
