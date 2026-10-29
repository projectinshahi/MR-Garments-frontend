import { describe, expect, it } from "vitest";

import type { ContainerListItem, DeliveryItem, OrderListItem, PaymentsResponse } from "@/lib/api/types";

import { toDashboard } from "./dashboard-logic";

const TODAY = "2026-10-29";
const order = (po: string, stage: OrderListItem["stage"]) => ({ po, stage }) as OrderListItem;
const delivery = (po: string, due: string, supplier = "Foshan Fabrics") => ({ po, due, supplier }) as DeliveryItem;
const payment = (id: string, status: "paid" | "due", dueDate: string | null, amountCny: number) =>
  ({ id, po: `PO-${id}`, kind: "Balance", payee: "Shenzhen Apparel", status, dueDate, amountCny }) as PaymentsResponse["payments"][number];
const container = (number: string, status: ContainerListItem["status"], eta: string) =>
  ({ number, status, eta, agent: { id: "a", name: "Sino Freight" }, terms: "FOB", orders: [] }) as unknown as ContainerListItem;

describe("toDashboard", () => {
  it("counts active orders (stages 1-5) and every stage once", () => {
    const { orders } = toDashboard(
      { orders: [order("1", 1), order("2", 1), order("3", 3), order("4", 6)], deliveries: [], payments: { orders: [], payments: [] }, containers: [] },
      TODAY,
    );
    expect(orders).toEqual({
      active: 3,
      stages: 2,
      byStage: [
        { stage: 1, count: 2 },
        { stage: 2, count: 0 },
        { stage: 3, count: 1 },
        { stage: 4, count: 0 },
        { stage: 5, count: 0 },
        { stage: 6, count: 1 },
      ],
    });
  });

  it("lists late deliveries, then those due within 7 days, and counts their suppliers", () => {
    const { deliveries } = toDashboard(
      {
        orders: [],
        deliveries: [delivery("A", "2026-10-25"), delivery("B", "2026-10-29", "Yiwu Trims"), delivery("C", "2026-11-05"), delivery("D", "2026-11-06")],
        payments: { orders: [], payments: [] },
        containers: [],
      },
      TODAY,
    );
    expect(deliveries).toMatchObject({ late: 1, dueNext7: 2, dueSuppliers: 2 });
    expect(deliveries !== "denied" && deliveries !== "failed" && deliveries.rows.map((r) => [r.po, r.status, r.tone])).toEqual([
      ["A", "Late 4 days", "danger"],
      ["B", "Due today", "warning"],
      ["C", "Due in 7 days", "warning"],
    ]);
  });

  it("sums due payments from today to 30 days ahead, in CNY, soonest first", () => {
    const payments = [
      payment("late", "due", "2026-10-28", 1),
      payment("paid", "paid", null, 2),
      payment("p2", "due", "2026-11-28", 300),
      payment("p1", "due", "2026-10-29", 50),
      payment("far", "due", "2026-11-29", 4),
    ];
    const { paymentsDue } = toDashboard({ orders: [], deliveries: [], payments: { orders: [], payments }, containers: [] }, TODAY);
    expect(paymentsDue).toMatchObject({ amountCny: 350, windowDays: 30 });
    expect(paymentsDue !== "denied" && paymentsDue !== "failed" && paymentsDue.rows.map((r) => r.id)).toEqual(["p1", "p2"]);
  });

  it("lists containers at sea by ETA and counts those arriving this week", () => {
    const { containers } = toDashboard(
      {
        orders: [],
        deliveries: [],
        payments: { orders: [], payments: [] },
        containers: [container("LATE", "sea", "2026-11-20"), container("SOON", "sea", "2026-11-01"), container("DOCK", "arrived", "2026-10-20"), container("LOAD", "loading", "2026-11-02")],
      },
      TODAY,
    );
    expect(containers).toMatchObject({ onTheWay: 2, arrivingThisWeek: 1 });
    expect(containers !== "denied" && containers !== "failed" && containers.rows.map((r) => r.container)).toEqual(["SOON", "LATE"]);
  });

  it("passes a denied or failed source through, so only that card says so", () => {
    const sections = toDashboard({ orders: "failed", deliveries: "denied", payments: { orders: [], payments: [] }, containers: [] }, TODAY);
    expect(sections.orders).toBe("failed");
    expect(sections.deliveries).toBe("denied");
    expect(sections.paymentsDue).toMatchObject({ amountCny: 0, rows: [] });
  });
});
