import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { OrderOptions } from "@/lib/api/types";

import { NewOrderScreen } from "./new-order-screen";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { post: vi.fn() } }));
const post = vi.mocked(apiClient.post);

const TODAY = "2026-10-27";
const options: OrderOptions = {
  nextPo: "PO-2050",
  suppliers: [
    { id: "s-foshan", name: "Foshan Fabrics", contactPerson: "Mr. Li Wei", phone: "+86 757 8812 0345", city: "Foshan, China" },
    { id: "s-yiwu", name: "Yiwu Trims Ltd.", contactPerson: "Ms. Zhao", phone: "+86 579 0000", city: "Yiwu" },
  ],
  items: [
    { id: "i-denim", name: "Cotton denim fabric", unit: "m" },
    { id: "i-buttons", name: "Metal buttons", unit: "pcs" },
  ],
  agents: [{ id: "a-sino", name: "Sino Freight" }],
};

function open() {
  const user = userEvent.setup({ delay: null });
  render(<NewOrderScreen data={{ options, today: TODAY }} />);
  // Prefix match: required labels are followed by the required mark.
  const field = (label: string) => screen.getByLabelText(new RegExp(`^${label.replace(/[()]/g, "\\$&")}`));
  const place = screen.getByRole("button", { name: "Place order" });
  return { user, field, place };
}

async function fillOrder({ user, field }: ReturnType<typeof open>) {
  await user.selectOptions(field("Supplier"), "s-foshan");
  await user.type(field("Delivery date"), "2026-11-25");
  await user.selectOptions(field("Item, line 1"), "i-denim");
  await user.type(field("Rate (¥), line 1"), "18.50");
  await user.type(field("Quantity, line 1"), "2,400");
}

beforeEach(() => vi.clearAllMocks());

describe("NewOrderScreen", () => {
  it("shows the next PO read-only, today as the order date, and fills the supplier's contact on selection", async () => {
    const ui = open();
    expect(ui.field("Purchase order no.")).toHaveValue("PO-2050");
    expect(ui.field("Purchase order no.")).toHaveAttribute("readonly");
    expect(ui.field("Order date")).toHaveValue(TODAY);
    expect(ui.field("Contact person")).toHaveValue("");

    await ui.user.selectOptions(ui.field("Supplier"), "s-foshan");
    expect(ui.field("Contact person")).toHaveValue("Mr. Li Wei");
    expect(ui.field("Phone")).toHaveValue("+86 757 8812 0345");
    expect(ui.field("City")).toHaveValue("Foshan, China");
    expect(ui.field("City")).toHaveAttribute("readonly");
  });

  it("posts ORD-3 with lines and deposits, then toasts and returns to the orders list", async () => {
    post.mockResolvedValue({ order: { id: "o-1", po: "PO-2050" } });
    const ui = open();
    await fillOrder(ui);
    expect(screen.getByText("m")).toBeVisible();
    expect(ui.field("Amount (¥), line 1")).toHaveValue("44,400.00");

    // A second line, and an empty third one that is ignored (the reference has no remove control).
    await ui.user.click(screen.getByRole("button", { name: "+ Add item" }));
    await ui.user.click(screen.getByRole("button", { name: "+ Add item" }));
    await ui.user.selectOptions(ui.field("Item, line 2"), "i-buttons");
    await ui.user.type(ui.field("Rate (¥), line 2"), "0.35");
    await ui.user.type(ui.field("Quantity, line 2"), "10000");

    await ui.user.click(screen.getByRole("button", { name: "+ Add deposit" }));
    await ui.user.type(ui.field("Amount (¥), deposit 1"), "20000");
    await ui.user.type(screen.getAllByLabelText("Rate to INR")[0]!, "11.6");
    await ui.user.type(screen.getAllByLabelText("Mode")[0]!, "Bank transfer");
    await ui.user.click(screen.getByRole("button", { name: "+ Add deposit" }));
    await ui.user.selectOptions(ui.field("Paid to, deposit 2"), "a-sino");
    await ui.user.type(ui.field("Amount (¥), deposit 2"), "1500");
    await ui.user.type(screen.getAllByLabelText("Rate to INR")[1]!, "11.6");
    await ui.user.type(screen.getAllByLabelText("Mode")[1]!, "Bank transfer");
    expect(screen.getByRole("status", { name: "Order total" })).toHaveTextContent("¥ 47,900.00");

    await ui.user.click(ui.place);

    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(post).toHaveBeenCalledWith("/orders", {
      supplierId: "s-foshan",
      orderDate: TODAY,
      deliveryDate: "2026-11-25",
      lines: [
        { itemId: "i-denim", quantity: 2400, rateCny: 18.5 },
        { itemId: "i-buttons", quantity: 10000, rateCny: 0.35 },
      ],
      deposits: [
        { payee: "Foshan Fabrics", payeeRole: "supplier", amountCny: 20000, paidOn: TODAY, rateInr: 11.6, mode: "Bank transfer" },
        { payee: "Sino Freight", payeeRole: "agent", amountCny: 1500, paidOn: TODAY, rateInr: 11.6, mode: "Bank transfer" },
      ],
    });
    expect(toast.success).toHaveBeenCalledWith("Order PO-2050 placed");
    expect(router.push).toHaveBeenCalledWith("/orders");
    expect(router.push.mock.invocationCallOrder[0]).toBeLessThan(router.refresh.mock.invocationCallOrder[0]!);
  }, 30_000);

  it("shows a 422 field error under its field and keeps the values", async () => {
    const message = "The delivery date can't be before the order date.";
    post.mockRejectedValue(new ApiError(422, "validation_failed", "Check the highlighted fields.", { deliveryDate: message }));
    const ui = open();
    await fillOrder(ui);
    await ui.user.click(ui.place);

    expect(await screen.findByText(message)).toBeVisible();
    expect(ui.field("Delivery date")).toHaveAttribute("aria-invalid", "true");
    expect(ui.field("Delivery date")).toHaveValue("2026-11-25");
    expect(toast.success).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("checks the form before calling the API", async () => {
    const ui = open();
    await ui.user.click(ui.place);

    expect(await screen.findByText("Choose a supplier.")).toBeVisible();
    expect(screen.getByText("Choose the delivery date.")).toBeVisible();
    expect(screen.getByText("Add at least one item.")).toBeVisible();

    await ui.user.selectOptions(ui.field("Item, line 1"), "i-denim");
    await ui.user.click(ui.place);
    expect(await screen.findByText("Line 1: Enter the rate.")).toBeVisible();
    expect(post).not.toHaveBeenCalled();
  });

  it("keeps Save draft out of the prototype", async () => {
    const ui = open();
    await ui.user.click(screen.getByRole("button", { name: "Save draft" }));
    expect(toast.info).toHaveBeenCalledWith("Save draft is not included in the current prototype.", { id: "not-in-prototype" });
  });
});
