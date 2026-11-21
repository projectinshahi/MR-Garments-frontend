import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api/client";
import type { AdvanceArchiveEntry, AdvanceArchiveResponse } from "@/lib/api/deposits-types";
import { ApiError } from "@/lib/api/errors";
import type { LedgerAccount, LedgerEntry, LedgerOverviewResponse, SupplierLedgerResponse } from "@/lib/api/ledger-types";

import { ADJUSTMENT_NOTICE, AdjustmentDialog, toAdjustmentBody } from "./adjustment-dialog";
import type { SupplierLedgerData } from "./data/queries";
import { ledgerOverviewFile, milestonesFile, statementFile } from "./ledger-files";
import { filterEntries, filterOverview, overviewRows, paymentChoice, stateOf } from "./ledger-logic";
import { LedgerOverviewScreen } from "./ledger-overview-screen";
import { filterMilestones, MilestonesScreen } from "./milestones-screen";
import { SupplierLedgerScreen } from "./supplier-ledger-screen";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/supplier-ledger" }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { post: vi.fn(), delete: vi.fn() } }));
vi.mock("@/lib/today", () => ({ todayInIndia: () => "2026-11-10" }));

const post = vi.mocked(apiClient.post);
const account = (currency: string, balanceCny: number | null, over: Partial<LedgerAccount> = {}): LedgerAccount => ({
  supplierId: "s1",
  currency,
  held: false,
  creditsCny: 5_000,
  debitsCny: 5_000 - (balanceCny ?? 0),
  balanceCny,
  paidInr: 60_000,
  paidInrComplete: true,
  outstandingCny: 0,
  openOrders: 1,
  lastPaymentOn: "2026-11-01",
  ...over,
});
const entry = (id: string, over: Partial<LedgerEntry>): LedgerEntry => ({
  id,
  entryType: "payment",
  currency: "CNY",
  amount: 1_000,
  exchangeRate: 12,
  amountInr: 12_000,
  entryDate: "2026-11-01",
  origin: "app",
  orderId: null,
  po: null,
  paymentId: null,
  advanceEntryId: null,
  reversesId: null,
  notes: null,
  balanceBefore: null,
  balanceAfter: null,
  runningBalance: 0,
  recordedAt: "2026-11-01T05:00:00Z",
  recordedBy: "Anita",
  payment: null,
  advance: null,
  ...over,
});
const payment = { kind: "Payment" as const, payeeRole: "supplier" as const, mode: "Wire", reference: "UTR 5", notes: "", memoPo: null, voided: false, voidedAt: null, voidedBy: null, voidReason: null };

const LEDGER: SupplierLedgerResponse = {
  supplier: { id: "s1", code: "SUP-001", name: "Hangzhou Silk", currency: "CNY", exchangeRate: 12, status: "Active" },
  accounts: [account("CNY", -1_200), account("USD", 0, { creditsCny: 100, debitsCny: 100 }), account("INR", 300)],
  currencyOptions: ["CNY", "INR"],
  // Newest first; the running balance is the account's right after each entry.
  entries: [
    entry("e5", { entryType: "adjustment", amount: -200, entryDate: "2026-11-08", notes: "Freight claim agreed", balanceBefore: -1_000, balanceAfter: -1_200, runningBalance: -1_200, recordedBy: "Suresh" }),
    entry("e4", { entryType: "payment_void", amount: -1_000, entryDate: "2026-11-06", notes: "Entered twice", paymentId: "p2", runningBalance: -1_000 }),
    entry("e3", { entryType: "payment", amount: 1_000, entryDate: "2026-11-05", paymentId: "p2", runningBalance: 0, payment: { ...payment, voided: true, voidedBy: "Suresh", voidReason: "Entered twice" } }),
    entry("e2", { entryType: "payment", amount: 4_000, entryDate: "2026-11-02", paymentId: "p1", runningBalance: -1_000, payment: { ...payment, memoPo: "PO-3001" } }),
    entry("e1", { entryType: "order_debit", amount: -5_000, entryDate: "2026-10-01", orderId: "o1", po: "PO-3001", runningBalance: -5_000, origin: "backfill" }),
  ],
  orders: [
    {
      id: "o1",
      po: "PO-3001",
      orderDate: "2026-10-01",
      stage: 2,
      currency: "CNY",
      exchangeRate: 12,
      valueCny: 5_000,
      held: false,
      settledCny: 3_800,
      outstandingCny: 1_200,
      paymentStatus: "partly",
      settledInr: 45_600,
      depositRequiredCny: 2_000,
      depositSettledCny: 3_800,
      depositPendingCny: 0,
      depositStatus: "met",
    },
  ],
  held: [],
};
const data = (over: Partial<SupplierLedgerData> = {}): SupplierLedgerData => ({
  ledger: LEDGER,
  advances: { supplier: { id: "s1", name: "Hangzhou Silk", currency: "CNY" }, entries: [] },
  deposits: null,
  today: "2026-11-10",
  canEnter: false,
  canFull: false,
  linkPo: true,
  ...over,
});

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe("SupplierLedgerScreen (LED-1)", () => {
  it("labels each account's signed balance: payable, settled, available", () => {
    render(<SupplierLedgerScreen data={data()} />);
    expect(screen.getByText("CNY account").nextSibling).toHaveTextContent("¥1,200.00Payable to supplier");
    expect(screen.getByText("USD account").nextSibling).toHaveTextContent("Settled");
    expect(screen.getByText("INR account").nextSibling).toHaveTextContent("₹300.00Available with supplier");
  });

  it("lists the statement newest first with types, signed amounts, reasons, before/after, actor and the running balance", () => {
    render(<SupplierLedgerScreen data={data()} />);
    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getAllByRole("cell")[1]!.textContent)).toEqual(["Adjustment", "Payment void", "PaymentVoided", "Payment", "Order debitMigrated"]);
    expect(rows[0]).toHaveTextContent("Reason: Freight claim agreed");
    expect(rows[0]).toHaveTextContent("When recorded: Payable to supplier ¥1,000.00 → Payable to supplier ¥1,200.00");
    expect(rows[0]).toHaveTextContent("−¥200.00");
    expect(rows[0]).toHaveTextContent("Suresh");
    expect(rows[1]).toHaveTextContent("Reason: Entered twice");
    expect(rows[2]).toHaveTextContent("Voided by Suresh");
    expect(rows[3]).toHaveTextContent("recorded against PO-3001");
    expect(rows[3]).toHaveTextContent("+¥4,000.00");
    // Balance after: the sign is the label.
    expect(rows[0]).toHaveTextContent("¥1,200.00Payable to supplier");
    expect(rows[2]).toHaveTextContent("Settled");
  });

  it("filters to voids and adjustments (the audit view)", () => {
    expect(filterEntries(LEDGER.entries, { currency: null, type: "audit" }).map((e) => e.id)).toEqual(["e5", "e4"]);
    expect(filterEntries(LEDGER.entries, { currency: "USD", type: null })).toEqual([]);
  });

  it("offers Void on live payment rows only with payments Full, and Record payment / Adjust by access", () => {
    const { unmount } = render(<SupplierLedgerScreen data={data()} />);
    expect(screen.queryByRole("button", { name: /^Void payment/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adjust balance" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Record payment" })).not.toBeInTheDocument();
    unmount();
    render(<SupplierLedgerScreen data={data({ canEnter: true, canFull: true })} />);
    expect(screen.getAllByRole("button", { name: /^Void payment/ })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Adjust balance" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Record payment" })).toBeInTheDocument();
  });

  it("shows the orders' FIFO projection with the deposit milestone, and the archive tabs read-only", async () => {
    const user = userEvent.setup();
    render(<SupplierLedgerScreen data={data({ advances: null })} />);
    await user.click(screen.getByRole("tab", { name: "Orders" }));
    const row = within(screen.getByRole("table")).getByRole("row", { name: /PO-3001/ });
    expect(row).toHaveTextContent("¥3,800.00");
    expect(row).toHaveTextContent("¥1,200.00");
    expect(row).toHaveTextContent("Partly paid");
    expect(row).toHaveTextContent("Deposit met");
    await user.click(screen.getByRole("tab", { name: "Legacy advance history" }));
    expect(screen.getByText("The legacy advance history couldn't be loaded.")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Supplier deposits (archive)" }));
    expect(screen.getByText("The supplier deposits couldn't be loaded.")).toBeInTheDocument();
  });

  it("a held account: the banner, no figures, and its raw records read-only", () => {
    const held = {
      ...LEDGER,
      accounts: [account("CNY", null, { held: true, creditsCny: null, debitsCny: null, outstandingCny: null })],
      currencyOptions: [],
      entries: [],
      orders: [],
      held: [{ currency: "CNY", reason: "Opening balance disputed.", orders: [{ id: "o9", po: "PO-0901", orderDate: "2026-09-01", stage: 1 as const, valueCny: 800 }], payments: [], advanceEntries: [] }],
    };
    render(<SupplierLedgerScreen data={data({ ledger: held, canEnter: true, canFull: true })} />);
    expect(screen.getByRole("status")).toHaveTextContent("This supplier's account is pending review. CNY: Opening balance pending review. Opening balance disputed.");
    expect(screen.getByText("CNY account").nextSibling).toHaveTextContent("Opening balance pending review");
    expect(screen.getByRole("heading", { name: "CNY records pending review (read-only)" })).toBeInTheDocument();
    expect(screen.getByText(/PO-0901/)).toBeInTheDocument();
    // No currency left to adjust; Record payment would be blocked (see RecordPaymentDialog).
    expect(screen.queryByRole("button", { name: "Adjust balance" })).not.toBeInTheDocument();
    expect(paymentChoice(held)).toMatchObject({ held: true, currencyOptions: [], balances: [] });
  });

  it("downloads the statement with signed amounts, running balance, reasons and the orders", () => {
    const file = statementFile(LEDGER, LEDGER.entries, "Supplier: Hangzhou Silk", "2026-11-10");
    expect(file.filename).toBe("supplier-ledger-hangzhou-silk-2026-11-10");
    const statement = file.sections.find((s) => s.title === "Statement (CNY)")!;
    expect(statement.rows.map((r) => [r[1], r[3], r[6], r[7]])).toEqual([
      ["Adjustment", -200, -1_200, "Freight claim agreed"],
      ["Payment void", -1_000, -1_000, "Entered twice"],
      ["Payment", 1_000, 0, null],
      ["Payment", 4_000, -1_000, null],
      ["Order debit", -5_000, -5_000, null],
    ]);
    expect(file.sections.find((s) => s.title === "Accounts")!.rows.map((r) => r[4])).toEqual(["Payable to supplier ¥1,200.00", "Settled", "Available with supplier ₹300.00"]);
  });

  describe("legacy advance history: the owner's excluded receipts", () => {
    const DUPLICATE = "Duplicate: SUP-004 USD 25,000 CASH receipt entered 2026-11-19 14:34Z, a second entry of receipt 547ef798 (14:03Z).";
    const TEST = "Test entry: SUP-009 CNY 1,212 Cash receipt entered 2026-11-20 04:54Z.";
    const receipt = (id: string, over: Partial<AdvanceArchiveEntry> = {}): AdvanceArchiveEntry => ({
      id,
      kind: "receipt",
      amount: 25_000,
      currency: "USD",
      exchangeRate: 101.6,
      amountInr: 2_540_000,
      entryDate: "2026-11-19",
      po: null,
      paymentId: null,
      advanceId: null,
      mode: "CASH",
      reference: "",
      notes: "",
      recordedAt: "2026-11-19T14:03:06Z",
      recordedBy: "Owner",
      exclusionReason: null,
      ...over,
    });
    const advances: AdvanceArchiveResponse = {
      supplier: { id: "s1", name: "Hangzhou Silk", currency: "CNY" },
      entries: [
        receipt("547ef798-3290-4fa4-a5cf-15ca9c8ac9e5"),
        receipt("f2b7966a-0937-485b-94a6-e6a536bfeedc", { recordedAt: "2026-11-19T14:34:51Z", exclusionReason: DUPLICATE }),
        receipt("6ab149cc-bd00-4ef9-90f3-dc6bac5ccb47", { amount: 1212, currency: "CNY", exchangeRate: 12.2, amountInr: 14_786.4, entryDate: "2026-11-20", mode: "Cash", exclusionReason: TEST }),
      ],
    };

    it("marks both with Excluded from ledger and the reason, keeps every recorded detail, and leaves an ordinary receipt as it was", async () => {
      const user = userEvent.setup();
      render(<SupplierLedgerScreen data={data({ advances })} />);
      await user.click(screen.getByRole("tab", { name: "Legacy advance history" }));
      expect(screen.getByText(/except any marked Excluded from ledger/)).toBeInTheDocument();
      const [ordinary, duplicate, test] = within(screen.getByRole("table")).getAllByRole("row").slice(1);
      expect(within(ordinary!).queryByText("Excluded from ledger")).not.toBeInTheDocument();
      expect(ordinary).toHaveTextContent(/Advance received–.*25,000\.00.*CASH/);
      expect(within(duplicate!).getByText("Excluded from ledger")).toBeInTheDocument();
      expect(within(duplicate!).getByText(DUPLICATE)).toBeInTheDocument();
      expect(duplicate).toHaveTextContent(/Advance received.*25,000\.00.*101\.60.*CASH.*Owner/);
      expect(within(test!).getByText("Excluded from ledger")).toBeInTheDocument();
      expect(within(test!).getByText(TEST)).toBeInTheDocument();
      expect(test).toHaveTextContent(/1,212\.00.*Cash/);
    });

    it("are not ledger credits: the statement holds only ledger entries, and the download marks them in the archive sheet", async () => {
      const user = userEvent.setup();
      render(<SupplierLedgerScreen data={data({ advances })} />);
      expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(LEDGER.entries.length + 1);
      expect(screen.queryByText(/25,000|1,212/)).not.toBeInTheDocument();
      await user.click(screen.getByRole("tab", { name: "Legacy advance history" }));
      expect(screen.getAllByText("Excluded from ledger")).toHaveLength(2);

      const file = statementFile(LEDGER, LEDGER.entries, "Supplier: Hangzhou Silk", "2026-11-10", advances);
      const statementRows = file.sections.filter((s) => s.title?.startsWith("Statement")).flatMap((s) => s.rows);
      expect(statementRows).toHaveLength(LEDGER.entries.length);
      expect(statementRows.some((row) => row.includes(25_000) || row.includes(1212))).toBe(false);
      const archive = file.sections.filter((s) => s.sheet === "Legacy Advance");
      expect(archive.map((s) => s.title)).toEqual(["Legacy advance history, archive (CNY)", "Legacy advance history, archive (USD)"]);
      expect(archive[0]!.columns[2]!.header).toBe("Ledger");
      expect(archive.flatMap((s) => s.rows).map((row) => [row[1], row[2], row[4], row[7]])).toEqual([
        ["Advance received", `Excluded from ledger: ${TEST}`, 1212, "Cash"],
        ["Advance received", null, 25_000, "CASH"],
        ["Advance received", `Excluded from ledger: ${DUPLICATE}`, 25_000, "CASH"],
      ]);
    });
  });
});

describe("AdjustmentDialog (LED-3, Management)", () => {
  const supplier = { ...paymentChoice(LEDGER), currencyOptions: ["CNY", "INR"] };
  async function openAdjust() {
    const user = userEvent.setup();
    let n = 0;
    vi.spyOn(globalThis.crypto, "randomUUID").mockImplementation(() => `00000000-0000-4000-8000-00000000000${++n}` as `${string}-${string}-${string}-${string}-${string}`);
    render(
      <AdjustmentDialog supplier={supplier}>
        <button type="button">Adjust</button>
      </AdjustmentDialog>,
    );
    await user.click(screen.getByRole("button", { name: "Adjust" }));
    const dialog = screen.getByRole("dialog");
    return { user, dialog, field: (label: string) => within(dialog).getByLabelText((t) => t.startsWith(label)), submit: within(dialog).getByRole("button", { name: "Record adjustment" }) };
  }

  it("shows the notice, needs a direction and a reason, and sends a decrease as a negative amount with the key", async () => {
    post.mockResolvedValue({ entry: entry("e9", { entryType: "adjustment", amount: -150, currency: "CNY" }), balanceBefore: -1_200, balanceAfter: -1_350 });
    const { user, dialog, field, submit } = await openAdjust();
    expect(dialog).toHaveTextContent(ADJUSTMENT_NOTICE);
    await user.type(field("Amount"), "150");
    await user.click(submit);
    expect(await within(dialog).findByText("Choose increase or decrease.")).toBeInTheDocument();
    expect(within(dialog).getByText("Enter the reason for the adjustment.")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    await user.click(within(dialog).getByLabelText(/Decrease/));
    expect(within(dialog).getByLabelText("Balance now and after")).toHaveTextContent("Payable to supplier ¥1,200.00 → Payable to supplier ¥1,350.00");
    await user.type(field("Reason"), "Short shipment credit reversed");
    await user.click(submit);
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/suppliers/s1/ledger/adjustments", {
        currency: "CNY",
        amount: -150,
        entryDate: "2026-11-10",
        rateInr: 12,
        reason: "Short shipment credit reversed",
        idempotencyKey: "00000000-0000-4000-8000-000000000001",
      }),
    );
    expect(await screen.findByRole("heading", { name: "Adjustment recorded" })).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent("Payable to supplier ¥1,200.00 before, Payable to supplier ¥1,350.00 after.");
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it("a refusal for a final order's settlement shows under Date and the values stay (owner decision 2026-11-21)", async () => {
    const message = "An adjustment on this date would change the payments that settle PO-1, whose landed cost is already final. Choose a later date.";
    post.mockRejectedValueOnce(new ApiError(422, "validation_failed", "Check the fields.", { entryDate: message }));
    const { user, dialog, field, submit } = await openAdjust();
    await user.click(within(dialog).getByLabelText(/Decrease/));
    await user.type(field("Amount"), "100");
    await user.type(field("Reason"), "Supplier refund");
    await user.click(submit);
    expect(await within(dialog).findByText(message)).toBeInTheDocument();
    expect(field("Date")).toHaveAttribute("aria-invalid", "true");
    expect(field("Reason")).toHaveValue("Supplier refund");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("an increase is positive; INR takes no rate; the key stays the same on a retry", async () => {
    post.mockRejectedValueOnce(new ApiError(503, "ledger_maintenance", "Paused.")).mockResolvedValueOnce({ entry: entry("e9", { currency: "INR" }), balanceBefore: 300, balanceAfter: 400 });
    const { user, dialog, field, submit } = await openAdjust();
    await user.click(within(dialog).getByLabelText(/Increase/));
    await user.selectOptions(field("Currency"), "INR");
    expect(within(dialog).queryByLabelText(/Rate/)).not.toBeInTheDocument();
    await user.type(field("Amount"), "100");
    await user.type(field("Reason"), "Rounding");
    await user.click(submit);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Paused for maintenance", { description: "Paused." }));
    await user.click(submit);
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls[0]![1]).toEqual({ currency: "INR", amount: 100, entryDate: "2026-11-10", reason: "Rounding", idempotencyKey: "00000000-0000-4000-8000-000000000001" });
    expect(post.mock.calls[1]![1]).toEqual(post.mock.calls[0]![1]);
  });

  it("builds the signed body", () => {
    expect(toAdjustmentBody({ direction: "increase", amount: 10, currency: "CNY", entryDate: "2026-11-10", rateInr: 12, reason: "r" }, "k").amount).toBe(10);
    expect(toAdjustmentBody({ direction: "decrease", amount: 10, currency: "INR", entryDate: "2026-11-10", rateInr: undefined, reason: "r" }, "k")).toEqual({ currency: "INR", amount: -10, entryDate: "2026-11-10", reason: "r", idempotencyKey: "k" });
  });
});

describe("LedgerOverviewScreen (LED-2)", () => {
  const overview: LedgerOverviewResponse = {
    accounts: [
      { ...account("CNY", -1_200), supplier: "Hangzhou Silk", code: "SUP-001", status: "Active" },
      { ...account("CNY", 500, { supplierId: "s2" }), supplier: "Ningbo Knits", code: "SUP-002", status: "Active" },
      { ...account("CNY", null, { supplierId: "s3", held: true, creditsCny: null, debitsCny: null, outstandingCny: null }), supplier: "Shantou Toys", code: "SUP-010", status: "Active" },
    ],
    totals: [{ currency: "CNY", accounts: 2, balanceCny: -700, payableCny: 1_200, availableCny: 500, outstandingCny: 0 }],
    suppliers: [
      { id: "s1", name: "Hangzhou Silk", status: "Active" },
      { id: "s2", name: "Ningbo Knits", status: "Active" },
      { id: "s3", name: "Shantou Toys", status: "Active" },
      { id: "s4", name: "Yiwu Trims", status: "Active" },
    ],
  };

  it("shows the per-currency totals (held left out), each account signed, held flagged, and suppliers without entries", () => {
    render(<LedgerOverviewScreen data={{ overview, today: "2026-11-10", canEnter: false, canFull: false, linkPo: false }} />);
    expect(screen.getByText("Payable to suppliers").nextSibling).toHaveTextContent("¥1,200");
    expect(screen.getByText("Available with suppliers").nextSibling).toHaveTextContent("¥500");
    expect(screen.getByText("1 pending review, not counted")).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getByRole("row", { name: /Hangzhou Silk/ })).toHaveTextContent("Payable to supplier");
    expect(within(table).getByRole("row", { name: /Ningbo Knits/ })).toHaveTextContent("Available with supplier");
    expect(within(table).getByRole("row", { name: /Shantou Toys/ })).toHaveTextContent("Opening balance pending review");
    expect(within(table).getByRole("row", { name: /Yiwu Trims/ })).toHaveTextContent("No entries yet");
    expect(within(table).getByRole("link", { name: "Hangzhou Silk" })).toHaveAttribute("href", "/supplier-ledger/s1");
  });

  it("filters by balance state and search; the download keeps the filtered rows and the totals", () => {
    const rows = overviewRows(overview);
    expect(rows.map((r) => r.account && stateOf(r.account))).toEqual(["payable", "available", "held", null]);
    expect(filterOverview(rows, { query: "", state: "payable", currency: null }).map((r) => r.supplier)).toEqual(["Hangzhou Silk"]);
    expect(filterOverview(rows, { query: "sup-010", state: "all", currency: null }).map((r) => r.supplier)).toEqual(["Shantou Toys"]);
    const file = ledgerOverviewFile(filterOverview(rows, { query: "", state: "available", currency: null }), "Balance: Available", "2026-11-10");
    expect(file.sections[1]!.rows.map((r) => [r[0], r[5], r[6]])).toEqual([["Ningbo Knits", 500, "Available with supplier ¥500.00"]]);
  });
});

describe("Deposit milestones (DEP-1, D11)", () => {
  const base = { orderDate: "2026-10-01", supplierId: "s1", supplier: "Hangzhou Silk", currency: "CNY", held: false, depositRequiredCny: 2_000 };
  const milestones = [
    { ...base, orderId: "o1", po: "PO-1", depositSettledCny: 0, depositPendingCny: 2_000, depositStatus: "unmet" as const },
    { ...base, orderId: "o2", po: "PO-2", depositSettledCny: 2_500, depositPendingCny: 0, depositStatus: "met" as const },
    { ...base, orderId: "o3", po: "PO-3", supplier: "Shantou Toys", held: true, depositSettledCny: null, depositPendingCny: null, depositStatus: null },
  ];

  it("lists required, settled and pending with the milestone; held orders show pending review", () => {
    render(<MilestonesScreen data={{ milestones, suppliers: [], today: "2026-11-10", linkPo: false }} />);
    const table = screen.getByRole("table");
    expect(within(table).getByRole("row", { name: /PO-1/ })).toHaveTextContent("Deposit not met");
    expect(within(table).getByRole("row", { name: /PO-2/ })).toHaveTextContent("Deposit met");
    expect(within(table).getByRole("row", { name: /PO-3/ })).toHaveTextContent("Pending review");
    expect(within(table).getByRole("link", { name: "Shantou Toys" })).toHaveAttribute("href", "/supplier-ledger/s1");
  });

  it("filters by milestone and search, and exports the same figures", () => {
    expect(filterMilestones(milestones, "", "met").map((m) => m.po)).toEqual(["PO-2"]);
    expect(filterMilestones(milestones, "", "held").map((m) => m.po)).toEqual(["PO-3"]);
    expect(filterMilestones(milestones, "shantou", "all").map((m) => m.po)).toEqual(["PO-3"]);
    expect(milestonesFile(milestones, "All", "2026-11-10").sections[0]!.rows.map((r) => r.slice(3))).toEqual([
      [2_000, 0, 2_000, "Deposit not met"],
      [2_000, 2_500, 0, "Deposit met"],
      [2_000, null, null, "Pending review"],
    ]);
  });
});
