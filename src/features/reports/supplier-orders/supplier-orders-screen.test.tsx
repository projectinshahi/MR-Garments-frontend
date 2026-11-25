import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SupplierOrdersScreen } from "./supplier-orders-screen";
import { data, TODAY } from "./test-fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/reports/supplier-orders",
  useSearchParams: () => new URLSearchParams(),
}));

const page = (over = {}) => ({ data: { ...data, ...over }, today: TODAY, search: "", query: "" });

describe("Supplier order details page (RPT-S1)", () => {
  it("shows one foldable card per supplier with its totals, and every order in full", async () => {
    render(<SupplierOrdersScreen page={page()} linkPos={false} />);
    expect(screen.getByRole("heading", { level: 1, name: "Supplier order details" })).toBeInTheDocument();
    const card = screen.getByRole("heading", { level: 2, name: "Ningbo Knits" }).closest("details")!;
    expect(card).toHaveAttribute("open");
    const summary = card.querySelector("summary")!;
    expect(summary).toHaveTextContent("2 orders");
    expect(summary).toHaveTextContent("No USD rate saved for 1 order");
    expect(summary).toHaveTextContent("₹1,20,000");

    const table = within(card).getByRole("table");
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((th) => th.textContent?.replace(/[^\w)]*$/, ""));
    expect(headers).toEqual(["PO / Date", "Items", "Ordered", "Received", "Rate", "Value (received)", "Dollar Cost", "Paid (settled)", "Outstanding", "Status", "Containers", "Landed Cost"]);
    const cells = (po: string) => within(within(table).getByText(po).closest("tr")!).getAllByRole("cell");
    const usd = cells("PO-2050");
    expect(usd[0]).toHaveTextContent("PO-205010 Oct 2026Report");
    expect(usd[1]).toHaveTextContent("Denim jeansCotton fabric");
    expect(usd[3]).toHaveTextContent("120 pcs30 m");
    expect(usd[4]).toHaveTextContent("$10.00$8.00");
    expect(usd[5]).toHaveTextContent("$1,440PO $1,400USD @ ₹88.00");
    expect(usd[6]!.textContent).toBe("$1,440");
    expect(usd[10]).toHaveTextContent("RPTU 1000001On the sea · ETA 30 Nov 2026 · FOB");
    expect(usd[11]).toHaveTextContent("₹1,20,000");
    expect(usd[11]).toHaveTextContent("Clearing ₹30,000");
    expect(usd[11]).toHaveTextContent("Estimate");
    const cny = cells("PO-2051");
    expect(cny[6]!.textContent).toBe("No USD rate saved");
    expect(cny[10]!.textContent).toBe("Not shipped");
    expect(within(table).queryByText("SUP-001")).not.toBeInTheDocument();

    // The summary line folds the supplier's card.
    await userEvent.click(within(summary).getByText("Ningbo Knits"));
    expect(card).not.toHaveAttribute("open");
  });

  it("says so when no order matches", () => {
    render(<SupplierOrdersScreen page={page({ suppliers: [], summary: { ...data.summary, suppliers: 0, orders: 0, byCurrency: [], dollarCost: { usd: 0, missing: 0 } } })} linkPos={false} />);
    expect(screen.getByText("No orders match these filters.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
