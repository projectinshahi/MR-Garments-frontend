import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { ReceiptListItem } from "@/lib/api/types";

import type { ReceivingListData } from "./data/queries";
import { toReceiptRow } from "./receiving-logic";
import { ReceivingListScreen } from "./receiving-list-screen";

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/receiving",
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock("@/lib/api/client", () => ({ apiClient: { delete: vi.fn() } }));
const remove = vi.mocked(apiClient.delete);

const rec = (
  r: Partial<ReceiptListItem> & Pick<ReceiptListItem, "id" | "orderId" | "po">,
): ReceiptListItem => ({
  receivedOn: "2026-10-20",
  supplier: "Shenzhen Apparel",
  item: "Men's jackets",
  office: "Guangzhou office",
  ordered: 1200,
  unit: "pcs",
  thisReceipt: 700,
  totalSoFar: 700,
  bundles: 14,
  receivedBy: "Wang Fang",
  lines: [{ item: "Men's jackets", unit: "pcs", quantity: 700 }],
  containers: [],
  ...r,
});
// PO-2035: two receipts, the later one's goods partly in a container. PO-2034: one receipt, two lines. PO-2033: an
// older backend without `lines` and `containers`.
const items: ReceiptListItem[] = [
  rec({
    id: "r3",
    orderId: "o35",
    po: "PO-2035",
    receivedOn: "2026-10-24",
    thisReceipt: 460,
    totalSoFar: 1160,
    lines: [{ item: "Men's jackets", unit: "pcs", quantity: 460 }],
    containers: ["TCLU6000001"],
  }),
  rec({
    id: "r2",
    orderId: "o34",
    po: "PO-2034",
    receivedOn: "2026-10-02",
    supplier: "Hangzhou Knits",
    lines: [
      { item: "Men's jackets", unit: "pcs", quantity: 1500 },
      { item: "Cotton fabric", unit: "m", quantity: 300 },
    ],
  }),
  rec({ id: "r1", orderId: "o35", po: "PO-2035", receivedOn: "2026-09-18" }),
  rec({
    id: "r0",
    orderId: "o33",
    po: "PO-2033",
    receivedOn: "2026-09-10",
    lines: undefined,
    containers: undefined,
  }),
];
const data = (canDelete: boolean): ReceivingListData => ({
  receipts: items.map(toReceiptRow),
  kpis: {
    month: "October",
    receiptsThisMonth: 2,
    receiptsSupplierCount: 2,
    waitingToBeReceived: 0,
    partlyReceived: 1,
    partlyReceivedPos: ["PO-2035"],
  },
  offices: ["Guangzhou office"],
  suppliers: ["Hangzhou Knits", "Shenzhen Apparel"],
  canRecord: true,
  canDelete,
  linkPos: true,
});
const headers = () =>
  screen.getAllByRole("columnheader").map((th) => th.textContent);
const deleteOf = (name: RegExp) => screen.getByRole("button", { name });
const ask = () =>
  screen.getByRole("alertdialog", { name: "Delete Goods Receipt?" });

beforeEach(() => vi.clearAllMocks());

describe("Receiving list: Actions (REC-4)", () => {
  it("puts Actions after Status with Delete on every receipt, only for receiving Full", () => {
    const { unmount } = render(<ReceivingListScreen data={data(false)} />);
    expect(headers().at(-1)).toBe("Status");
    expect(
      screen.queryByRole("button", { name: /^Delete receipt/ }),
    ).toBeNull();
    unmount();

    render(<ReceivingListScreen data={data(true)} />);
    expect(headers().slice(-2)).toEqual(["Status", "Actions"]);
    expect(
      screen
        .getAllByRole("button", { name: /^Delete receipt/ })
        .map((b) => b.getAttribute("aria-label")),
    ).toEqual([
      "Delete receipt of PO-2035 on 24 Oct 2026, 460 pcs Men's jackets",
      "Delete receipt of PO-2034 on 2 Oct 2026, 1,500 pcs Men's jackets, 300 m Cotton fabric",
      "Delete receipt of PO-2035 on 18 Sep 2026, 700 pcs Men's jackets",
      // Older backend: the main line from the row.
      "Delete receipt of PO-2033 on 10 Sep 2026, 700 pcs Men's jackets",
    ]);
  });

  it("the dialog names the receipt and what changes; Cancel and Escape send nothing", async () => {
    const user = userEvent.setup();
    render(<ReceivingListScreen data={data(true)} />);

    await user.click(deleteOf(/^Delete receipt of PO-2034/));
    const facts = ask().querySelector("dl")!;
    expect(
      [...facts.querySelectorAll("dt")].map((dt) => [
        dt.textContent,
        dt.nextElementSibling?.textContent,
      ]),
    ).toEqual([
      ["Reference", "r2"],
      ["Order", "PO-2034 · Hangzhou Knits"],
      ["Received", "1,500 pcs Men's jackets, 300 m Cotton fabric"],
      ["Received on", "2 Oct 2026"],
      ["Office", "Guangzhou office"],
      ["Bundles", "14"],
      ["In containers", "None"],
    ]);
    expect(ask()).toHaveTextContent(
      "PO-2034's received quantity goes down by 1,500 pcs Men's jackets, 300 m Cotton fabric. It is the order's only receipt, so the order goes back to waiting to be received.",
    );
    await user.click(within(ask()).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();

    // An order with another receipt keeps it; an older backend shows no container fact.
    await user.click(deleteOf(/^Delete receipt of PO-2035 on 18 Sep/));
    expect(ask()).toHaveTextContent(
      "PO-2035's received quantity goes down by 700 pcs Men's jackets. Its other receipts stay.",
    );
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await user.click(deleteOf(/^Delete receipt of PO-2033/));
    expect(within(ask()).queryByText("In containers")).toBeNull();
    await user.keyboard("{Escape}");

    expect(remove).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("Delete receipt sends one DELETE for that receipt, then toasts and refreshes", async () => {
    const user = userEvent.setup();
    remove.mockResolvedValue(undefined);
    render(<ReceivingListScreen data={data(true)} />);
    await user.click(deleteOf(/^Delete receipt of PO-2035 on 18 Sep/));
    await user.dblClick(
      within(ask()).getByRole("button", { name: "Delete receipt" }),
    );
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(remove.mock.calls).toEqual([["/receipts/r1"]]);
    expect(toast.success).toHaveBeenCalledWith("Receipt deleted");
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("goods in a container: Delete explains which container to delete first, Close only, and sends nothing", async () => {
    const user = userEvent.setup();
    render(<ReceivingListScreen data={data(true)} />);
    await user.click(deleteOf(/^Delete receipt of PO-2035 on 24 Oct/));
    const refused = screen.getByRole("alertdialog", {
      name: "Can't delete receipt",
    });
    expect(refused).toHaveTextContent(
      "This receipt from PO-2035 can't be deleted: container TCLU6000001 already holds goods from it.",
    );
    expect(refused).toHaveTextContent("Delete that container first.");
    expect(refused).toHaveTextContent("In containersTCLU6000001");
    expect(
      within(refused)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Close"]);
    await user.click(within(refused).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(remove).not.toHaveBeenCalled();
  });

  it("the API's refusal (loaded meanwhile) shows its reason; another failure toasts and keeps the dialog", async () => {
    const user = userEvent.setup();
    render(<ReceivingListScreen data={data(true)} />);
    remove.mockRejectedValueOnce(
      new ApiError(403, "forbidden", "You don't have access to this."),
    );
    await user.click(deleteOf(/^Delete receipt of PO-2034/));
    await user.click(
      within(ask()).getByRole("button", { name: "Delete receipt" }),
    );
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(ask()).toBeInTheDocument();
    expect(router.refresh).not.toHaveBeenCalled();

    const reason =
      "This receipt can't be deleted: container TCLU6000009 already holds 300 m of Cotton fabric from it. Delete that container first.";
    remove.mockRejectedValueOnce(new ApiError(409, "in_use", reason));
    await user.click(
      within(ask()).getByRole("button", { name: "Delete receipt" }),
    );
    expect(
      await screen.findByRole("alertdialog", { name: "Can't delete receipt" }),
    ).toHaveTextContent(reason);
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
