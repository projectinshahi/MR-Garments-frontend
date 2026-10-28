import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PaymentsResponse } from "@/lib/api/types";

import { toPaymentsData } from "./data/queries";
import { PaymentsScreen } from "./payments-screen";

vi.mock("@/lib/api/server", () => ({ apiGet: vi.fn() }));
vi.mock("@/lib/session", () => ({ getMe: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));

const api: PaymentsResponse = {
  orders: [
    { orderId: "o1", po: "PO-3001", supplier: "Ningbo Knits", orderValueCny: 10_000, paidCny: 0, paidInr: 0, balanceCny: 10_000, nextDue: null },
    { orderId: "o2", po: "PO-3002", supplier: "Hangzhou Silk", orderValueCny: 20_000, paidCny: 5_000, paidInr: 60_000, balanceCny: 15_000, nextDue: "2026-11-12" },
  ],
  // PAY-1 order: newest first by coalesce(paidOn, dueDate).
  payments: [
    { id: "p2", orderId: "o2", po: "PO-3002", kind: "Balance", payee: "Hangzhou Silk", payeeRole: "supplier", amountCny: 15_000, status: "due", paidOn: null, dueDate: "2026-11-12", rateInr: null, mode: null },
    { id: "p1", orderId: "o2", po: "PO-3002", kind: "Deposit", payee: "Hangzhou Silk", payeeRole: "supplier", amountCny: 5_000, status: "paid", paidOn: "2026-10-01", dueDate: null, rateInr: 12, mode: "Bank transfer" },
  ],
};
type Access = { agents: { id: string; name: string }[] | null; linkPo: boolean };
const renderScreen = (response = api, access: Access = { agents: null, linkPo: false }) =>
  render(<PaymentsScreen data={{ ...toPaymentsData(response, "2026-11-10"), ...access }} />);

describe("PaymentsScreen", () => {
  it("renders the API rows, KPIs and the first order with payments, and no reference fixtures", () => {
    renderScreen();
    const table = screen.getByRole("table");
    expect(within(table).getByRole("row", { name: /PO-3001/ })).toHaveTextContent("Not yet due");
    expect(within(table).getByRole("row", { name: /PO-3002/ })).toHaveTextContent("₹60,000");
    expect(screen.getByText("Paid so far (INR)").nextSibling).toHaveTextContent("₹60,000");
    expect(screen.getByText("across 1 order")).toBeInTheDocument(); // the orders the paid total comes from
    expect(screen.getByText("1 payment · PO-3002 on 12 Nov")).toBeInTheDocument();
    expect(screen.getAllByText("¥15,000")).toHaveLength(2); // due in 7 and 30 days, in CNY

    expect(screen.getByRole("heading", { level: 2, name: "PO-3002 payments" })).toBeInTheDocument();
    // Numbered oldest first, as in 16.
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["1. Deposit", "2. Balance"]);
    expect(screen.getByText("Bank transfer")).toBeInTheDocument();
    expect(screen.getByText("Due 12 Nov")).toBeInTheDocument();
    expect(screen.getByText(/INR covers paid payments only/)).toBeInTheDocument();

    for (const fixture of ["PO-2041", "PO-2049", "Foshan Fabrics", "₹25,15,000"]) {
      expect(screen.queryByText(new RegExp(fixture))).not.toBeInTheDocument();
    }
  });

  it("shows the clicked order's payments, or says it has none", async () => {
    renderScreen();
    await userEvent.click(screen.getByRole("button", { name: "PO-3001" }));
    expect(screen.getByRole("heading", { level: 2, name: "PO-3001 payments" })).toBeInTheDocument();
    expect(screen.getByText("No payments recorded for PO-3001 yet.")).toBeInTheDocument();
  });

  it("hides the selected order's card while the search hides its row, and shows it again after", async () => {
    renderScreen();
    const search = screen.getByRole("searchbox", { name: "Search PO or supplier" });
    await userEvent.type(search, "Ningbo");
    expect(screen.queryByRole("heading", { level: 2, name: "PO-3002 payments" })).not.toBeInTheDocument();
    await userEvent.clear(search);
    expect(screen.getByRole("heading", { level: 2, name: "PO-3002 payments" })).toBeInTheDocument();
  });

  it("offers Record payment only to users who can record, and links the PO when Orders opens", async () => {
    renderScreen();
    expect(screen.queryByRole("button", { name: /Record payment/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "PO-3002" })).not.toBeInTheDocument();
    cleanup();

    renderScreen(api, { agents: [], linkPo: true });
    expect(screen.getByRole("button", { name: "+ Record payment" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "+ Record payment for PO-3002" }));
    expect(screen.getByRole("heading", { name: "Record payment for PO-3002" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("link", { name: "PO-3002" })).toHaveAttribute("href", "/orders/PO-3002");
  });

  it("says so when the API has no orders", () => {
    renderScreen({ orders: [], payments: [] });
    expect(screen.getByText("No orders yet.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: /payments$/ })).not.toBeInTheDocument();
  });
});
