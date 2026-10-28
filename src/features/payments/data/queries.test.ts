import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import type { PaymentsResponse } from "@/lib/api/types";

import { getPayments, type Payment, toPaymentsData } from "./queries";

const apiGet = vi.fn();
const getMe = vi.fn();
vi.mock("@/lib/api/server", () => ({ apiGet: (...args: unknown[]) => apiGet(...args) }));
vi.mock("@/lib/session", () => ({ getMe: () => getMe() }));
vi.mock("@/lib/today", () => ({ todayInIndia: () => "2026-11-10" }));

type Order = PaymentsResponse["orders"][number];
const order = (po: string, over: Partial<Order> = {}): Order => ({
  orderId: `o-${po}`,
  po,
  supplier: "Ningbo Knits",
  orderValueCny: 10_000,
  paidCny: 4_000,
  paidInr: 48_000,
  balanceCny: 6_000,
  nextDue: null,
  ...over,
});
const due = (id: string, po: string, dueDate: string, amountCny: number): Payment => ({
  id,
  orderId: `o-${po}`,
  po,
  kind: "Balance",
  payee: "Ningbo Knits",
  payeeRole: "supplier",
  amountCny,
  status: "due",
  paidOn: null,
  dueDate,
  rateInr: null,
  mode: null,
});
const paid = (id: string, po: string): Payment => ({
  ...due(id, po, "2026-11-12", 4_000),
  kind: "Deposit",
  status: "paid",
  paidOn: "2026-10-01",
  dueDate: null,
  rateInr: 12,
  mode: "Bank transfer",
});

const today = "2026-11-10";

describe("toPaymentsData", () => {
  it("sums paid INR and counts the orders it comes from, paid off or not", () => {
    const { kpis } = toPaymentsData(
      {
        orders: [
          order("PO-3001"),
          order("PO-3002", { paidInr: 2_000, balanceCny: 0 }),
          order("PO-3003", { paidCny: 0, paidInr: 0, balanceCny: 10_000 }),
        ],
        payments: [],
      },
      today,
    );
    expect(kpis.paidSoFarInr).toBe(50_000);
    expect(kpis.paidOrders).toBe(2);
  });

  it("counts due payments from today to +7 and +30 days, in CNY, naming the earliest", () => {
    const payments = [
      due("p1", "PO-3001", "2026-11-09", 100), // overdue: in neither window
      due("p2", "PO-3002", "2026-11-17", 200), // today + 7: both windows
      due("p3", "PO-3003", "2026-11-10", 300), // today: both, and the earliest
      due("p4", "PO-3004", "2026-11-18", 400), // today + 8: 30 days only
      due("p5", "PO-3005", "2026-12-10", 500), // today + 30: 30 days only
      due("p6", "PO-3006", "2026-12-11", 600), // today + 31: neither
      paid("p7", "PO-3007"), // paid: never due
    ];
    const { kpis } = toPaymentsData({ orders: [], payments }, today);
    expect(kpis.dueNext7).toEqual({ amountCny: 500, count: 2, first: { po: "PO-3003", due: "2026-11-10" } });
    expect(kpis.dueNext30).toEqual({ amountCny: 1_400, count: 4, first: { po: "PO-3003", due: "2026-11-10" } });
  });

  it("names nobody when nothing is due", () => {
    expect(toPaymentsData({ orders: [], payments: [] }, today).kpis.dueNext7).toEqual({ amountCny: 0, count: 0, first: null });
  });

  it("maps order rows and tones overdue and soon next-due dates", () => {
    const { orders } = toPaymentsData(
      {
        orders: [
          order("PO-3001", { nextDue: "2026-11-09" }),
          order("PO-3002", { nextDue: "2026-11-17" }),
          order("PO-3003", { nextDue: "2026-11-18" }),
          order("PO-3004"),
        ],
        payments: [],
      },
      today,
    );
    expect(orders[0]).toEqual({
      orderId: "o-PO-3001",
      po: "PO-3001",
      supplier: "Ningbo Knits",
      orderValue: 10_000,
      paid: 4_000,
      paidInr: 48_000,
      balance: 6_000,
      nextDue: "2026-11-09",
      nextDueTone: "danger",
    });
    expect(orders.map((o) => o.nextDueTone)).toEqual(["danger", "warning", undefined, undefined]);
  });

  it("selects the first order that has payments, else the first order, else none", () => {
    const orders = [order("PO-3001"), order("PO-3002")];
    expect(toPaymentsData({ orders, payments: [paid("p1", "PO-3002")] }, today).defaultPo).toBe("PO-3002");
    expect(toPaymentsData({ orders, payments: [] }, today).defaultPo).toBe("PO-3001");
    expect(toPaymentsData({ orders: [], payments: [] }, today).defaultPo).toBeNull();
  });
});

describe("getPayments", () => {
  const AGENTS = [{ id: "a1", name: "Sino Freight" }];
  const me = (payments: string, ordersView: string) => ({ shell: "management", permissions: { payments, ordersView } });
  const answer = (options: () => Promise<unknown>) =>
    apiGet.mockImplementation((path: string) => (path === "/orders/options" ? options() : Promise.resolve({ orders: [], payments: [] })));

  beforeEach(() => {
    apiGet.mockReset();
    getMe.mockReset().mockResolvedValue(null);
  });

  it("reads PAY-1 and derives with today in India", async () => {
    apiGet.mockResolvedValue({ orders: [order("PO-3001", { nextDue: "2026-11-12" })], payments: [due("p1", "PO-3001", "2026-11-12", 6_000)] });
    const data = await getPayments();
    expect(apiGet).toHaveBeenCalledWith("/payments");
    expect(data.orders.map((o) => [o.po, o.nextDueTone])).toEqual([["PO-3001", "warning"]]);
    expect(data.kpis.dueNext7.count).toBe(1);
    expect(data.defaultPo).toBe("PO-3001");
  });

  it("offers recording, with ORD-2's agents, to payments Enter or better, and links POs for Orders viewers", async () => {
    getMe.mockResolvedValue(me("Enter", "View"));
    answer(() => Promise.resolve({ agents: AGENTS }));
    const data = await getPayments();
    expect(apiGet).toHaveBeenCalledWith("/orders/options");
    expect(data.agents).toEqual(AGENTS);
    expect(data.linkPo).toBe(true);
  });

  it("doesn't offer recording to viewers, nor read ORD-2 for them", async () => {
    getMe.mockResolvedValue(me("View", "None"));
    answer(() => Promise.reject(new Error("ORD-2 must not be read")));
    const data = await getPayments();
    expect(apiGet).not.toHaveBeenCalledWith("/orders/options");
    expect(data.agents).toBeNull();
    expect(data.linkPo).toBe(false);
  });

  it("still offers recording, with no agents, when ORD-2 fails", async () => {
    getMe.mockResolvedValue(me("Full", "None"));
    answer(() => Promise.reject(new ApiError(403, "forbidden", "no")));
    expect((await getPayments()).agents).toEqual([]);
  });

  it("rejects when the API fails (no fixture fallback)", async () => {
    apiGet.mockRejectedValue(new ApiError(500, "internal", "boom"));
    await expect(getPayments()).rejects.toBeInstanceOf(ApiError);
  });
});
