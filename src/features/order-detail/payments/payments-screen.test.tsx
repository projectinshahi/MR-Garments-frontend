import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { OrderView } from "@/features/order-detail/data/queries";
import { OverviewScreen } from "@/features/order-detail/overview/overview-screen";
import { HELD, paymentRow, SETTLED } from "@/features/payments/test-fixtures";
import type { LedgerAccount } from "@/lib/api/ledger-types";

import { PaymentsScreen } from "./payments-screen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/features/order-detail/shared/order-detail-frame", () => ({ OrderContextStrip: () => null }));

/** A SectionCard by its title. */
const card = (title: string) => screen.getByRole("heading", { name: title }).closest("section")!;

// ORD-4 after the unified ledger: a ¥20,000 order settled ¥6,000 from the supplier's account (two credits), ¥500 sea
// freight paid to an agent, and a ¥8,000 deposit required.
const account: LedgerAccount = {
  supplierId: "s1",
  currency: "CNY",
  held: false,
  creditsCny: 6_000,
  debitsCny: 26_000,
  balanceCny: -20_000,
  paidInr: 72_000,
  paidInrComplete: true,
  outstandingCny: 14_000,
  openOrders: 2,
  lastPaymentOn: "2026-11-02",
};
const order = {
  id: "o2",
  po: "PO-3002",
  item: "Denim jeans",
  stage: 1,
  orderDate: "2026-10-01",
  deliveryDate: "2026-11-19",
  quantity: 100,
  unit: "pcs",
  currency: "CNY",
  exchangeRate: 12,
  status: { label: "On track", tone: "success" },
  supplier: { id: "s1", name: "Hangzhou Silk", contactPerson: "", phone: "", city: "" },
  receipts: null,
  containers: null,
  orderValueCny: 20_000,
  ...SETTLED,
  settledCny: 6_000,
  outstandingCny: 14_000,
  paymentStatus: "partly",
  settledInr: 72_200,
  depositRequiredCny: 8_000,
  depositSettledCny: 6_000,
  depositPendingCny: 2_000,
  depositStatus: "partly",
  agentPaidCny: 500,
  agentPaidInr: 6_250,
  paidInr: 78_450,
  slices: [
    { entryId: "e1", entryType: "payment", paymentId: "p1", advanceEntryId: null, entryDate: "2026-10-05", amount: 5_000, exchangeRate: 12, amountInr: 60_000, mode: "Bank transfer", reference: "UTR 1", memoPo: "PO-3002" },
    { entryId: "e2", entryType: "payment", paymentId: "p7", advanceEntryId: null, entryDate: "2026-11-02", amount: 1_000, exchangeRate: 12.2, amountInr: 12_200, mode: "Wire", reference: "UTR 7", memoPo: null },
  ],
  supplierAccount: account,
  payments: [],
} as unknown as OrderView;
const memo = paymentRow("p1", { orderId: "o2", po: "PO-3002", kind: "Deposit", reference: "UTR 1" });
const freight = paymentRow("p2", { orderId: "o2", po: "PO-3002", kind: "Balance", payeeRole: "agent", payee: "Sino Freight", amountCny: 500, amountInr: 6_250, rateInr: 12.5 });
const voided = paymentRow("p3", { orderId: "o2", po: "PO-3002", kind: "Balance", amountCny: 900, voided: true, voidReason: "Wrong PO" });

describe("Order Payments tab (ORD-4, unified ledger)", () => {
  it("shows value, settled, outstanding with status, the deposit milestone and sea freight, from the API", () => {
    render(<PaymentsScreen order={order} payments={[memo, freight]} />);
    expect(screen.getByText("Settled", { selector: "p" }).nextSibling).toHaveTextContent("¥6,000.00");
    expect(screen.getByText("Outstanding", { selector: "p" }).nextSibling).toHaveTextContent("¥14,000.00");
    expect(screen.getByText("Outstanding", { selector: "p" }).parentElement).toHaveTextContent("Partly paid");
    expect(screen.getByText("Deposit required").parentElement).toHaveTextContent("Deposit partly met · ¥2,000.00 pending");
    expect(screen.getByText("Sea freight").parentElement).toHaveTextContent("₹6,250 to agents");
  });

  it("lists what settled the order, each credit at its own rate, with the totals the API gives", () => {
    render(<PaymentsScreen order={order} payments={[]} />);
    const settled = within(card("Settled by").querySelector("table")!);
    expect(settled.getByRole("row", { name: /UTR 1/ })).toHaveTextContent("Payment (recorded against PO-3002)");
    expect(settled.getByRole("row", { name: /UTR 7/ })).toHaveTextContent("₹12,200");
    expect(settled.getByRole("row", { name: /^Settled/ })).toHaveTextContent("¥6,000.00₹72,200");
  });

  it("lists the payments naming this PO (legacy memo, sea freight, voided flagged) and the supplier's signed balance", () => {
    render(<PaymentsScreen order={order} payments={[memo, freight, voided]} canVoid />);
    const recorded = within(card("Recorded against PO-3002").querySelector("table")!);
    expect(recorded.getByRole("row", { name: /Deposit \(legacy\)/ })).toHaveTextContent("Paid");
    expect(recorded.getByRole("row", { name: /Sea freight · Balance/ })).toHaveTextContent("Sino Freight");
    expect(within(recorded.getByRole("row", { name: /Wrong PO|Voided/ })).queryByRole("button", { name: /^Void/ })).not.toBeInTheDocument();
    expect(recorded.getAllByRole("button", { name: /^Void payment/ })).toHaveLength(2);
    expect(screen.getByText(/were recorded against this PO before the supplier ledger/)).toBeInTheDocument();
    expect(card("Supplier account")).toHaveTextContent("¥20,000.00Payable to supplier");
    expect(screen.getByRole("link", { name: "Open ledger" })).toHaveAttribute("href", "/supplier-ledger/s1");
  });

  it("offers Record payment (the order's supplier) and Record sea freight payment only when given, and no Apply advance", () => {
    const supplier = { id: "s1", name: "Hangzhou Silk", currency: "CNY", exchangeRate: 12, held: false, currencyOptions: ["CNY"], balances: [] };
    const { unmount } = render(<PaymentsScreen order={order} payments={[]} />);
    expect(screen.queryByRole("button", { name: /Record/ })).not.toBeInTheDocument();
    unmount();
    render(<PaymentsScreen order={order} payments={[]} supplier={supplier} agents={[{ id: "a1", name: "Sino Freight" }]} />);
    expect(screen.getByRole("button", { name: "+ Record payment for Hangzhou Silk" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Record sea freight payment" })).toBeInTheDocument();
    expect(screen.queryByText(/Apply advance|Supplier advance|Excess/)).not.toBeInTheDocument();
  });

  it("a held account: the review message and no figures", () => {
    render(<PaymentsScreen order={{ ...order, ...HELD, supplierAccount: { ...account, held: true, balanceCny: null } } as OrderView} payments={[]} />);
    expect(screen.getAllByRole("status")[0]).toHaveTextContent("This supplier's account is pending review.");
    expect(screen.getByText("Settled", { selector: "p" }).nextSibling).toHaveTextContent("–");
    expect(screen.getByText("Outstanding", { selector: "p" }).parentElement).toHaveTextContent("Pending review");
    expect(card("Supplier account")).toHaveTextContent("Opening balance pending review");
  });
});

describe("Order Overview money (ORD-4)", () => {
  it("shows value, settled, outstanding with status, the deposit milestone, sea freight, INR and the supplier's balance", () => {
    render(<OverviewScreen order={order} />);
    const value = (label: RegExp) => screen.getByText(label).closest("div")!.lastChild;
    expect(value(/^Order value/)).toHaveTextContent("¥20,000.00");
    expect(value(/^Settled from supplier account/)).toHaveTextContent("¥6,000.00");
    expect(screen.getByText(/^Outstanding/).closest("div")).toHaveTextContent("Partly paid¥14,000.00");
    expect(screen.getByText(/^Deposit required/).closest("div")).toHaveTextContent("Deposit required ¥8,000.00 Deposit partly met¥2,000.00 pending");
    expect(value(/^Sea freight to agents/)).toHaveTextContent("₹6,250");
    expect(value(/^Paid \(INR\)/)).toHaveTextContent("₹78,450");
    expect(card("Supplier account")).toHaveTextContent("Payable to supplier");
    expect(screen.queryByText(/advance/i)).not.toBeInTheDocument();
  });

  it("leaves the deposit line out without a requirement", () => {
    render(<OverviewScreen order={{ ...order, depositRequiredCny: null, depositStatus: "none" } as OrderView} />);
    expect(screen.queryByText(/^Deposit required/)).not.toBeInTheDocument();
  });
});
