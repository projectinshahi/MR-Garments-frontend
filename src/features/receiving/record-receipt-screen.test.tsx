import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import type { ReceiptOptions } from "@/lib/api/types";

import { RecordReceiptScreen } from "./record-receipt-screen";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }), usePathname: () => "/receiving/new" }));
const post = vi.fn();
vi.mock("@/lib/api/client", () => ({ apiClient: { post: (...args: unknown[]) => post(...args) } }));
const success = vi.fn();
vi.mock("@/lib/feedback", async (original) => ({ ...(await original<typeof import("@/lib/feedback")>()), notifySuccess: (m: string) => success(m) }));
const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (m: string) => toastError(m) } }));

const options: ReceiptOptions = {
  offices: [
    { id: "loc-gz", name: "Guangzhou office" },
    { id: "loc-yw", name: "Yiwu office" },
  ],
  orders: [
    {
      orderId: "o35",
      po: "PO-2035",
      supplier: "Shenzhen Apparel",
      orderValueCny: 72000,
      depositsPaidCny: 40000,
      lines: [
        { orderLineId: "l1", item: "Men's jackets", unit: "pcs", ordered: 1200, receivedEarlier: 700, unitPriceCny: 60 },
        { orderLineId: "l2", item: "Care labels", unit: "pcs", ordered: 1200, receivedEarlier: 700, unitPriceCny: 0 },
      ],
    },
    {
      orderId: "o40",
      po: "PO-2040",
      supplier: "Foshan Fabrics",
      orderValueCny: 5000,
      depositsPaidCny: 1000,
      lines: [{ orderLineId: "l9", item: "Cotton fabric", unit: "m", ordered: 1000, receivedEarlier: 0, unitPriceCny: 5 }],
    },
  ],
};
const data = { options, receipts: [], receivedBy: "Chen Yu", today: "2026-10-27" };

beforeEach(() => vi.clearAllMocks());

async function fillPo2035(user: ReturnType<typeof userEvent.setup>, jackets: string) {
  await user.type(screen.getByRole("textbox", { name: "Bundles received now" }), "9");
  await user.type(screen.getByRole("textbox", { name: "Supplier delivery note no." }), "DN-88214");
  await user.type(screen.getByRole("textbox", { name: "Received now, Men's jackets" }), jackets);
  await user.type(screen.getByRole("textbox", { name: "Received now, Care labels" }), "500");
}

describe("RecordReceiptScreen", () => {
  it("shows the first order, today and the signed-in user, and recalculates the payment", async () => {
    const user = userEvent.setup();
    render(<RecordReceiptScreen data={data} />);
    expect(screen.getByRole("combobox", { name: "Order" })).toHaveValue("o35");
    expect(screen.getByLabelText(/Received on/)).toHaveValue("2026-10-27");
    expect(screen.getByRole("textbox", { name: "Received by" })).toHaveValue("Chen Yu");
    expect(screen.getByText("Partly received")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Received now, Men's jackets" }), "460");
    expect(screen.getByText("Short: 40 pcs × ¥60")).toBeInTheDocument();
    expect(screen.getByText("¥ 29,600")).toBeInTheDocument();
    expect(screen.getByText("No deliveries yet.")).toBeInTheDocument();
  });

  it("blocks over-receipt in the browser", async () => {
    const user = userEvent.setup();
    render(<RecordReceiptScreen data={data} />);
    await fillPo2035(user, "501");
    await user.click(screen.getByRole("button", { name: "Save receipt" }));
    expect(await screen.findByText("Only 500 pcs left to receive.")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("asks for at least one quantity", async () => {
    const user = userEvent.setup();
    render(<RecordReceiptScreen data={data} />);
    await user.type(screen.getByRole("textbox", { name: "Bundles received now" }), "0");
    await user.click(screen.getByRole("button", { name: "Save receipt" }));
    expect(await screen.findByText("Enter what was received for at least one item.")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("posts exactly the REC-3 body, says so and goes to the list", async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ receipt: { id: "r9" } });
    render(<RecordReceiptScreen data={data} />);
    await user.selectOptions(screen.getByRole("combobox", { name: /Received at office/ }), "loc-yw");
    await fillPo2035(user, "460");
    await user.type(screen.getByRole("textbox", { name: /Short remark/ }), "40 jackets not delivered.");
    await user.click(screen.getByRole("button", { name: "Save receipt" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/receiving"));
    expect(post).toHaveBeenCalledWith("/receipts", {
      orderId: "o35",
      receivedOn: "2026-10-27",
      locationId: "loc-yw",
      bundles: 9,
      deliveryNote: "DN-88214",
      shortRemark: "40 jackets not delivered.",
      lines: [
        { orderLineId: "l1", quantity: 460 },
        { orderLineId: "l2", quantity: 500 },
      ],
    });
    expect(success).toHaveBeenCalledWith("Receipt saved");
    expect(refresh).toHaveBeenCalled();
  });

  it("switches the lines with the order", async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ receipt: { id: "r9" } });
    render(<RecordReceiptScreen data={data} />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Order" }), "o40");
    expect(screen.queryByRole("textbox", { name: "Received now, Men's jackets" })).not.toBeInTheDocument();
    expect(screen.queryByText("Partly received")).not.toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Bundles received now" }), "2");
    await user.type(screen.getByRole("textbox", { name: "Received now, Cotton fabric" }), "1000");
    await user.click(screen.getByRole("button", { name: "Save receipt" }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0]![1]).toMatchObject({ orderId: "o40", lines: [{ orderLineId: "l9", quantity: 1000 }] });
  });

  it("shows the API's 422 field error under its field", async () => {
    const user = userEvent.setup();
    post.mockRejectedValue(new ApiError(422, "validation_failed", "Some fields need attention.", { bundles: "Enter the bundles." }));
    render(<RecordReceiptScreen data={data} />);
    await fillPo2035(user, "460");
    await user.type(screen.getByRole("textbox", { name: /Short remark/ }), "40 to follow.");
    await user.click(screen.getByRole("button", { name: "Save receipt" }));
    expect(await screen.findByText("Enter the bundles.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Bundles received now" })).toHaveFocus();
    expect(push).not.toHaveBeenCalled();
  });

  it("marks the short remark required only while a line is still short", async () => {
    const user = userEvent.setup();
    render(<RecordReceiptScreen data={data} />);
    const remark = screen.getByRole("textbox", { name: /Short remark/ });
    expect(remark).toHaveAttribute("aria-required", "true");
    expect(screen.getByText(/Short remark/)).toHaveTextContent("Short remark *");
    await fillPo2035(user, "500");
    expect(remark).toHaveAttribute("aria-required", "false");
    expect(screen.getByText(/Short remark/)).not.toHaveTextContent("*");
  });

  it("blocks a short receipt without a remark in the browser", async () => {
    const user = userEvent.setup();
    render(<RecordReceiptScreen data={data} />);
    await fillPo2035(user, "460");
    await user.type(screen.getByRole("textbox", { name: /Short remark/ }), "   ");
    await user.click(screen.getByRole("button", { name: "Save receipt" }));
    expect(await screen.findByText("Add a remark about the short items.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Short remark/ })).toHaveFocus();
    expect(post).not.toHaveBeenCalled();
  });

  it("saves a complete receipt with no remark", async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ receipt: { id: "r9" } });
    render(<RecordReceiptScreen data={data} />);
    await fillPo2035(user, "500");
    await user.click(screen.getByRole("button", { name: "Save receipt" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/receiving"));
    expect(post.mock.calls[0]![1]).toMatchObject({ shortRemark: "" });
  });

  it("shows every API field message: orderId and shortRemark under their fields, unknown ones as toasts", async () => {
    const user = userEvent.setup();
    post.mockRejectedValue(
      new ApiError(422, "validation_failed", "Some fields need attention.", {
        orderId: "Choose an order from the list.",
        shortRemark: "Add a remark about the short items.",
        form: "Something about the whole receipt.",
      }),
    );
    render(<RecordReceiptScreen data={data} />);
    await fillPo2035(user, "500");
    await user.click(screen.getByRole("button", { name: "Save receipt" }));
    expect(await screen.findByText("Choose an order from the list.")).toBeInTheDocument();
    expect(screen.getByText("Add a remark about the short items.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Order" })).toHaveFocus();
    expect(toastError).toHaveBeenCalledWith("Something about the whole receipt.");
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("shows the 409 order_not_receivable message", async () => {
    const user = userEvent.setup();
    post.mockRejectedValue(new ApiError(409, "order_not_receivable", "This order is past receiving and can't take more receipts."));
    render(<RecordReceiptScreen data={data} />);
    await fillPo2035(user, "500");
    await user.click(screen.getByRole("button", { name: "Save receipt" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("This order is past receiving and can't take more receipts."));
    expect(push).not.toHaveBeenCalled();
  });

  it("has no photo or draft stubs", () => {
    render(<RecordReceiptScreen data={data} />);
    expect(screen.queryByRole("button", { name: "Attach photo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save draft" })).not.toBeInTheDocument();
  });
});
