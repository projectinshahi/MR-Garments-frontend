import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";
import type { AdvanceAccount, SupplierAdvanceResponse } from "@/lib/api/deposits-types";
import { ApiError } from "@/lib/api/errors";

import { AddAdvanceDialog } from "./advance-dialog";
import { advanceSchema, MESSAGES, toAdvanceBody } from "./advance-form";
import { EMPTY_ADVANCE_FILTERS, filterAdvanceEntries, isUnusedReceipt } from "./advance-logic";
import { AdvanceScreen } from "./advance-screen";
import type { AdvanceData } from "./data/queries";

// Supplier advance (backend docs/supplier-advance.md): the Add advance form (21) and the tab's supplier choice and
// transaction filters (22).

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/deposits/advance", useSearchParams: () => new URLSearchParams() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { post: vi.fn(), delete: vi.fn() } }));
vi.mock("@/lib/api/server", () => ({ apiGet: vi.fn() }));
vi.mock("@/lib/session", () => ({ getMe: vi.fn() }));
vi.mock("@/lib/today", () => ({ todayInIndia: () => "2026-11-17" }));

const post = vi.mocked(apiClient.post);
const SUPPLIER: SupplierAdvanceResponse["supplier"] = { id: "s1", name: "Foshan Fabrics", currency: "CNY", exchangeRate: 12.5, status: "Active" };
const entry = (over: Partial<AdvanceAccount["entries"][number]>): AdvanceAccount["entries"][number] => ({
  id: "e",
  kind: "receipt",
  entryDate: "2026-11-01",
  currency: "CNY",
  amount: 1000,
  exchangeRate: 12.5,
  amountInr: 12500,
  advanceId: null,
  advancePaidOn: null,
  advanceReference: null,
  reversalOf: null,
  orderId: null,
  po: "",
  mode: "Bank transfer",
  reference: "UTR-1",
  notes: "",
  recordedAt: "2026-11-01T05:00:00Z",
  recordedBy: "Anita Joseph",
  balance: 1000,
  ...over,
});
// Newest first, as ADV-1 sends them.
const ENTRIES = [
  entry({ id: "r2", kind: "reversal", entryDate: "2026-11-12", amount: 200, advanceId: "a1", reversalOf: "l1", orderId: null, po: "PO-2051", balance: 1000, mode: "" }),
  entry({ id: "l1", kind: "allocation", entryDate: "2026-11-10", amount: 200, advanceId: "a1", orderId: "o1", po: "PO-2051", balance: 800, mode: "" }),
  entry({ id: "a2", kind: "receipt", entryDate: "2026-11-05", amount: 500, reference: "UTR-2", balance: 1000 }),
  entry({ id: "a1", kind: "receipt", entryDate: "2026-11-01", amount: 500, balance: 500 }),
];
const ACCOUNT: SupplierAdvanceResponse = {
  supplier: SUPPLIER,
  summary: [{ currency: "CNY", receivedCny: 1000, allocatedCny: 200, reversedCny: 200, availableCny: 1000, orders: 1 }],
  entries: ENTRIES,
};
const data = (over: Partial<AdvanceData> = {}): AdvanceData => ({
  suppliers: [
    { id: "s1", name: "Foshan Fabrics" },
    { id: "s2", name: "Hangzhou Knits" },
  ],
  advances: [{ supplierId: "s1", supplier: "Foshan Fabrics", currency: "CNY", receivedCny: 1000, allocatedCny: 200, reversedCny: 200, availableCny: 1000, orders: 1 }],
  account: ACCOUNT,
  today: "2026-11-17",
  canEnter: true,
  canDelete: true,
  linkPo: true,
  ...over,
});

beforeEach(() => vi.clearAllMocks());

describe("21. Add advance form", () => {
  const schema = advanceSchema("2026-11-17", "CNY");
  const valid = { amount: "1,000.50", paidOn: "2026-11-17", rateInr: "12.5", mode: "Cash", reference: "", notes: "" };

  it("accepts a valid advance and drops empty extras from the body", () => {
    const parsed = schema.parse(valid);
    expect(toAdvanceBody(parsed)).toEqual({ amount: 1000.5, paidOn: "2026-11-17", rateInr: 12.5, mode: "Cash" });
  });

  it("refuses zero, negative, over-precise or unreadable amounts, a future date, no rate and no mode", () => {
    for (const amount of ["0", "-5", "10.123", "abc", ""]) expect(schema.safeParse({ ...valid, amount }).error?.issues[0]?.message, amount).toBe(MESSAGES.amount);
    expect(schema.safeParse({ ...valid, paidOn: "2026-11-18" }).error?.issues[0]?.message).toBe(MESSAGES.future);
    expect(schema.safeParse({ ...valid, rateInr: "" }).error?.issues[0]?.message).toBe(MESSAGES.rateInr);
    expect(schema.safeParse({ ...valid, mode: "  " }).error?.issues[0]?.message).toBe(MESSAGES.mode);
  });

  it("an INR supplier takes no rate and sends none", () => {
    expect(toAdvanceBody(advanceSchema("2026-11-17", "INR").parse({ ...valid, rateInr: "" }))).toEqual({ amount: 1000.5, paidOn: "2026-11-17", mode: "Cash" });
  });

  it("opens with today and the supplier's rate, posts without an order, and shows a server 422 under its field", async () => {
    const user = userEvent.setup();
    render(
      <AddAdvanceDialog supplier={SUPPLIER}>
        <Button>Open</Button>
      </AddAdvanceDialog>,
    );
    await user.click(screen.getByRole("button", { name: "Open" }));
    const dialog = screen.getByRole("dialog");
    const field = (label: string) => within(dialog).getByLabelText((text) => text.startsWith(label));
    expect(field("Paid on")).toHaveValue("2026-11-17");
    expect(field("Rate")).toHaveValue("12.5");
    expect(field("Currency")).toHaveAttribute("readonly");
    await user.click(within(dialog).getByRole("button", { name: "Add advance" }));
    expect(await within(dialog).findByText(MESSAGES.amount)).toBeVisible();
    expect(within(dialog).getByText(MESSAGES.mode)).toBeVisible();
    expect(post).not.toHaveBeenCalled();

    post.mockRejectedValueOnce(new ApiError(422, "validation_failed", "Check the form.", { amount: "Server says no." }));
    await user.type(field("Amount"), "2500");
    await user.type(field("Payment mode"), "Bank transfer");
    fireEvent.change(field("Paid on"), { target: { value: "2026-11-10" } });
    await user.click(within(dialog).getByRole("button", { name: "Add advance" }));
    expect(await within(dialog).findByText("Server says no.")).toBeVisible();
    expect(post).toHaveBeenCalledWith("/suppliers/s1/advances", { amount: 2500, paidOn: "2026-11-10", rateInr: 12.5, mode: "Bank transfer" });

    post.mockResolvedValueOnce({});
    await user.click(within(dialog).getByRole("button", { name: "Add advance" }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
  });
});

describe("22. supplier selection and transaction filtering", () => {
  it("filters by type, date range and PO, keeping the ledger's balance", () => {
    expect(filterAdvanceEntries(ENTRIES, { ...EMPTY_ADVANCE_FILTERS, kind: "receipt" }).map((e) => e.id)).toEqual(["a2", "a1"]);
    expect(filterAdvanceEntries(ENTRIES, { ...EMPTY_ADVANCE_FILTERS, from: "2026-11-05", to: "2026-11-10" }).map((e) => e.id)).toEqual(["l1", "a2"]);
    expect(filterAdvanceEntries(ENTRIES, { ...EMPTY_ADVANCE_FILTERS, po: "po-2051" }).map((e) => [e.id, e.balance])).toEqual([
      ["r2", 1000],
      ["l1", 800],
    ]);
    expect(isUnusedReceipt(ENTRIES[3]!, ACCOUNT)).toBe(false);
    expect(isUnusedReceipt(ENTRIES[2]!, ACCOUNT)).toBe(true);
  });

  it("without a supplier lists every account and opens one on a row click", async () => {
    const user = userEvent.setup();
    render(<AdvanceScreen data={data({ account: null })} />);
    expect(screen.queryByRole("button", { name: "+ Add advance" })).toBeNull();
    await user.click(screen.getByRole("cell", { name: "Foshan Fabrics" }));
    expect(router.push).toHaveBeenCalledWith("/deposits/advance?supplier=s1");
  });

  it("shows the supplier's summary and transactions, and narrows them with the filters", async () => {
    const user = userEvent.setup();
    render(<AdvanceScreen data={data()} />);
    expect(screen.getByRole("heading", { name: "Foshan Fabrics" })).toBeVisible();
    expect(screen.getByText("Available advance").nextSibling).toHaveTextContent("¥1,000");
    expect(screen.getByText("Related orders").nextSibling).toHaveTextContent("1");
    const rows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(rows()).toHaveLength(4);
    expect(rows()[1]).toHaveTextContent("Applied to order");
    expect(rows()[1]).toHaveTextContent("−¥200");
    // The reversal's order was deleted: its PO stays, unlinked.
    expect(rows()[0]).toHaveTextContent("order deleted");
    await user.type(screen.getByLabelText("Search PO"), "2051");
    expect(rows()).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(rows()).toHaveLength(4);
    expect(screen.getByRole("button", { name: "+ Add advance" })).toBeVisible();
    // Delete only on receipts (Management).
    expect(screen.getAllByRole("button", { name: /^Delete advance of/ })).toHaveLength(2);
  });
});

describe("orders still to pay: Apply advance (ADV-4) for an advance recorded after the order", () => {
  const open = (po: string, currency: "CNY" | "USD", balanceCny: number) => ({ po, orderDate: "2026-11-02", currency, orderValueCny: 3000, paidCny: 500, advanceCny: 0, balanceCny });

  it("lists the supplier's orders still owing; Apply advance only where advance is available in the order's currency, with payments Enter", () => {
    const account = { ...ACCOUNT, openOrders: [open("PO-2040", "CNY", 2500), open("PO-2041", "USD", 900)] };
    const { unmount } = render(<AdvanceScreen data={data({ account })} />);
    expect(screen.getByRole("heading", { name: "Orders still to pay" })).toBeVisible();
    expect(screen.getByRole("row", { name: /PO-2040/ })).toHaveTextContent("¥2,500");
    expect(screen.getByRole("button", { name: "Apply supplier advance to PO-2040" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Apply supplier advance to PO-2041" })).toBeNull();
    unmount();
    render(<AdvanceScreen data={data({ account, canEnter: false })} />);
    expect(screen.queryByRole("button", { name: /Apply supplier advance/ })).toBeNull();
  });

  it("is left out when nothing is owed", () => {
    render(<AdvanceScreen data={data({ account: { ...ACCOUNT, openOrders: [] } })} />);
    expect(screen.queryByRole("heading", { name: "Orders still to pay" })).toBeNull();
  });
});
