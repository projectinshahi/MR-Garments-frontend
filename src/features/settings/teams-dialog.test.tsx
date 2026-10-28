import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { TeamRow } from "@/lib/api/types";

import { TeamDialog } from "./teams-dialog";

const nav = vi.hoisted(() => ({ query: "dialog=add", router: { refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/teams",
  useRouter: () => nav.router,
  useSearchParams: () => new URLSearchParams(nav.query),
}));
const replaceState = vi.spyOn(window.history, "replaceState");
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { post: vi.fn(), patch: vi.fn() } }));

const post = vi.mocked(apiClient.post);
const patch = vi.mocked(apiClient.patch);
const TAKEN = "A team with this name already exists.";
const RETAIL: TeamRow = { id: "t-1", name: "Retail team", piecesInStock: 110, landedCostOfStockInr: 35700, averagePerPieceInr: 324.55, status: "Active" };

function open(query: string) {
  nav.query = query;
  const user = userEvent.setup();
  render(<TeamDialog rows={[RETAIL]} />);
  // Prefix match: "Team name" is followed by the required mark.
  const field = (label: string) => screen.getByLabelText(new RegExp(`^${label}`));
  const save = screen.getByRole("button", { name: "Save team" });
  return { user, field, save };
}

beforeEach(() => vi.clearAllMocks());

describe("Add team", () => {
  it("opens empty, posts the trimmed name, then toasts, closes and reloads", async () => {
    post.mockResolvedValue({ team: { ...RETAIL, id: "t-4", name: "Export team" } });
    const { user, field, save } = open("dialog=add");
    expect(screen.getByRole("dialog", { name: "Add team" })).toBeVisible();
    expect(field("Team name")).toHaveValue("");
    expect(screen.queryByLabelText("Status")).toBeNull();

    await user.type(field("Team name"), " Export team ");
    await user.click(save);

    await waitFor(() => expect(nav.router.refresh).toHaveBeenCalledOnce());
    expect(post).toHaveBeenCalledWith("/teams", { name: "Export team" });
    expect(toast.success).toHaveBeenCalledWith("Team added");
    expect(replaceState).toHaveBeenCalledWith(null, "", "/settings/teams");
  });

  it("asks for the name without calling the API", async () => {
    const { user, field, save } = open("dialog=add");
    await user.click(save);
    expect(await screen.findByText("Enter the team name.")).toBeVisible();
    expect(field("Team name")).toHaveFocus();
    expect(post).not.toHaveBeenCalled();
  });

  it("shows a duplicate name under Team name and disables Save only while saving", async () => {
    let fail: (error: unknown) => void = () => {};
    post.mockReturnValue(new Promise((_, reject) => (fail = reject)));
    const { user, field, save } = open("dialog=add");
    await user.type(field("Team name"), "RETAIL TEAM");
    await user.click(save);
    await waitFor(() => expect(save).toBeDisabled());
    fail(new ApiError(409, "name_exists", TAKEN, { name: TAKEN }));

    expect(await screen.findByText(TAKEN)).toBeVisible();
    expect(field("Team name")).toHaveValue("RETAIL TEAM");
    expect(field("Team name")).toHaveFocus();
    expect(save).toBeEnabled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("Edit team", () => {
  it("renames without asking", async () => {
    patch.mockResolvedValue({ team: { ...RETAIL, name: "Retail shops team" } });
    const { user, field, save } = open("dialog=edit&id=t-1");
    expect(screen.getByRole("dialog", { name: "Edit team" })).toBeVisible();
    expect(field("Status")).toHaveValue("Active");
    await user.clear(field("Team name"));
    await user.type(field("Team name"), "Retail shops team");
    await user.click(save);

    await waitFor(() => expect(nav.router.refresh).toHaveBeenCalledOnce());
    expect(patch).toHaveBeenCalledWith("/teams/t-1", { name: "Retail shops team", status: "Active" });
    expect(toast.success).toHaveBeenCalledWith("Team saved");
  });

  it("asks before deactivating: Cancel saves nothing, Deactivate patches the status", async () => {
    patch.mockResolvedValue({ team: { ...RETAIL, status: "Inactive" } });
    const { user, field, save } = open("dialog=edit&id=t-1");
    await user.selectOptions(field("Status"), "Inactive");
    await user.click(save);

    const confirm = await screen.findByRole("dialog", { name: "Deactivate Retail team?" });
    expect(confirm).toHaveTextContent("no longer appears when goods are split in the warehouse");
    await user.click(within(confirm).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Deactivate Retail team?" })).toBeNull());
    expect(patch).not.toHaveBeenCalled();

    await user.click(save);
    await user.click(within(await screen.findByRole("dialog", { name: "Deactivate Retail team?" })).getByRole("button", { name: "Deactivate" }));
    await waitFor(() => expect(nav.router.refresh).toHaveBeenCalledOnce());
    expect(patch).toHaveBeenCalledWith("/teams/t-1", { name: "Retail team", status: "Inactive" });
    expect(toast.success).toHaveBeenCalledWith("Team saved");
  });
});
