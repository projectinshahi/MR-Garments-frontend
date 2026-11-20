import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import type { PaymentsResponse } from "@/lib/api/types";

import { paymentOrder, paymentRow } from "../test-fixtures";
import { getPayments, toPaymentsData } from "./queries";

const apiGet = vi.fn();
const getMe = vi.fn();
vi.mock("@/lib/api/server", () => ({ apiGet: (...args: unknown[]) => apiGet(...args) }));
vi.mock("@/lib/session", () => ({ getMe: () => getMe() }));
vi.mock("@/lib/today", () => ({ todayInIndia: () => "2026-11-10" }));

const today = "2026-11-10";
const due = (id: string, dueDate: string, amountCny: number, over = {}) =>
  paymentRow(id, { orderId: "o-PO-1", po: "PO-1", kind: "Balance", status: "due", paidOn: null, dueDate, amountCny, rateInr: null, amountInr: null, ...over });
const TOTALS: NonNullable<PaymentsResponse["totals"]> = [
  { currency: "CNY", accounts: 3, balanceCny: -700, payableCny: 1200, availableCny: 500, outstandingCny: 6000 },
  { currency: "USD", accounts: 1, balanceCny: 80, payableCny: 0, availableCny: 80, outstandingCny: 0 },
];

describe("toPaymentsData (PAY-1, unified ledger)", () => {
  it("sums the INR of non-void paid payments of every payee; a voided payment counts in no total", () => {
    const payments = [
      paymentRow("p1", { amountInr: 60_000 }),
      paymentRow("p2", { payeeRole: "agent", payee: "Sino Freight", kind: "Balance", po: "PO-1", amountInr: 6_000 }),
      paymentRow("p3", { amountInr: 12_000, voided: true, voidReason: "Twice" }),
      paymentRow("p4", { currency: "USD", rateInr: null, amountInr: null }),
    ];
    const { kpis } = toPaymentsData({ orders: [], payments, totals: TOTALS }, today);
    expect(kpis).toMatchObject({ paidSoFarInr: 66_000, paidCount: 3, unrated: 1 });
  });

  it("takes payable and available per currency from LED-2's totals, never adding currencies", () => {
    const { kpis } = toPaymentsData({ orders: [], payments: [], totals: TOTALS }, today);
    expect(kpis.payable).toEqual([{ currency: "CNY", amount: 1200 }]);
    expect(kpis.available).toEqual([
      { currency: "CNY", amount: 500 },
      { currency: "USD", amount: 80 },
    ]);
    // A backend before 0017 sends no totals: none, not zeros made up.
    expect(toPaymentsData({ orders: [], payments: [] }, today).kpis.payable).toEqual([]);
  });

  it("counts non-void due payments from today to +30 days, naming the earliest", () => {
    const payments = [due("d1", "2026-11-12", 1_000), due("d2", "2026-12-09", 2_000), due("d3", "2026-12-11", 4_000), due("d4", "2026-11-11", 8_000, { voided: true })];
    expect(toPaymentsData({ orders: [], payments }, today).kpis.dueNext30).toEqual({ amounts: [{ currency: "CNY", amount: 3_000 }], count: 2, first: { po: "PO-1", due: "2026-11-12" } });
  });

  it("keeps the API's order figures as they are and tones the next due date", () => {
    const orders = [paymentOrder("PO-1", { nextDue: "2026-11-09" }), paymentOrder("PO-2", { nextDue: "2026-11-15" }), paymentOrder("PO-3", { nextDue: "2026-12-30" })];
    const rows = toPaymentsData({ orders, payments: [] }, today).orders;
    expect(rows.map((r) => r.nextDueTone)).toEqual(["danger", "warning", undefined]);
    expect(rows[0]).toMatchObject({ settledCny: 4_000, outstandingCny: 6_000, paymentStatus: "partly", paidInr: 48_000 });
  });

  it("selects the first order with a payment naming it, else the first order, else none", () => {
    const orders = [paymentOrder("PO-1"), paymentOrder("PO-2")];
    expect(toPaymentsData({ orders, payments: [paymentRow("p1", { po: "PO-2" })] }, today).defaultPo).toBe("PO-2");
    expect(toPaymentsData({ orders, payments: [paymentRow("p1")] }, today).defaultPo).toBe("PO-1");
    expect(toPaymentsData({ orders: [], payments: [] }, today).defaultPo).toBeNull();
  });
});

describe("getPayments", () => {
  const AGENTS = [{ id: "a1", name: "Sino Freight" }];
  const SUPPLIERS = [{ id: "s1", name: "Boston Denim", currency: "USD", exchangeRate: 88, held: false, currencyOptions: ["USD"], balances: [] }];
  const me = (payments: string, ordersView: string) => ({ shell: "management", permissions: { payments, ordersView } });
  const answer = (options: () => Promise<unknown>, suppliers: () => Promise<unknown> = () => Promise.resolve({ suppliers: SUPPLIERS })) =>
    apiGet.mockImplementation((path: string) =>
      path === "/orders/options" ? options() : path === "/supplier-advances/suppliers" ? suppliers() : Promise.resolve({ orders: [], payments: [], totals: [] }),
    );

  beforeEach(() => {
    apiGet.mockReset();
    getMe.mockReset().mockResolvedValue(null);
  });

  it("offers Record payment (ADV-5) and sea freight (ORD-2 agents) to payments Enter; Void to payments Full only", async () => {
    getMe.mockResolvedValue(me("Enter", "View"));
    answer(() => Promise.resolve({ agents: AGENTS }));
    const enter = await getPayments();
    expect(apiGet).toHaveBeenCalledWith("/payments");
    expect(enter).toMatchObject({ agents: AGENTS, suppliers: SUPPLIERS, linkPo: true, canVoid: false });

    getMe.mockResolvedValue(me("Full", "None"));
    expect(await getPayments()).toMatchObject({ canVoid: true, linkPo: false });
  });

  it("offers no recording to viewers, nor reads ORD-2 or ADV-5 for them", async () => {
    getMe.mockResolvedValue(me("View", "None"));
    answer(
      () => Promise.reject(new Error("ORD-2 must not be read")),
      () => Promise.reject(new Error("ADV-5 must not be read")),
    );
    expect(await getPayments()).toMatchObject({ agents: null, suppliers: null, canVoid: false });
  });

  it("a failing list just means none of it", async () => {
    getMe.mockResolvedValue(me("Enter", "None"));
    answer(
      () => Promise.reject(new ApiError(403, "forbidden", "no")),
      () => Promise.reject(new ApiError(500, "internal", "no")),
    );
    expect(await getPayments()).toMatchObject({ agents: [], suppliers: [] });
  });

  it("rejects when PAY-1 fails (no fixture fallback)", async () => {
    apiGet.mockRejectedValue(new ApiError(500, "internal", "boom"));
    await expect(getPayments()).rejects.toBeInstanceOf(ApiError);
  });
});
