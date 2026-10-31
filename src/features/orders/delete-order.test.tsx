import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

import { DeleteOrderButton } from "./delete-order";

const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { delete: vi.fn() } }));
const remove = vi.mocked(apiClient.delete);

async function ask(inList = false) {
  const user = userEvent.setup();
  render(<DeleteOrderButton po="PO-2051" supplier="Foshan Fabrics" inList={inList} />);
  await user.click(screen.getByRole("button", { name: inList ? "Delete PO-2051" : "Delete order" }));
  const dialog = await screen.findByRole("alertdialog", { name: "Delete order?" });
  return { user, dialog, confirm: within(dialog).getByRole("button", { name: "Delete order" }) };
}

beforeEach(() => vi.clearAllMocks());

describe("Delete order", () => {
  it("names the PO and supplier, and Cancel sends nothing", async () => {
    const { user, dialog } = await ask();
    expect(dialog).toHaveTextContent(
      "Are you sure you want to delete PO-2051 (Foshan Fabrics)? This can't be undone. An order with payments, receipts or container loads can't be deleted.",
    );
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(remove).not.toHaveBeenCalled();
  });

  it("a double-click sends one DELETE; 204 toasts, leaves for the list and refreshes", async () => {
    let finish: () => void = () => {};
    remove.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    const { user, confirm } = await ask();
    await user.dblClick(confirm);
    expect(remove).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith("/orders/PO-2051");
    expect(confirm).toHaveTextContent("Deleting…");
    finish();
    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(toast.success).toHaveBeenCalledWith("Order deleted");
    expect(router.replace).toHaveBeenCalledWith("/orders");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("in use: the same dialog gives the API's reason with Close only", async () => {
    const reason = "This order has 2 payments and 1 receipt, so it can't be deleted.";
    remove.mockRejectedValue(new ApiError(409, "in_use", reason));
    const { user, confirm } = await ask();
    await user.click(confirm);
    const refused = await screen.findByRole("alertdialog", { name: "Can't delete order" });
    expect(refused).toHaveTextContent(reason);
    expect(within(refused).getAllByRole("button").map((button) => button.textContent)).toEqual(["Close"]);
    expect(toast.error).not.toHaveBeenCalled();
    await user.click(within(refused).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("a failure toasts and stays open, so confirming again retries", async () => {
    remove.mockRejectedValueOnce(new ApiError(500, "internal", "Something went wrong.")).mockResolvedValueOnce(undefined);
    const { user, dialog, confirm } = await ask();
    await user.click(confirm);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Something went wrong.", { description: "Please try again." }));
    expect(dialog).toBeVisible();
    await user.click(confirm);
    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(remove).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledWith("Order deleted");
  });

  it("already deleted (404): says so and goes to the list", async () => {
    remove.mockRejectedValue(new ApiError(404, "not_found", "Order not found."));
    const { user, confirm } = await ask();
    await user.click(confirm);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/orders"));
    expect(toast.success).toHaveBeenCalledWith("Order was already deleted.");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("from the orders list: only refreshes the list", async () => {
    remove.mockResolvedValue(undefined);
    const { user, confirm } = await ask(true);
    await user.click(confirm);
    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(router.replace).not.toHaveBeenCalled();
  });
});
