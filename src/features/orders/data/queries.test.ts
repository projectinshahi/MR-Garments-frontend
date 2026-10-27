import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import { apiGet } from "@/lib/api/server";
import type { OrderListItem, OrderOptions } from "@/lib/api/types";

import { getOrdersList } from "./queries";

vi.mock("@/lib/api/server", () => ({ apiGet: vi.fn() }));
vi.mock("@/lib/today", () => ({ todayInIndia: () => "2026-10-27" }));
const get = vi.mocked(apiGet);

const order = (po: string, patch: Partial<OrderListItem>): OrderListItem => ({
  id: po,
  po,
  orderDate: "2026-10-01",
  deliveryDate: "2026-12-01",
  stage: 1,
  supplier: { id: "s-1", name: "Foshan Fabrics" },
  item: "Cotton denim fabric",
  quantity: 2400,
  unit: "m",
  received: 0,
  orderValueCny: 44400,
  paidCny: 20000,
  paidInr: 232000,
  ...patch,
});
const list = [
  order("PO-2053", { deliveryDate: "2026-10-27" }),
  order("PO-2052", { deliveryDate: "2026-10-23", stage: 2, supplier: { id: "s-9", name: "Old Supplier" } }),
  order("PO-2051", { stage: 3, received: 2000 }),
  order("PO-2050", {}),
];
const options: OrderOptions = {
  nextPo: "PO-2054",
  suppliers: [{ id: "s-1", name: "Foshan Fabrics", contactPerson: "", phone: "", city: "" }],
  items: [],
  agents: [],
};
const answer = (orders: OrderListItem[]) => ((path: string) => Promise.resolve(path === "/orders" ? orders : options)) as typeof apiGet;

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
      ["PO-2050", "Foshan Fabrics", "On track", "success"],
    ]);
    expect(orders[0]!.paidInr).toBe(232000);
    expect(counts).toEqual({ all: 4, late: 1, dueSoon: 1, shortReceived: 1 });
    expect(supplierNames).toEqual(["Foshan Fabrics", "Old Supplier"]);
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
