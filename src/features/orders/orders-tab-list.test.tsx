import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SETTLED } from "@/features/payments/test-fixtures";

import type { OrderRow } from "./data/queries";
import { ClosedList, ClosedOrdersPageList, PendingList } from "./orders-tab-list";

// Phase 2 §5: the Pending and Closed tabs over one ORD-1 load, inside the shared header and tab bar.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/orders/pending",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const row = (po: string, patch: Partial<OrderRow> = {}): OrderRow => ({
  id: po,
  exchangeRate: null,
  po,
  orderDate: "2026-10-01",
  deliveryDate: "2026-11-15",
  stage: 1,
  supplier: "Foshan Fabrics",
  currency: "CNY",
  item: "Denim jeans",
  quantity: 100,
  unit: "pcs",
  received: 0,
  stocked: 0,
  closed: false,
  closedOn: null,
  orderValueCny: 1000,
  ...SETTLED,
  settledCny: 0,
  outstandingCny: 1000,
  paymentStatus: "unpaid",
  agentPaidCny: 0,
  agentPaidInr: 0,
  paidInr: 0,
  status: "On track",
  tone: "success",
  chip: null,
  ...patch,
});
const orders = [
  row("PO-2053", { received: 60, settledCny: 500, outstandingCny: 500, paymentStatus: "partly", orderDate: "2026-10-05", depositRequiredCny: 600, depositStatus: "partly" }),
  row("PO-2052", { stage: 2, received: 100 }),
  row("PO-2040", { stage: 6, received: 100, stocked: 100, closed: true, closedOn: "2026-10-20", settledCny: 600, outstandingCny: 400, paymentStatus: "partly" }),
  row("PO-2039", { stage: 6, received: 100, stocked: 0 }),
];
const cells = (po: string) =>
  within(screen.getByRole("row", { name: new RegExp(po) }))
    .getAllByRole("cell")
    .map((cell) => cell.textContent);

describe("Pending tab", () => {
  it("lists stage-1 orders only, with pending quantity, value, the API's payment status and the deposit milestone, under the shared header", () => {
    render(<PendingList orders={orders} supplierNames={["Foshan Fabrics"]} canEdit />);
    expect(screen.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();
    const tabs = screen.getByRole("navigation", { name: "Orders lists" });
    expect(within(tabs).getByRole("link", { name: "Pending" })).toHaveAttribute("aria-current", "page");
    expect(within(tabs).getByRole("link", { name: "All orders" })).toHaveAttribute("href", "/orders");
    expect(within(tabs).getByRole("link", { name: "Closed" })).toHaveAttribute("href", "/orders/closed");
    // One "Download report" menu (PDF, Excel, CSV) replaces the separate export buttons.
    expect(screen.getByRole("button", { name: "Download report" })).toBeVisible();
    expect(screen.getByRole("link", { name: "+ New order" })).toHaveAttribute("href", "/orders/new");

    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(cells("PO-2053")).toEqual(["PO-2053", "Foshan Fabrics", "5 Oct", "15 Nov", "100 pcs", "40 pcs", "¥1,000.00", "Partly paidDeposit partly met", "1. Order and deposit"]);
    expect(screen.getByText("Showing 1 to 1 of 1 orders")).toBeVisible();
  });

  it("narrows by order date and says when nothing matches; no + New order without ordersEdit", () => {
    render(<PendingList orders={orders} supplierNames={["Foshan Fabrics"]} canEdit={false} />);
    expect(screen.queryByRole("link", { name: "+ New order" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Order date from"), { target: { value: "2026-10-06" } });
    expect(screen.getByText("No orders match these filters.")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Order date from"), { target: { value: "2026-10-05" } });
    fireEvent.change(screen.getByLabelText("Order date to"), { target: { value: "2026-10-05" } });
    expect(screen.getByRole("row", { name: /PO-2053/ })).toBeVisible();
  });

  it("tells pending from no orders at all", () => {
    const { unmount } = render(<PendingList orders={[orders[1]!]} supplierNames={[]} canEdit={false} />);
    expect(screen.getByText("No pending orders.")).toBeVisible();
    unmount();
    render(<PendingList orders={[]} supplierNames={[]} canEdit={false} />);
    expect(screen.getByText("No orders yet.")).toBeVisible();
  });
});

describe("Closed tab", () => {
  it("lists closed orders only (not every stage 6), with stocked quantity, the API's settled and outstanding, date and a Report link", () => {
    render(<ClosedList orders={orders} supplierNames={["Foshan Fabrics"]} canEdit={false} />);
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(cells("PO-2040")).toEqual(["PO-2040", "Foshan Fabrics", "¥1,000.00", "100 pcs", "100 pcs", "¥600.00", "¥400.00", "20 Oct 2026", "Report"]);
    expect(screen.getByRole("link", { name: "Report PO-2040" })).toHaveAttribute("href", "/orders/PO-2040/report");
    expect(screen.getByRole("link", { name: "PO-2040" })).toHaveAttribute("href", "/orders/PO-2040");
  });

  it("filters by closed date and names the empty tab", () => {
    const { unmount } = render(<ClosedList orders={orders} supplierNames={[]} canEdit={false} />);
    fireEvent.change(screen.getByLabelText("Closed date to"), { target: { value: "2026-10-19" } });
    expect(screen.getByText("No orders match these filters.")).toBeVisible();
    unmount();
    render(<ClosedList orders={[orders[0]!, orders[3]!]} supplierNames={[]} canEdit={false} />);
    expect(screen.getByText("No closed orders yet.")).toBeVisible();
  });
});

describe("Closed Orders page", () => {
  it("is the Closed list under its own header: same rows, filters and exports, no Orders tab bar and no + New order", () => {
    render(<ClosedOrdersPageList orders={orders} supplierNames={["Foshan Fabrics"]} canEdit />);
    expect(screen.getByRole("heading", { level: 1, name: "Closed Orders" })).toBeVisible();
    expect(screen.queryByRole("navigation", { name: "Orders lists" })).toBeNull();
    expect(screen.queryByRole("link", { name: "+ New order" })).toBeNull();
    // One "Download report" menu (PDF, Excel, CSV) replaces the separate export buttons.
    expect(screen.getByRole("button", { name: "Download report" })).toBeVisible();
    // Only the closed order: not the pending one, not the stage-2 one, not the stage-6 order with nothing of its own stocked.
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(cells("PO-2040")).toEqual(["PO-2040", "Foshan Fabrics", "¥1,000.00", "100 pcs", "100 pcs", "¥600.00", "¥400.00", "20 Oct 2026", "Report"]);
    expect(screen.getByLabelText("Search PO, item or supplier")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Closed date to"), { target: { value: "2026-10-19" } });
    expect(screen.getByText("No orders match these filters.")).toBeVisible();
  });
});

describe("held accounts in the lists", () => {
  it("show pending review and dashes, never a made-up figure", () => {
    const held = row("PO-2060", { held: true, settledCny: null, outstandingCny: null, paymentStatus: null, depositStatus: null, closed: true, stage: 6, stocked: 100, closedOn: "2026-10-21" });
    const { unmount } = render(<PendingList orders={[{ ...held, stage: 1, closed: false }]} supplierNames={[]} canEdit={false} />);
    expect(cells("PO-2060")).toContain("Pending review");
    unmount();
    render(<ClosedList orders={[held]} supplierNames={[]} canEdit={false} />);
    expect(cells("PO-2060").slice(5, 7)).toEqual(["–", "–"]);
  });
});
