import { render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { MESSAGES } from "@/lib/feedback";

import {
  ConfirmDialog,
  DeactivateConfirm,
  DELETE_TEXT,
  editHref,
  SettingsDialog,
  SettingsDialogFooter,
  useSettingsDialog,
  type Deletable,
} from "./settings-dialog";

const nav = vi.hoisted(() => ({ pathname: "/settings/teams", query: "", router: { refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => nav.router,
  useSearchParams: () => new URLSearchParams(nav.query),
}));
const replaceState = vi.spyOn(window.history, "replaceState");
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { delete: vi.fn(), patch: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  nav.pathname = "/settings/teams";
});

describe("useSettingsDialog", () => {
  const state = (query: string) => {
    nav.query = query;
    const { open, id } = renderHook(() => useSettingsDialog("/settings/teams")).result.current;
    return { open, id };
  };

  it("reads ?dialog=add and ?dialog=edit&id= on the tab's own path", () => {
    expect(state("")).toEqual({ open: null, id: null });
    expect(state("dialog=add")).toEqual({ open: "add", id: null });
    expect(state(editHref("", "t-1").slice(1))).toEqual({ open: "edit", id: "t-1" });
    expect(state("dialog=edit")).toEqual({ open: null, id: null });
  });

  it("stays closed on another tab's path (a hidden, still-mounted tab)", () => {
    nav.pathname = "/settings/items";
    expect(state("dialog=add")).toEqual({ open: null, id: null });
  });

  it("closes by replacing the URL with the tab's path, then reloads after a save", () => {
    nav.query = "dialog=add";
    const { result } = renderHook(() => useSettingsDialog("/settings/teams"));
    result.current.saved("Team added");
    expect(replaceState).toHaveBeenCalledWith(null, "", "/settings/teams");
    expect(nav.router.refresh).toHaveBeenCalledOnce();
  });
});

describe("SettingsDialog", () => {
  // jsdom has no exit animation, so only the open side of "keeps what was open while it fades out" is testable.
  it("shows the latest title and form while open", () => {
    const dialog = (title: string, field: string) => (
      <SettingsDialog open onClose={() => {}} title={title} description="Details">
        <input aria-label={field} />
      </SettingsDialog>
    );
    const { rerender } = render(dialog("Add team", "Name"));
    rerender(dialog("Edit team", "Team name"));
    expect(screen.getByRole("dialog", { name: "Edit team" })).toBeVisible();
    expect(screen.getByLabelText("Team name")).toBeVisible();
  });
});

describe("ConfirmDialog", () => {
  function pending() {
    let finish: () => void = () => {};
    const onConfirm = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    return { onConfirm, finish: () => finish() };
  }

  it("is an alertdialog that starts on Cancel, so Enter cancels; Escape cancels too", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="Deactivate team?" description="It drops out of every list." confirmLabel="Deactivate team" onConfirm={onConfirm} onCancel={onCancel} />);
    const dialog = screen.getByRole("alertdialog", { name: "Deactivate team?" });
    expect(dialog).toHaveAccessibleDescription("It drops out of every list.");
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onCancel).toHaveBeenCalledOnce();
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(2);
    await user.tab();
    expect(within(dialog).getByRole("button", { name: "Deactivate team" })).toHaveFocus();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("while confirming: one request however often it's clicked, a busy label, and no way to close", async () => {
    const user = userEvent.setup();
    const { onConfirm, finish } = pending();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        tone="danger"
        title="Delete team?"
        description="Gone for good."
        confirmLabel="Delete team"
        pendingLabel="Deleting…"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    await user.dblClick(screen.getByRole("button", { name: "Delete team" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    const busy = screen.getByRole("button", { name: "Deleting…" });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(onCancel).not.toHaveBeenCalled();

    finish();
    await waitFor(() => expect(screen.getByRole("button", { name: "Delete team" })).toBeEnabled());
  });

  it("without a confirm label it only informs: its one button is Close", async () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="Can't delete team" description="It's in use." onCancel={onCancel} />);
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual(["Close"]);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe("Delete (the edit dialogs' footer)", () => {
  const NOTE = "It won't appear when a new order is created. Orders that already use it keep it.";
  const ABC: Deletable = { path: "/suppliers/s-1", name: "ABC Supplier", noun: "supplier", active: true, deactivateNote: NOTE };
  const IN_USE = new ApiError(409, "in_use", "This supplier is used by 3 orders, so it can't be deleted. Deactivate it instead.");

  function footer(record = ABC) {
    const user = userEvent.setup();
    render(<SettingsDialogFooter onCancel={() => {}} submitLabel="Save supplier" submitting={false} remove={record} />);
    return { user, trigger: screen.getByRole("button", { name: "Delete" }) };
  }
  const confirmButton = (name: string) => within(screen.getByRole("alertdialog")).getByRole("button", { name });

  it("asks first, naming the supplier; Cancel and Escape close it with no request and focus back on Delete", async () => {
    const { user, trigger } = footer();
    await user.click(trigger);
    const confirm = screen.getByRole("alertdialog", { name: "Delete supplier?" });
    expect(confirm).toHaveTextContent("Are you sure you want to delete ABC Supplier? This can't be undone.");
    expect(confirmButton("Delete supplier")).toBeEnabled();

    await user.click(confirmButton("Cancel"));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(trigger).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("alertdialog", { name: "Delete supplier?" })).toBeVisible();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(trigger).toHaveFocus();
    expect(apiClient.delete).not.toHaveBeenCalled();
  });

  it("deletes once, shows Deleting… meanwhile, then toasts, closes and reloads", async () => {
    let finish: () => void = () => {};
    vi.mocked(apiClient.delete).mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    const { user, trigger } = footer();
    await user.click(trigger);
    await user.dblClick(confirmButton("Delete supplier"));
    expect(apiClient.delete).toHaveBeenCalledOnce();
    expect(apiClient.delete).toHaveBeenCalledWith("/suppliers/s-1");
    expect(confirmButton("Deleting…")).toBeDisabled();

    finish();
    await waitFor(() => expect(nav.router.refresh).toHaveBeenCalledOnce());
    expect(toast.success).toHaveBeenCalledWith("Supplier deleted");
    expect(replaceState).toHaveBeenCalledWith(null, "", "/settings/teams");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("in use and active: gives the API's reason, moves focus to Cancel, and deactivates instead with status only", async () => {
    vi.mocked(apiClient.delete).mockRejectedValue(IN_USE);
    vi.mocked(apiClient.patch).mockResolvedValue({});
    const { user, trigger } = footer();
    await user.click(trigger);
    await user.click(confirmButton("Delete supplier"));

    const instead = await screen.findByRole("alertdialog", { name: "Deactivate supplier instead?" });
    expect(instead).toHaveTextContent("This supplier is used by 3 orders, so it can't be deleted.");
    expect(instead).toHaveTextContent(NOTE);
    expect(instead).not.toHaveTextContent("Deactivate it instead.");
    await waitFor(() => expect(confirmButton("Cancel")).toHaveFocus());
    expect(toast.error).not.toHaveBeenCalled();

    await user.click(confirmButton("Deactivate supplier"));
    await waitFor(() => expect(nav.router.refresh).toHaveBeenCalledOnce());
    expect(apiClient.patch).toHaveBeenCalledWith("/suppliers/s-1", { status: "Inactive" });
    expect(toast.success).toHaveBeenCalledWith("Supplier deactivated");
  });

  it("in use and already inactive: explains and only closes", async () => {
    vi.mocked(apiClient.delete).mockRejectedValue(IN_USE);
    const { user, trigger } = footer({ ...ABC, active: false });
    await user.click(trigger);
    await user.click(confirmButton("Delete supplier"));

    const cant = await screen.findByRole("alertdialog", { name: "Can't delete supplier" });
    expect(cant).toHaveTextContent(DELETE_TEXT.alreadyInactive);
    expect(within(cant).getAllByRole("button").map((button) => button.textContent)).toEqual(["Close"]);
    await user.click(confirmButton("Close"));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(apiClient.patch).not.toHaveBeenCalled();
    expect(nav.router.refresh).not.toHaveBeenCalled();
  });

  it("any other failure toasts and stays open, so confirming again retries", async () => {
    vi.mocked(apiClient.delete).mockRejectedValueOnce(new ApiError(0, "network_error", "Something went wrong.")).mockResolvedValueOnce(undefined);
    const { user, trigger } = footer();
    await user.click(trigger);
    await user.click(confirmButton("Delete supplier"));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(MESSAGES.somethingWrong, { description: MESSAGES.tryAgain }));
    expect(screen.getByRole("alertdialog", { name: "Delete supplier?" })).toBeVisible();
    expect(nav.router.refresh).not.toHaveBeenCalled();

    await user.click(confirmButton("Delete supplier"));
    await waitFor(() => expect(nav.router.refresh).toHaveBeenCalledOnce());
    expect(apiClient.delete).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledWith("Supplier deleted");
  });

  it("a failed deactivation stays open too, to try again", async () => {
    vi.mocked(apiClient.delete).mockRejectedValue(IN_USE);
    vi.mocked(apiClient.patch).mockRejectedValueOnce(new ApiError(403, "forbidden", "You don't have access to do that."));
    const { user, trigger } = footer();
    await user.click(trigger);
    await user.click(confirmButton("Delete supplier"));
    await user.click(await screen.findByRole("button", { name: "Deactivate supplier" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(MESSAGES.noAccess));
    expect(screen.getByRole("alertdialog", { name: "Deactivate supplier instead?" })).toBeVisible();
    expect(confirmButton("Deactivate supplier")).toBeEnabled();
    expect(nav.router.refresh).not.toHaveBeenCalled();
  });
});

describe("DeactivateConfirm", () => {
  it("names the record and says what deactivating changes", async () => {
    const onConfirm = vi.fn();
    render(<DeactivateConfirm open name="Retail team" noun="team" note="It drops out of new splits." onConfirm={onConfirm} onCancel={() => {}} />);
    expect(screen.getByRole("alertdialog", { name: "Deactivate team?" })).toHaveTextContent(
      "Are you sure you want to deactivate Retail team? It drops out of new splits.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Deactivate team" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
