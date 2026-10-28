import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PaymentsResponse } from "@/lib/api/types";

import { toPaymentsData } from "./data/queries";
import { PaymentsScreen } from "./payments-screen";

vi.mock("@/lib/api/server", () => ({ apiGet: vi.fn() }));
vi.mock("sonner", () => ({ toast: { info: vi.fn() } }));

const api: PaymentsResponse = {
  orders: [
    { orderId: "o1", po: "PO-3001", supplier: "Ningbo Knits", orderValueCny: 10_000, paidCny: 0, paidInr: 0, balanceCny: 10_000, nextDue: null },
    { orderId: "o2", po: "PO-3002", supplier: "Hangzhou Silk", orderValueCny: 20_000, paidCny: 5_000, paidInr: 60_000, balanceCny: 15_000, nextDue: "2026-11-12" },
  ],
  payments: [
    { id: "p1", orderId: "o2", po: "PO-3002", kind: "Deposit", payee: "Hangzhou Silk", payeeRole: "supplier", amountCny: 5_000, status: "paid", paidOn: "2026-10-01", dueDate: null, rateInr: 12, mode: "Bank transfer" },
    { id: "p2", orderId: "o2", po: "PO-3002", kind: "Balance", payee: "Hangzhou Silk", payeeRole: "supplier", amountCny: 15_000, status: "due", paidOn: null, dueDate: "2026-11-12", rateInr: null, mode: null },
  ],
};
const renderScreen = (response = api) => render(<PaymentsScreen data={toPaymentsData(response, "2026-11-10")} />);

describe("PaymentsScreen", () => {
  it("renders the API rows, KPIs and the first order with payments, and no reference fixtures", () => {
    renderScreen();
    const table = screen.getByRole("table");
    expect(within(table).getByRole("row", { name: /PO-3001/ })).toHaveTextContent("Not yet due");
    expect(within(table).getByRole("row", { name: /PO-3002/ })).toHaveTextContent("₹60,000");
    expect(screen.getByText("Paid so far (INR)").nextSibling).toHaveTextContent("₹60,000");
    expect(screen.getByText("across 2 open orders")).toBeInTheDocument();
    expect(screen.getByText("1 payment · PO-3002 on 12 Nov")).toBeInTheDocument();
    expect(screen.getAllByText("¥15,000")).toHaveLength(2); // due in 7 and 30 days, in CNY

    expect(screen.getByRole("heading", { level: 2, name: "PO-3002 payments" })).toBeInTheDocument();
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

  it("says so when the API has no orders", () => {
    renderScreen({ orders: [], payments: [] });
    expect(screen.getByText("No orders yet.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: /payments$/ })).not.toBeInTheDocument();
  });
});
