import { render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConfirmDialog, editHref, SettingsDialog, useSettingsDialog } from "./settings-dialog";

const nav = vi.hoisted(() => ({ pathname: "/settings/teams", query: "", router: { replace: vi.fn(), refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => nav.router,
  useSearchParams: () => new URLSearchParams(nav.query),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

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
    expect(nav.router.replace).toHaveBeenCalledWith("/settings/teams", { scroll: false });
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
  it("disables Confirm while onConfirm runs", async () => {
    let finish: () => void = () => {};
    const onConfirm = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Deactivate Retail team?"
        description="It drops out of every list."
        confirmLabel="Deactivate"
        destructive
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    const confirm = screen.getByRole("button", { name: "Deactivate" });
    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(confirm).toBeDisabled();
    finish();
    await waitFor(() => expect(confirm).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
