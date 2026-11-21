import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { currencyFixture, supplierDraft } from "@/features/settings/data/fixtures";
import type { SuppliersSummary } from "@/lib/api/suppliers-types";
import type { SupplierRow } from "@/lib/api/types";

import { SupplierKpis } from "./suppliers-kpis";
import { SuppliersList } from "./suppliers-list";

vi.mock("next/navigation", () => ({
  usePathname: () => "/suppliers",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const summary: SuppliersSummary = {
  suppliers: { total: 10, active: 10, inactive: 0 },
  openPos: {
    count: 40,
    value: [
      { currency: "CNY", amount: 454_329 },
      { currency: "USD", amount: 1_021_876 },
    ],
    heldCount: 1,
  },
  inTransit: { orders: 0, nextEta: null, arrivingNext7: 0 },
  unpaid: {
    amount: [
      { currency: "CNY", amount: 310_357 },
      { currency: "USD", amount: 922_644 },
    ],
    suppliers: 7,
  },
  upcomingPayments: { windowDays: 7, count: 0, amount: [] },
};

// Open POs (SUP-1) keeps a held account's orders out of its count and value and names them apart; the value wraps
// between currencies instead of running past the card.
describe("Open POs pending review", () => {
  it("the card counts only actionable orders, says how many are pending review, and lets the value wrap", () => {
    const { rerender } = render(<SupplierKpis summary={summary} />);
    const value = screen.getByText(/^PO value:/);
    // The "·" stays with the amount before it (a no-break space), so a line breaks only after it.
    expect(value.textContent).toBe("PO value: ¥4,54,329 · $10,21,876");
    expect(value).toHaveClass("whitespace-normal");
    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.getByText("1 PO pending review, not counted")).toBeInTheDocument();
    // The Unpaid Amount value: each amount a unit of its own (one per line when they don't fit), the "·" drawn only
    // between amounts on the same line; screen readers read the plain text.
    expect(screen.getByText("¥3,10,357 · $9,22,644")).toHaveClass("sr-only");
    const amounts = screen.getByText("¥3,10,357").parentElement!;
    expect(amounts).toHaveAttribute("aria-hidden");
    expect([...amounts.children].map((amount) => amount.textContent)).toEqual(["¥3,10,357", "$9,22,644"]);
    expect(screen.getByText("$9,22,644")).toHaveClass("whitespace-nowrap");
    rerender(<SupplierKpis summary={{ ...summary, openPos: { ...summary.openPos, heldCount: 0 } }} />);
    expect(screen.queryByText(/pending review/)).not.toBeInTheDocument();
  });

  it("the list's Active POs shows a held account's open orders under the count, not in it", () => {
    const row: SupplierRow = {
      id: "s-10",
      code: "SUP-010",
      name: "Held Supplier",
      contactPerson: "",
      phone: "",
      email: "",
      country: "China",
      city: "",
      state: "",
      postalCode: "",
      address: "",
      paymentTerms: "",
      taxNumber: "",
      notes: "",
      currency: "CNY",
      exchangeRate: null,
      rateUpdatedAt: null,
      openOrders: 1,
      openPos: 0,
      heldOpenPos: 1,
      ytdValue: [],
      balance: [],
      heldCurrencies: ["CNY"],
      hasTransactions: true,
      status: "Active",
    };
    render(<SuppliersList suppliers={[row, { ...row, id: "s-1", code: "SUP-001", name: "Plain Supplier", openPos: 2, heldOpenPos: 0, heldCurrencies: [] }]} draft={structuredClone(supplierDraft)} currencies={currencyFixture} />);
    const held = screen.getByRole("row", { name: /Held Supplier/ });
    expect(within(held).getByText("0")).toBeInTheDocument();
    expect(within(held).getByText("+1 pending review")).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /Plain Supplier/ })).queryByText(/pending review/)).not.toBeInTheDocument();
  });
});
