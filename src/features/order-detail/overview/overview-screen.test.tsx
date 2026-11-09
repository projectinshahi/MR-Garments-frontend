import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { OrderView } from "@/features/order-detail/data/queries";

import { OverviewScreen } from "./overview-screen";

// ORD-4 (phase 2 fixes, 1 and 2): the Money card splits supplier payments from the agents' sea freight.
const order = {
  po: "PO-3002",
  item: "Denim jeans",
  stage: 1,
  orderDate: "2026-10-01",
  deliveryDate: "2026-11-19",
  quantity: 100,
  unit: "pcs",
  currency: "CNY",
  supplier: { id: "s1", name: "Hangzhou Silk", contactPerson: "", phone: "", city: "" },
  status: { label: "On track", tone: "success" },
  receipts: null,
  containers: null,
  paidCny: 5_000,
  paidInr: 60_000,
  supplierPaidCny: 5_000,
  supplierPaidInr: 60_000,
  depositRequiredCny: null,
  depositPaidCny: 0,
  depositPendingCny: null,
  depositStatus: "none",
} as OrderView;
const value = (label: string) => screen.getByText(label).nextSibling;

describe("OverviewScreen Money", () => {
  it("shows the supplier's payments in INR, the agents' sea freight only when any, and a pending deposit", () => {
    const { unmount } = render(<OverviewScreen order={order} />);
    expect(value("Paid to supplier ¥5,000")).toHaveTextContent("₹60,000");
    expect(screen.queryByText(/Paid to agents/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Deposit pending/)).not.toBeInTheDocument();
    unmount();

    render(<OverviewScreen order={{ ...order, paidCny: 5_500, paidInr: 66_250, depositRequiredCny: 8_000, depositPaidCny: 5_000, depositPendingCny: 3_000, depositStatus: "partly" }} />);
    expect(value("Paid to supplier ¥5,000")).toHaveTextContent("₹60,000");
    expect(value("Paid to agents (sea freight) ¥500")).toHaveTextContent("₹6,250");
    expect(value("Deposit pending ¥3,000")).toHaveTextContent("Deposit partly paid");
  });

  it("leaves the deposit out once it is paid", () => {
    render(<OverviewScreen order={{ ...order, depositRequiredCny: 8_000, depositPaidCny: 8_000, depositPendingCny: 0, depositStatus: "paid" }} />);
    expect(screen.queryByText(/Deposit pending/)).not.toBeInTheDocument();
  });
});
