import { cleanup, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DeliveryItem } from "@/lib/api/types";

import { toDelivery } from "./deliveries";
import { MonthView } from "./month-view";

const TODAY = "2026-11-03";

const row = (po: string, due: string): DeliveryItem => ({
  orderId: `id-${po}`,
  po,
  supplier: "Foshan Fabrics",
  item: "Denim fabric",
  quantity: 100,
  unit: "m",
  received: 0,
  due,
});

const items = [
  row("PO-1", "2026-09-15"), // late, two months back
  row("PO-2", "2026-10-30"), // late, last month
  row("PO-3", "2026-11-01"), // late, this month
  row("PO-4", "2026-11-20"),
  ...["PO-11", "PO-12", "PO-13", "PO-14", "PO-15", "PO-16", "PO-17"].map((po) => row(po, "2026-12-09")),
];

const view = (query = "") =>
  render(<MonthView today={TODAY} deliveries={items.map((item) => toDelivery(item, TODAY))} linkOrders params={new URLSearchParams(query)} />);
const lateCard = () => screen.queryByRole("list", { name: "Late deliveries" });
const latePos = () => within(lateCard()!).getAllByRole("link").map((link) => link.textContent);

describe("MonthView", () => {
  it("lists every delivery still late on today's month, including those from earlier months", () => {
    view();
    expect(screen.getByRole("heading", { level: 2, name: "November 2026" })).toBeInTheDocument();
    expect(latePos()).toEqual(["PO-1", "PO-2", "PO-3"]);
  });

  it("limits the late card to the month shown otherwise (DEF-12): a past month's own, none in a future month", () => {
    view("month=2026-10");
    expect(latePos()).toEqual(["PO-2"]);
    cleanup();
    view("month=2026-12");
    expect(screen.getByText("No late deliveries.")).toBeInTheDocument();
  });

  it("puts each delivery on its due day and keeps a busy day's chips, linked to their orders, in its own cell", () => {
    view("month=2026-12");
    const day = screen.getByRole("link", { name: "PO-11" }).closest<HTMLElement>("[role=cell]")!;
    expect(day).toHaveTextContent("7 deliveries");
    expect(within(day).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(
      ["PO-11", "PO-12", "PO-13", "PO-14", "PO-15", "PO-16", "PO-17"].map((po) => `/orders/${po}`),
    );
  });

  it("falls back to today's month for a bad ?month=", () => {
    for (const bad of ["2026-13", "soon", "2027-1"]) {
      const { unmount } = view(`month=${bad}`);
      expect(screen.getByRole("heading", { level: 2, name: "November 2026" })).toBeInTheDocument();
      unmount();
    }
  });
});
