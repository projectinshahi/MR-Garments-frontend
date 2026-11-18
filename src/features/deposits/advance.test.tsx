import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";
import type { AdvanceAccount, SupplierAdvanceResponse } from "@/lib/api/deposits-types";
import { ApiError } from "@/lib/api/errors";

import { AddAdvanceDialog } from "./advance-dialog";
import { advanceOverviewFile } from "./deposit-files";
import { advanceSchema, MESSAGES, toAdvanceBody } from "./advance-form";
import { EMPTY_ADVANCE_FILTERS, filterAdvanceEntries, filterSupplierRows, isUnusedReceipt, netApplied, supplierAdvanceRows } from "./advance-logic";
import { AdvanceOverviewScreen } from "./advance-screen";
import { AdvanceSupplierScreen } from "./advance-supplier-screen";
import type { AdvanceOverviewData, AdvanceSupplierData } from "./data/queries";

// Supplier advance (backend docs/supplier-advance.md): the Add advance form (21), the supplier-wise overview and one
// supplier's page with its transaction filters (22).

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
const ADVANCES: AdvanceOverviewData["advances"] = [
  { supplierId: "s1", supplier: "Foshan Fabrics", currency: "CNY", receivedCny: 1000, allocatedCny: 200, reversedCny: 200, availableCny: 1000, orders: 1 },
  { supplierId: "s1", supplier: "Foshan Fabrics", currency: "USD", receivedCny: 300, allocatedCny: 120, reversedCny: 0, availableCny: 180, orders: 1 },
  { supplierId: "s3", supplier: "Yiwu Trims Ltd.", currency: "CNY", receivedCny: 5000, allocatedCny: 0, reversedCny: 0, availableCny: 5000, orders: 0 },
];
const overview = (over: Partial<AdvanceOverviewData> = {}): AdvanceOverviewData => ({
  suppliers: [
    { id: "s2", name: "Hangzhou Knits" },
    { id: "s1", name: "Foshan Fabrics" },
    { id: "s3", name: "Yiwu Trims Ltd." },
  ],
  advances: ADVANCES,
  today: "2026-11-17",
  canEnter: true,
  ...over,
});
const DETAILS: AdvanceSupplierData["details"] = { id: "s1", name: "Foshan Fabrics", contactPerson: "Mr. Chen Hao", phone: "+86 137 2288 5501", city: "Foshan", currency: "CNY", status: "Active" };
const data = (over: Partial<AdvanceSupplierData> = {}): AdvanceSupplierData => ({
  account: ACCOUNT,
  details: DETAILS,
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

describe("22. supplier-wise overview", () => {
  it("gives every supplier its own row, with an account per currency and nothing added across suppliers or currencies", () => {
    const rows = supplierAdvanceRows(overview().suppliers, ADVANCES);
    // Suppliers holding an advance first, then by name; a supplier without one keeps an empty account list.
    expect(rows.map((row) => [row.supplier, row.accounts.map((a) => `${a.currency} ${a.availableCny}`), row.orders])).toEqual([
      ["Foshan Fabrics", ["CNY 1000", "USD 180"], 2],
      ["Yiwu Trims Ltd.", ["CNY 5000"], 0],
      ["Hangzhou Knits", [], 0],
    ]);
    expect(netApplied({ allocatedCny: 200, reversedCny: 200 })).toBe(0);
    expect(netApplied({ allocatedCny: 120.1, reversedCny: 20.05 })).toBe(100.05);
    expect(filterSupplierRows(rows, { query: "  yiwu ", withAdvance: false }).map((r) => r.supplier)).toEqual(["Yiwu Trims Ltd."]);
    expect(filterSupplierRows(rows, { query: "", withAdvance: true }).map((r) => r.supplier)).toEqual(["Foshan Fabrics", "Yiwu Trims Ltd."]);
    // The download: one row per supplier and currency (applied, returned, applied net), never a total row.
    const file = advanceOverviewFile(rows, "All suppliers", "2026-11-17");
    expect(file.sections[0]!.rows).toEqual([
      ["Foshan Fabrics", "CNY", 1000, 200, 200, 0, 1000, 1],
      ["Foshan Fabrics", "USD", 300, 120, 0, 120, 180, 1],
      ["Yiwu Trims Ltd.", "CNY", 5000, 0, 0, 0, 5000, 0],
      ["Hangzhou Knits", null, null, null, null, null, null, 0],
    ]);
  });

  it("lists each supplier with its currencies apart, filters them, and opens one by row, name or View", async () => {
    const user = userEvent.setup();
    render(<AdvanceOverviewScreen data={overview()} />);
    const rows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(rows()).toHaveLength(3);
    const foshan = screen.getByRole("row", { name: /Foshan Fabrics/ });
    expect(foshan).toHaveTextContent("CNY · USD · 2 orders used it");
    // Per currency, never one sum: recorded ¥1,000 and $300; applied net ¥0 and $120; available ¥1,000 and $180.
    expect(foshan).toHaveTextContent("¥1,000$300¥0$120¥1,000$180");
    expect(screen.getByRole("row", { name: /Hangzhou Knits/ })).toHaveTextContent("No advance yet");
    expect(screen.getByText("2 of 3 suppliers hold an advance")).toBeVisible();
    expect(screen.getByRole("link", { name: "Foshan Fabrics" })).toHaveAttribute("href", "/deposits/advance/s1");
    expect(screen.getByRole("link", { name: "Open Foshan Fabrics's advance" })).toHaveAttribute("href", "/deposits/advance/s1");

    await user.type(screen.getByLabelText("Search supplier"), "hang");
    expect(rows()).toHaveLength(1);
    await user.clear(screen.getByLabelText("Search supplier"));
    await user.type(screen.getByLabelText("Search supplier"), "zzz");
    expect(screen.getByText("No suppliers match these filters.")).toBeVisible();
    await user.clear(screen.getByLabelText("Search supplier"));
    await user.click(within(screen.getByRole("row", { name: /Yiwu Trims/ })).getByText(/not used yet/));
    expect(router.push).toHaveBeenCalledWith("/deposits/advance/s3");
  });

  it("says so when there are no suppliers", () => {
    render(<AdvanceOverviewScreen data={overview({ suppliers: [], advances: [] })} />);
    expect(screen.getByText("No suppliers yet. Add one under Suppliers.")).toBeVisible();
  });
});

describe("22. one supplier's advance page", () => {
  it("filters by type, date range and reference or PO, keeping the ledger's balance", () => {
    expect(filterAdvanceEntries(ENTRIES, { ...EMPTY_ADVANCE_FILTERS, kind: "receipt" }).map((e) => e.id)).toEqual(["a2", "a1"]);
    expect(filterAdvanceEntries(ENTRIES, { ...EMPTY_ADVANCE_FILTERS, from: "2026-11-05", to: "2026-11-10" }).map((e) => e.id)).toEqual(["l1", "a2"]);
    expect(filterAdvanceEntries(ENTRIES, { ...EMPTY_ADVANCE_FILTERS, po: "po-2051" }).map((e) => [e.id, e.balance])).toEqual([
      ["r2", 1000],
      ["l1", 800],
    ]);
    expect(filterAdvanceEntries(ENTRIES, { ...EMPTY_ADVANCE_FILTERS, po: "utr-2" }).map((e) => e.id)).toEqual(["a2"]);
    expect(isUnusedReceipt(ENTRIES[3]!, ACCOUNT)).toBe(false);
    expect(isUnusedReceipt(ENTRIES[2]!, ACCOUNT)).toBe(true);
  });

  it("shows the supplier, its totals per currency and every transaction, filtered and sortable, with a way back", async () => {
    const user = userEvent.setup();
    render(<AdvanceSupplierScreen data={data()} />);
    expect(screen.getByRole("heading", { level: 1, name: "Foshan Fabrics" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Supplier advance" })).toHaveAttribute("href", "/deposits/advance");
    expect(screen.getByText("Mr. Chen Hao")).toBeVisible();
    expect(screen.getByText("+86 137 2288 5501")).toBeVisible();
    const kpi = (label: string) => screen.getAllByText(label, { selector: "p" })[0]!.parentElement!;
    expect(kpi("Advance recorded")).toHaveTextContent("¥1,000");
    // Applied net: 200 applied, 200 returned from a deleted order.
    expect(kpi("Applied to orders (net)")).toHaveTextContent("¥0after ¥200 returned from orders");
    expect(kpi("Available balance")).toHaveTextContent("¥1,000");
    expect(screen.getByRole("heading", { name: "By currency" })).toBeVisible();

    const history = () => within(screen.getAllByRole("table").at(-1)!).getAllByRole("row").slice(1);
    expect(history()).toHaveLength(4);
    expect(history()[1]).toHaveTextContent("Applied to order");
    expect(history()[1]).toHaveTextContent("−¥200");
    expect(history()[0]).toHaveTextContent("(order deleted)");
    expect(history()[3]).toHaveTextContent("UTR-1Bank transfer");
    await user.type(screen.getByLabelText("Search reference or PO"), "UTR-2");
    expect(history()).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(history()).toHaveLength(4);
    // Sortable: Amount sorts largest first on the first click, then smallest first (the allocation, −¥200).
    await user.click(screen.getByRole("button", { name: /^Amount/ }));
    expect(history()[0]).toHaveTextContent("+¥500");
    await user.click(screen.getByRole("button", { name: /^Amount/ }));
    expect(history()[0]).toHaveTextContent("−¥200");
    expect(screen.getByRole("button", { name: "+ Add advance" })).toBeVisible();
    // Delete only on receipts (Management).
    expect(screen.getAllByRole("button", { name: /^Delete advance of/ })).toHaveLength(2);
  });

  it("shows an empty history with Add advance, and marks an inactive supplier", () => {
    const empty = { ...ACCOUNT, supplier: { ...SUPPLIER, status: "Inactive" as const }, summary: [], entries: [] };
    render(<AdvanceSupplierScreen data={data({ account: empty })} />);
    expect(screen.getByText("No advance recorded for this supplier yet.")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "+ Add advance" })).toHaveLength(2);
    expect(screen.getByText("Inactive")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "By currency" })).toBeNull();
  });

  it("offers no Add advance or Delete without the access", () => {
    render(<AdvanceSupplierScreen data={data({ canEnter: false, canDelete: false })} />);
    expect(screen.queryByRole("button", { name: "+ Add advance" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Delete advance of/ })).toBeNull();
  });
});

describe("orders still to pay: Apply advance (ADV-4) for an advance recorded after the order", () => {
  const open = (po: string, currency: "CNY" | "USD", balanceCny: number) => ({ po, orderDate: "2026-11-02", currency, orderValueCny: 3000, paidCny: 500, advanceCny: 0, balanceCny });

  it("lists the supplier's orders still owing; Apply advance only where advance is available in the order's currency, with payments Enter", () => {
    const account = { ...ACCOUNT, openOrders: [open("PO-2040", "CNY", 2500), open("PO-2041", "USD", 900)] };
    const { unmount } = render(<AdvanceSupplierScreen data={data({ account })} />);
    expect(screen.getByRole("heading", { name: "Orders still to pay" })).toBeVisible();
    expect(screen.getByRole("row", { name: /PO-2040/ })).toHaveTextContent("¥2,500");
    expect(screen.getByRole("button", { name: "Apply supplier advance to PO-2040" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Apply supplier advance to PO-2041" })).toBeNull();
    unmount();
    render(<AdvanceSupplierScreen data={data({ account, canEnter: false })} />);
    expect(screen.queryByRole("button", { name: /Apply supplier advance/ })).toBeNull();
  });

  it("is left out when nothing is owed", () => {
    render(<AdvanceSupplierScreen data={data({ account: { ...ACCOUNT, openOrders: [] } })} />);
    expect(screen.queryByRole("heading", { name: "Orders still to pay" })).toBeNull();
  });
});
