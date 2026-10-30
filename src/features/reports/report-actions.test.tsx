import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { PaymentsPerSupplierReport } from "@/lib/api/reports-types";

import { CardDownloads } from "./report-actions";
import { downloadReport } from "./report-files";

vi.mock("next/navigation", () => ({ usePathname: () => "/reports", useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { get: vi.fn() } }));
vi.mock("./report-files", async (actual) => ({ ...(await actual<typeof import("./report-files")>()), downloadReport: vi.fn() }));

const get = vi.mocked(apiClient.get);
const ID = "5f0c7a52-8a0e-4c1e-9d3b-2b9c1f7e4a10";
const REPORT: PaymentsPerSupplierReport = {
  filter: { from: "2026-09-01", to: "2026-09-30", supplier: "Foshan Fabrics" },
  suppliers: [],
  totals: { orders: 0, orderValueCny: 0, paidCny: 0, paidInr: 0, balanceCny: 0 },
  dueNext30Cny: 0,
  finishedPos: [],
};

function card() {
  render(<CardDownloads name="payments-per-supplier" title="Payments and balance due" query={`?period=2026-09&supplier=${ID}`} className="" />);
  return userEvent.setup();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("hub card downloads", () => {
  it("load the report with the hub's filters, as its page does, and save that file", async () => {
    get.mockResolvedValue(REPORT);
    await card().click(screen.getByRole("button", { name: "PDF export: Payments and balance due" }));
    await waitFor(() => expect(downloadReport).toHaveBeenCalledOnce());
    expect(get).toHaveBeenCalledWith(`/reports/payments-per-supplier?from=2026-09-01&to=2026-09-30&supplierId=${ID}`);
    expect(vi.mocked(downloadReport).mock.calls[0]).toEqual([
      expect.objectContaining({ filename: "payments-per-supplier-2026-09", filters: "Period: 1 Sep – 30 Sep 2026 · Supplier: Foshan Fabrics" }),
      "pdf",
    ]);
  });

  it("toast a failure instead of saving nothing silently", async () => {
    get.mockRejectedValue(new ApiError(500, "internal", "Something went wrong."));
    await card().click(screen.getByRole("button", { name: "Excel export: Payments and balance due" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Something went wrong.", { description: "Please try again." }));
    expect(downloadReport).not.toHaveBeenCalled();
  });

  it("send an ended session to sign-in", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    get.mockRejectedValue(new ApiError(401, "unauthorized", "Sign in again."));
    await card().click(screen.getByRole("button", { name: "Excel export: Payments and balance due" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/login?reason=session-ended"));
  });
});
