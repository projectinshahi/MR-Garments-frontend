import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { advanceToApply } from "@/features/deposits/apply-advance";
import { advancePreview } from "@/features/order-form/order-totals";
import { apiClient } from "@/lib/api/client";

import { AdvanceBreakdown, AdvanceEntriesCard, PartialAdvanceWarning } from "./advance-breakdown";

// The order's supplier advance (backend docs/supplier-advance.md): the partial warning (23), the breakdown (24) and
// Apply advance (ADV-4) for an advance recorded after the order was placed.

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { post: vi.fn() } }));
const post = vi.mocked(apiClient.post);

const ORDER = {
  po: "PO-2051",
  advanceAvailableCny: 0,
  orderValueCny: 5000,
  supplierPaidCny: 1000,
  advanceCny: 3000,
  advanceInr: 36000,
  advanceStatus: "partial" as const,
  balanceCny: 1000,
  currency: "CNY",
  advanceEntries: [
    {
      id: "l1",
      kind: "allocation" as const,
      entryDate: "2026-11-10",
      currency: "CNY",
      amount: 3000,
      exchangeRate: 12,
      amountInr: 36000,
      advanceId: "a1",
      advancePaidOn: "2026-11-01",
      advanceReference: "UTR-1",
      reversalOf: null,
      orderId: "o1",
      po: "PO-2051",
      mode: "",
      reference: "",
      notes: "",
      recordedAt: "2026-11-10T05:00:00Z",
      recordedBy: "Suresh",
    },
  ],
};

describe("23. partial allocation warning", () => {
  it("says the advance was not enough and what is still to pay", () => {
    render(<PartialAdvanceWarning order={ORDER} />);
    expect(screen.getByRole("status")).toHaveTextContent("Supplier advance was not enough. It covered ¥3,000.00 of this ¥5,000.00 order; ¥1,000.00 is still to be paid");
  });

  it("is not shown when the advance covered the rest, when there was none, or against an older API", () => {
    for (const order of [{ ...ORDER, advanceStatus: "full" as const, balanceCny: 0 }, { ...ORDER, advanceStatus: "none" as const, advanceCny: 0 }, { ...ORDER, advanceStatus: undefined }]) {
      const { container } = render(<PartialAdvanceWarning order={order} />);
      expect(container).toBeEmptyDOMElement();
    }
  });

  it("the New order preview applies the smaller of the advance and what the order owes after supplier deposits", () => {
    expect(advancePreview(5000, 0, 3000)).toEqual({ applied: 3000, remaining: 2000, partial: true });
    expect(advancePreview(2000, 0, 10000)).toEqual({ applied: 2000, remaining: 0, partial: false });
    expect(advancePreview(5000, 1234.56, 10000)).toEqual({ applied: 3765.44, remaining: 0, partial: false });
    expect(advancePreview(5000, 0, 0)).toEqual({ applied: 0, remaining: 5000, partial: false });
  });
});

describe("24. order detail advance breakdown", () => {
  it("lists order total, advance from the supplier account, direct payments and remaining, with the status", () => {
    render(<AdvanceBreakdown order={ORDER} />);
    expect(screen.getByRole("heading", { name: "Supplier advance" })).toBeVisible();
    expect(screen.getByText("Partial")).toBeVisible();
    for (const [label, value] of [
      ["Order total", "¥5,000.00"],
      ["Advance from supplier account", "¥3,000.00"],
      ["Direct payments to supplier", "¥1,000.00"],
      ["Remaining to pay", "¥1,000.00"],
    ]) expect(screen.getByText(label!).parentElement).toHaveTextContent(value!);
  });

  it("lists each allocation at its advance's rate with the INR total, and nothing against an older API", () => {
    render(<AdvanceEntriesCard order={ORDER} />);
    expect(screen.getByText(/Applied to order · ¥3,000.00 at 1 CNY = ₹12.00 · advance of 1 Nov 2026/)).toBeVisible();
    expect(screen.getByText(/Advance applied \(¥3,000.00\) in INR/).parentElement).toHaveTextContent("₹36,000.00");
    const { container } = render(<AdvanceBreakdown order={{ ...ORDER, advanceStatus: undefined }} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("Apply advance (ADV-4): an advance recorded after the order was placed", () => {
  it("applies the smaller of the advance available and the balance", () => {
    expect(advanceToApply(2500, 1000)).toBe(1000);
    expect(advanceToApply(400, 1000)).toBe(400);
    expect(advanceToApply(400, -50)).toBe(0);
  });

  it("is offered only with payments Enter, a balance left and advance available", () => {
    const cases = [
      { order: { ...ORDER, advanceAvailableCny: 2500 }, canApply: false },
      { order: { ...ORDER, advanceAvailableCny: 0 }, canApply: true },
      { order: { ...ORDER, advanceAvailableCny: null }, canApply: true },
      { order: { ...ORDER, advanceAvailableCny: 2500, balanceCny: 0, advanceStatus: "full" as const }, canApply: true },
    ];
    for (const { order, canApply } of cases) {
      const { unmount } = render(<AdvanceBreakdown order={order} canApply={canApply} />);
      expect(screen.queryByRole("button", { name: "Apply supplier advance to PO-2051" })).toBeNull();
      unmount();
    }
  });

  it("asks first, says what will be applied and what is left, then posts ADV-4 once and refreshes", async () => {
    post.mockResolvedValueOnce({ advance: { appliedCny: 4000, changeCny: 1000, availableCny: 1500, balanceCny: 0, status: "full" } });
    render(<AdvanceBreakdown order={{ ...ORDER, advanceAvailableCny: 2500 }} canApply />);
    expect(screen.getByText("¥2,500.00 of supplier advance is available.")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Apply supplier advance to PO-2051" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Apply supplier advance to PO-2051?");
    expect(dialog).toHaveTextContent("¥1,000.00 of the supplier's ¥2,500.00 available advance will be applied to this order. Nothing will be left to pay.");
    expect(post).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Apply ¥1,000.00" }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(post).toHaveBeenCalledExactlyOnceWith("/orders/PO-2051/advance");
  });
});

