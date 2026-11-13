import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { PaymentsPerSupplierReport } from "@/lib/api/reports-types";

import { CardDownloads, ReportDownload } from "./report-actions";
import { downloadReport, type ReportFile } from "./report-files";

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
  totalsByCurrency: [],
  dueNext30Cny: 0,
  dueNext30ByCurrency: [],
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

describe("Download report menu", () => {
  const FILE: ReportFile = { title: "Orders", filename: "orders-2026-11-12", filters: "No filters", sections: [] };
  const open = async (file: React.ComponentProps<typeof ReportDownload>["file"]) => {
    const user = userEvent.setup();
    render(<ReportDownload file={file} />);
    await user.click(screen.getByRole("button", { name: "Download report" }));
    return user;
  };

  it("offers PDF, Excel and CSV, and saves the chosen format of the page's file", async () => {
    const user = await open(FILE);
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Download PDF", "Download Excel (.xlsx)", "Download CSV (.csv)"]);
    await user.click(screen.getByRole("menuitem", { name: "Download CSV (.csv)" }));
    await waitFor(() => expect(downloadReport).toHaveBeenCalledWith(FILE, "csv"));
  });

  it("builds a lazy file only when a format is chosen, and runs one download at a time", async () => {
    let finish = () => {};
    vi.mocked(downloadReport).mockReturnValueOnce(new Promise<void>((resolve) => (finish = resolve)));
    const build = vi.fn(async () => FILE);
    const user = await open(build);
    expect(build).not.toHaveBeenCalled();
    await user.click(screen.getByRole("menuitem", { name: "Download PDF" }));
    // While the file is written the button says so and takes no second choice.
    const busy = await screen.findByRole("button", { name: "Preparing report" });
    expect(busy).toBeDisabled();
    expect(busy).toHaveTextContent("Preparing…");
    finish();
    await waitFor(() => expect(screen.getByRole("button", { name: "Download report" })).toBeEnabled());
    expect(build).toHaveBeenCalledOnce();
    expect(downloadReport).toHaveBeenCalledOnce();
  });

  it("toasts a file that could not be written", async () => {
    const user = await open(() => {
      throw new Error("bad data");
    });
    await user.click(screen.getByRole("menuitem", { name: "Download Excel (.xlsx)" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("The report could not be created.", { description: "Please try again." }));
    expect(downloadReport).not.toHaveBeenCalled();
    // The menu is usable again after a failure.
    expect(screen.getByRole("button", { name: "Download report" })).toBeEnabled();
  });

  it("handles an API refusal as every request does", async () => {
    const user = await open(() => Promise.reject(new ApiError(403, "forbidden", "No.")));
    await user.click(screen.getByRole("menuitem", { name: "Download PDF" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("You don't have access to do that."));
  });
});
