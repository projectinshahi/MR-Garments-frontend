import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PaymentsResponse } from "@/lib/api/types";

import { type PaymentsScreenData, toPaymentsData } from "./data/queries";
import { PaymentsScreen } from "./payments-screen";
import { HELD, paymentOrder, paymentRow } from "./test-fixtures";

vi.mock("@/lib/api/server", () => ({ apiGet: vi.fn() }));
vi.mock("@/lib/session", () => ({ getMe: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));

const api: PaymentsResponse = {
  orders: [
    paymentOrder("PO-3002", { nextDue: "2026-11-12", depositRequiredCny: 5_000, depositSettledCny: 4_000, depositPendingCny: 1_000, depositStatus: "partly", agentPaidCny: 500, agentPaidInr: 6_000, paidInr: 54_000 }),
    paymentOrder("PO-3001", { supplier: "Ningbo Knits", supplierId: "s2", settledCny: 10_000, outstandingCny: 0, paymentStatus: "paid" }),
    paymentOrder("PO-3003", { supplier: "Shantou Toys", supplierId: "s9", ...HELD, paidInr: null }),
  ],
  payments: [
    paymentRow("p3", { paidOn: "2026-11-05", amountCny: 2_000, amountInr: 24_000, reference: "UTR 3" }),
    paymentRow("p2", { po: "PO-3002", orderId: "o-PO-3002", payeeRole: "agent", payee: "Sino Freight", kind: "Balance", amountCny: 500, amountInr: 6_000 }),
    paymentRow("p1", { po: "PO-3002", orderId: "o-PO-3002", kind: "Deposit", amountCny: 4_000, amountInr: 48_000, voided: true, voidReason: "Entered twice", voidedBy: "Anita" }),
  ],
  totals: [{ currency: "CNY", accounts: 2, balanceCny: -4_000, payableCny: 6_000, availableCny: 2_000, outstandingCny: 6_000 }],
};
type Access = Pick<PaymentsScreenData, "agents" | "suppliers" | "linkPo" | "canVoid">;
const NONE: Access = { agents: null, suppliers: null, linkPo: false, canVoid: false };
const renderScreen = (access: Partial<Access> = {}) => render(<PaymentsScreen data={{ ...toPaymentsData(api, "2026-11-10"), ...NONE, ...access }} />);
const tables = () => screen.getAllByRole("table");

describe("PaymentsScreen (unified ledger)", () => {
  it("lists every payment, orderless and voided included; a voided one is flagged and counts in no KPI", () => {
    renderScreen();
    expect(screen.getByRole("heading", { level: 1, name: "Payments" })).toBeInTheDocument();
    const payments = tables()[0]!;
    expect(within(payments).getByRole("row", { name: /UTR 3/ })).toHaveTextContent("Supplier account");
    expect(within(payments).getByRole("row", { name: /UTR 3/ })).toHaveTextContent("Supplier payment");
    expect(within(payments).getByRole("row", { name: /Sino Freight/ })).toHaveTextContent("Sea freight · Balance");
    const voided = within(payments).getByRole("row", { name: /Deposit \(legacy\)/ });
    expect(within(voided).getByText("Voided")).toHaveAttribute("title", "Entered twice");

    // 24,000 + 6,000: the voided 48,000 is left out.
    expect(screen.getByText("Paid so far (INR)").nextSibling).toHaveTextContent("₹30,000");
    expect(screen.getByText("2 payments · all payees")).toBeInTheDocument();
    expect(screen.getByText("Payable to suppliers").nextSibling).toHaveTextContent("¥6,000");
    expect(screen.getByText("Available with suppliers").nextSibling).toHaveTextContent("¥2,000");
  });

  it("shows each order's API figures: settled, outstanding, status and the deposit milestone; held orders have none", () => {
    renderScreen();
    const orders = tables()[1]!;
    const po2 = within(orders).getByRole("row", { name: /PO-3002/ });
    expect(po2).toHaveTextContent("4,000.00");
    expect(po2).toHaveTextContent("6,000.00");
    expect(po2).toHaveTextContent("Partly paid");
    expect(po2).toHaveTextContent("Deposit partly met");
    expect(within(orders).getByRole("row", { name: /PO-3001/ })).toHaveTextContent("Paid");
    const held = within(orders).getByRole("row", { name: /PO-3003/ });
    expect(held).toHaveTextContent("Pending review");
    expect(held).toHaveTextContent("–");
  });

  it("the selected order's card: figures, the payments naming its PO (memo and sea freight), and Record buttons only with payments Enter", async () => {
    const supplier = { id: "s1", name: "Hangzhou Silk", currency: "CNY", exchangeRate: 12, held: false, currencyOptions: ["CNY"], balances: [] };
    const { unmount } = renderScreen();
    expect(screen.getByRole("heading", { level: 2, name: "PO-3002 payments" })).toBeInTheDocument();
    expect(screen.getByText("Settled from supplier account").nextSibling).toHaveTextContent("¥ 4,000.00");
    expect(screen.getByText("Outstanding").nextSibling).toHaveTextContent("¥ 6,000.00");
    expect(screen.getByText("Paid to agents (sea freight)").nextSibling).toHaveTextContent("¥ 500.00");
    expect(screen.getByRole("article", { name: "1. Deposit (legacy) (voided)" })).toHaveTextContent("Entered twice");
    expect(screen.getByRole("article", { name: "2. Sea freight · Balance" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Record/ })).not.toBeInTheDocument();
    unmount();

    renderScreen({ suppliers: [supplier], agents: [{ id: "a1", name: "Sino Freight" }] });
    expect(screen.getByRole("button", { name: "+ Record payment" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Record payment for Hangzhou Silk" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Record sea freight payment" })).toBeInTheDocument();
    // Another order's supplier is not in ADV-5 (inactive): no supplier button on its card.
    await userEvent.setup().click(within(tables()[1]!).getByRole("button", { name: "PO-3001" }));
    expect(screen.queryByRole("button", { name: /Record payment for/ })).not.toBeInTheDocument();
  });

  it("offers Void only with payments Full, never on a voided payment", () => {
    const { unmount } = renderScreen();
    expect(screen.queryByRole("button", { name: /^Void payment/ })).not.toBeInTheDocument();
    unmount();
    renderScreen({ canVoid: true });
    const payments = tables()[0]!;
    expect(within(payments).getAllByRole("button", { name: /^Void payment/ })).toHaveLength(2);
    expect(within(within(payments).getByRole("row", { name: /Deposit \(legacy\)/ })).queryByRole("button", { name: /^Void/ })).not.toBeInTheDocument();
  });

  it("shows the API's settlement as a visible line in the Status cell and in the order card's payment block", () => {
    const partly = { state: "partly", amountCny: 4_000, usedCny: 1_500, freeCny: 2_500, usedBy: [{ po: "PO-3002", amountCny: 1_500 }] } as const;
    const withSettlement: PaymentsResponse = {
      ...api,
      payments: [
        paymentRow("p3", { reference: "UTR 3", settlement: { state: "unsettled", amountCny: 5_000, usedCny: 0, freeCny: 5_000, usedBy: [] } }),
        paymentRow("p4", { reference: "UTR 4", settlement: { state: "settled", amountCny: 5_000, usedCny: 5_000, freeCny: 0, usedBy: [{ po: "PO-3001", amountCny: 5_000 }] } }),
        paymentRow("p2", { po: "PO-3002", orderId: "o-PO-3002", payeeRole: "agent", payee: "Sino Freight", kind: "Balance", amountCny: 500 }),
        paymentRow("p1", { po: "PO-3002", orderId: "o-PO-3002", kind: "Deposit", amountCny: 4_000, reference: "UTR 1", settlement: { ...partly, usedBy: [...partly.usedBy] } }),
      ],
    };
    render(<PaymentsScreen data={{ ...toPaymentsData(withSettlement, "2026-11-10"), ...NONE }} />);
    const payments = within(tables()[0]!);
    expect(payments.getByRole("row", { name: /UTR 3/ })).toHaveTextContent("PaidUnused");
    expect(payments.getByRole("row", { name: /UTR 4/ })).toHaveTextContent("PaidFully used");
    expect(payments.getByRole("row", { name: /UTR 1/ })).toHaveTextContent("PaidPartly used · ¥1,500.00 of ¥4,000.00");
    expect(payments.getByRole("row", { name: /Sino Freight/ })).not.toHaveTextContent(/used/i);
    const block = screen.getByRole("article", { name: "1. Deposit (legacy)" });
    expect(within(block).getByText("Settlement").nextSibling).toHaveTextContent("Partly used · ¥1,500.00 of ¥4,000.00");
    expect(within(screen.getByRole("article", { name: "2. Sea freight · Balance" })).queryByText("Settlement")).not.toBeInTheDocument();
  });

  it("searches both tables by PO, supplier or reference", async () => {
    renderScreen();
    await userEvent.setup().type(screen.getByRole("searchbox", { name: "Search PO or supplier" }), "utr 3");
    expect(within(tables()[0]!).getAllByRole("row")).toHaveLength(2); // header + the one payment
    expect(screen.getByText("No orders match your search.")).toBeInTheDocument();
  });
  it("keeps the Payments table on its page when a refresh after Edit or Void sends new rows", async () => {
    const user = userEvent.setup();
    const many = (stamp: string): PaymentsResponse => ({
      ...api,
      payments: Array.from({ length: 15 }, (_, i) => paymentRow(`m${i}`, { paidOn: "2026-11-05", reference: `REF-${i}-${stamp}` })),
    });
    const data = (stamp: string) => ({ ...toPaymentsData(many(stamp), "2026-11-10"), ...NONE });
    const { rerender } = render(<PaymentsScreen data={data("a")} />);
    await user.click(screen.getAllByRole("button", { name: "Page 2" })[0]!);
    expect(screen.getByText(/Showing 11 to 15 of 15 payments/)).toBeInTheDocument();
    rerender(<PaymentsScreen data={data("b")} />); // router.refresh(): new arrays, same rows
    await act(() => new Promise((resolve) => setTimeout(resolve, 20))); // TanStack's page reset runs queued, after render
    expect(screen.getByText(/Showing 11 to 15 of 15 payments/)).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /REF-14-b/ })).toBeInTheDocument();
  });
});
