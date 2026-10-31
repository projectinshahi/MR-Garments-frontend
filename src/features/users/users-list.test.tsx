import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { MESSAGES } from "@/lib/feedback";
import type { User } from "@/types/domain";

import { DEACTIVATE_NOTE } from "./user-form";
import { REMOVE_TEXT, UsersList } from "./users-list";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/users" }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { delete: vi.fn(), patch: vi.fn() } }));
const remove = vi.mocked(apiClient.delete);
const patch = vi.mocked(apiClient.patch);

const user = (id: string, name: string, email: string, status: User["status"] = "Active"): User => ({
  id,
  name,
  email,
  role: "China staff",
  office: "",
  lastSignIn: "–",
  status,
});
const SURESH = user("u-suresh", "Suresh Menon", "suresh@mrgarments.com");
const TEST = user("u-test", "Test User", "test@mrgarments.com");
const OLD = user("u-old", "Old Hand", "old@mrgarments.com", "Inactive");
const IN_USE = new ApiError(409, "in_use", "Test User has signed in and recorded 3 receipts, so they can't be removed. Deactivate them instead.");

function list({ canManage = true, meId = "u-suresh" }: { canManage?: boolean; meId?: string | null } = {}) {
  const events = userEvent.setup();
  render(<UsersList users={[SURESH, TEST, OLD]} counts={{ active: 2, inactive: 1 }} roles={["Management", "China staff"]} canManage={canManage} meId={meId} />);
  return events;
}
const confirmButton = (name: string) => within(screen.getByRole("alertdialog")).getByRole("button", { name });
/** Opens Remove on a row and confirms the first step. */
async function removeAndConfirm(events: ReturnType<typeof userEvent.setup>, name: string) {
  await events.click(screen.getByRole("button", { name: `Remove ${name}` }));
  await events.click(confirmButton("Remove user"));
}

beforeEach(() => vi.clearAllMocks());

describe("Remove user (USR-5)", () => {
  it("shows Remove next to Edit with admin Full, but not on your own row", () => {
    list();
    expect(screen.getByRole("link", { name: "Edit Test User" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Remove Test User" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Edit Suresh Menon" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Remove Suresh Menon" })).toBeNull();
  });

  it("hides Remove without admin Full", () => {
    list({ canManage: false });
    expect(screen.getByRole("link", { name: "Edit Test User" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Remove / })).toBeNull();
  });

  it("asks first naming the user and email; Cancel sends nothing; a double-click removes once, then toasts and reloads", async () => {
    let finish: () => void = () => {};
    remove.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    const events = list();
    const trigger = screen.getByRole("button", { name: "Remove Test User" });
    await events.click(trigger);
    const ask = screen.getByRole("alertdialog", { name: "Remove user?" });
    expect(ask).toHaveTextContent(
      "Are you sure you want to remove Test User (test@mrgarments.com)? This can't be undone. A user who has signed in or recorded anything can't be removed, but you can deactivate them.",
    );
    await events.click(confirmButton("Cancel"));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(trigger).toHaveFocus();
    expect(remove).not.toHaveBeenCalled();

    await events.click(trigger);
    await events.dblClick(confirmButton("Remove user"));
    expect(remove).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith("/users/u-test");
    expect(confirmButton("Removing…")).toBeDisabled();

    finish();
    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(toast.success).toHaveBeenCalledWith(REMOVE_TEXT.removed);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("in use and active: gives the API's reason and deactivates instead with status only", async () => {
    remove.mockRejectedValue(IN_USE);
    patch.mockResolvedValue({});
    const events = list();
    await removeAndConfirm(events, "Test User");

    const instead = await screen.findByRole("alertdialog", { name: "Deactivate user instead?" });
    expect(instead).toHaveTextContent("Test User has signed in and recorded 3 receipts, so they can't be removed.");
    expect(instead).not.toHaveTextContent("Deactivate them instead.");
    expect(instead).toHaveTextContent(DEACTIVATE_NOTE);
    expect(toast.error).not.toHaveBeenCalled();

    await events.click(confirmButton("Deactivate user"));
    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(patch).toHaveBeenCalledWith("/users/u-test", { status: "Inactive" });
    expect(toast.success).toHaveBeenCalledWith(REMOVE_TEXT.deactivated);
  });

  it("in use and already inactive: explains and only closes", async () => {
    remove.mockRejectedValue(new ApiError(409, "in_use", "Old Hand has signed in, so they can't be removed. Deactivate them instead."));
    const events = list();
    await events.click(within(screen.getByRole("group", { name: "User status" })).getByRole("button", { name: "All" }));
    await removeAndConfirm(events, "Old Hand");

    const cant = await screen.findByRole("alertdialog", { name: "Can't remove user" });
    expect(cant).toHaveTextContent("Old Hand has signed in, so they can't be removed.");
    expect(cant).toHaveTextContent(REMOVE_TEXT.alreadyInactive);
    expect(within(cant).getAllByRole("button").map((button) => button.textContent)).toEqual(["Close"]);
    await events.click(confirmButton("Close"));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(patch).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("your own account or the last Management user: toasts the API's message and closes", async () => {
    const m20 = MESSAGES.lastManagement;
    remove.mockRejectedValueOnce(new ApiError(409, "own_account", "You can't remove your own account."));
    remove.mockRejectedValueOnce(new ApiError(409, "last_management", m20));
    const events = list({ meId: null });

    await removeAndConfirm(events, "Suresh Menon");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("You can't remove your own account."));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());

    await removeAndConfirm(events, "Suresh Menon");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(m20));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("a deactivation refused with a field error (PATCH own_account) still says why", async () => {
    const own = "You can't deactivate your own account.";
    remove.mockRejectedValue(IN_USE);
    patch.mockRejectedValue(new ApiError(409, "own_account", own, { status: own }));
    const events = list();
    await removeAndConfirm(events, "Test User");
    await events.click(await screen.findByRole("button", { name: "Deactivate user" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(own));
    expect(toast.error).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("already removed (404): says so and reloads", async () => {
    remove.mockRejectedValue(new ApiError(404, "not_found", "User not found."));
    const events = list();
    await removeAndConfirm(events, "Test User");
    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(toast.success).toHaveBeenCalledWith(REMOVE_TEXT.alreadyRemoved);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("a network failure toasts and stays open, so confirming again retries", async () => {
    remove.mockRejectedValueOnce(new ApiError(0, "network_error", "Something went wrong.")).mockResolvedValueOnce(undefined);
    const events = list();
    await removeAndConfirm(events, "Test User");

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(MESSAGES.somethingWrong, { description: MESSAGES.tryAgain }));
    expect(screen.getByRole("alertdialog", { name: "Remove user?" })).toBeVisible();
    expect(router.refresh).not.toHaveBeenCalled();

    await events.click(confirmButton("Remove user"));
    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(remove).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledWith(REMOVE_TEXT.removed);
  });
});
