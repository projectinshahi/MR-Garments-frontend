import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { ClearingAgentRow } from "@/lib/api/types";

import { ClearingAgentDialogs } from "./clearing-agents-dialog";

const nav = vi.hoisted(() => ({ query: "", router: { refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/clearing-agents",
  useRouter: () => nav.router,
  useSearchParams: () => new URLSearchParams(nav.query),
}));
const replaceState = vi.spyOn(window.history, "replaceState");
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { post: vi.fn(), patch: vi.fn() } }));

const post = vi.mocked(apiClient.post);
const patch = vi.mocked(apiClient.patch);
const TAKEN = "A clearing agent with this name already exists.";
const KOCHI: ClearingAgentRow = {
  id: "ca-1",
  name: "Kochi Clearing Services",
  contactPerson: "Mr. Anil Kumar",
  phone: "+91 98470 12345",
  port: "Kochi",
  containersCleared: 2,
  status: "Active",
};
const SOUTHERN: ClearingAgentRow = { ...KOCHI, id: "ca-2", name: "Southern Port Agents", status: "Inactive" };
const COCHIN = { name: "Cochin Customs House Agents", contactPerson: "Mr. Thomas Varghese", phone: "+91 98470 55501", port: "Kochi" };

function open(query: string) {
  nav.query = query;
  const user = userEvent.setup();
  render(<ClearingAgentDialogs rows={[KOCHI, SOUTHERN]} />);
  // Prefix match: "Clearing agent name" is followed by the required mark.
  const field = (label: string) => screen.getByLabelText(new RegExp(`^${label}`));
  const save = () => screen.getByRole("button", { name: "Save clearing agent" });
  return { user, field, save };
}

beforeEach(() => vi.clearAllMocks());

describe("Add clearing agent", () => {
  it("opens empty, without a Status field", () => {
    const { field } = open("dialog=add");
    expect(screen.getByRole("dialog", { name: "Add clearing agent" })).toBeVisible();
    for (const label of ["Clearing agent name", "Contact person", "Phone", "Port"]) expect(field(label)).toHaveValue("");
    expect(screen.queryByLabelText("Status")).not.toBeInTheDocument();
  });

  it("posts the fields, then toasts, closes and reloads the list", async () => {
    post.mockResolvedValue({ clearingAgent: { ...COCHIN, id: "ca-3", containersCleared: 0, status: "Active" } });
    const { user, field, save } = open("dialog=add");
    await user.type(field("Clearing agent name"), COCHIN.name);
    await user.type(field("Contact person"), COCHIN.contactPerson);
    await user.type(field("Phone"), COCHIN.phone);
    await user.type(field("Port"), COCHIN.port);
    await user.click(save());

    await waitFor(() => expect(nav.router.refresh).toHaveBeenCalledOnce());
    expect(post).toHaveBeenCalledWith("/clearing-agents", COCHIN);
    expect(toast.success).toHaveBeenCalledWith("Clearing agent added");
    expect(replaceState).toHaveBeenCalledWith(null, "", "/settings/clearing-agents");
  });

  it("shows the name message without calling the API when the name is empty", async () => {
    const { user, field, save } = open("dialog=add");
    await user.type(field("Clearing agent name"), "   ");
    await user.click(save());
    expect(await screen.findByText("Enter the clearing agent name.")).toBeVisible();
    expect(field("Clearing agent name")).toHaveFocus();
    expect(post).not.toHaveBeenCalled();
  });

  it("shows a duplicate name under the field, keeping the values", async () => {
    post.mockRejectedValue(new ApiError(409, "name_exists", TAKEN, { name: TAKEN }));
    const { user, field, save } = open("dialog=add");
    await user.type(field("Clearing agent name"), "kochi clearing services");
    await user.type(field("Port"), "Kochi");
    await user.click(save());

    expect(await screen.findByText(TAKEN)).toBeVisible();
    expect(field("Clearing agent name")).toHaveFocus();
    expect(field("Clearing agent name")).toHaveAttribute("aria-invalid", "true");
    expect(field("Port")).toHaveValue("Kochi");
    expect(save()).toBeEnabled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("disables Save while the request runs", async () => {
    let finish: () => void = () => {};
    post.mockReturnValue(new Promise((resolve) => (finish = () => resolve({}))));
    const { user, field, save } = open("dialog=add");
    await user.type(field("Clearing agent name"), COCHIN.name);
    await user.click(save());
    await waitFor(() => expect(save()).toBeDisabled());
    finish();
    await waitFor(() => expect(nav.router.refresh).toHaveBeenCalledOnce());
  });
});

describe("Edit clearing agent", () => {
  it("opens with the row's values and Status, and patches every field", async () => {
    patch.mockResolvedValue({ clearingAgent: { ...KOCHI, port: "Vizhinjam" } });
    const { user, field, save } = open("dialog=edit&id=ca-1");
    expect(screen.getByRole("dialog", { name: "Edit clearing agent" })).toBeVisible();
    expect(field("Clearing agent name")).toHaveValue(KOCHI.name);
    expect(field("Contact person")).toHaveValue(KOCHI.contactPerson);
    expect(field("Phone")).toHaveValue(KOCHI.phone);
    expect(field("Status")).toHaveValue("Active");
    await user.clear(field("Port"));
    await user.type(field("Port"), "Vizhinjam");
    await user.click(save());

    await waitFor(() => expect(nav.router.refresh).toHaveBeenCalledOnce());
    expect(patch).toHaveBeenCalledWith("/clearing-agents/ca-1", {
      name: KOCHI.name,
      contactPerson: KOCHI.contactPerson,
      phone: KOCHI.phone,
      port: "Vizhinjam",
      status: "Active",
    });
    expect(toast.success).toHaveBeenCalledWith("Clearing agent saved");
  });

  it("asks before deactivating: Cancel keeps the dialog, Deactivate saves", async () => {
    patch.mockResolvedValue({ clearingAgent: { ...KOCHI, status: "Inactive" } });
    const { user, field, save } = open("dialog=edit&id=ca-1");
    await user.selectOptions(field("Status"), "Inactive");
    await user.click(save());

    const confirm = screen.getByRole("alertdialog", { name: "Deactivate clearing agent?" });
    expect(confirm).toHaveTextContent("Are you sure you want to deactivate Kochi Clearing Services?");
    await user.click(within(confirm).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(confirm).not.toBeInTheDocument());
    expect(patch).not.toHaveBeenCalled();
    expect(field("Status")).toHaveValue("Inactive");

    await user.click(save());
    await user.click(within(screen.getByRole("alertdialog", { name: "Deactivate clearing agent?" })).getByRole("button", { name: "Deactivate clearing agent" }));
    await waitFor(() => expect(nav.router.refresh).toHaveBeenCalledOnce());
    expect(patch).toHaveBeenCalledWith("/clearing-agents/ca-1", expect.objectContaining({ status: "Inactive" }));
    expect(toast.success).toHaveBeenCalledWith("Clearing agent saved");
  });

  it("shows a duplicate rename under the name after confirming", async () => {
    patch.mockRejectedValue(new ApiError(409, "name_exists", TAKEN, { name: TAKEN }));
    const { user, field, save } = open("dialog=edit&id=ca-1");
    await user.clear(field("Clearing agent name"));
    await user.type(field("Clearing agent name"), "Southern Port Agents");
    await user.selectOptions(field("Status"), "Inactive");
    await user.click(save());
    await user.click(within(screen.getByRole("alertdialog", { name: /^Deactivate/ })).getByRole("button", { name: "Deactivate clearing agent" }));

    expect(await screen.findByText(TAKEN)).toBeVisible();
    await waitFor(() => expect(screen.queryByRole("alertdialog", { name: /^Deactivate/ })).not.toBeInTheDocument());
    expect(screen.getByRole("dialog", { name: "Edit clearing agent" })).toBeVisible();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("reactivates an inactive agent without asking", async () => {
    patch.mockResolvedValue({ clearingAgent: { ...SOUTHERN, status: "Active" } });
    const { user, field, save } = open("dialog=edit&id=ca-2");
    expect(field("Status")).toHaveValue("Inactive");
    await user.selectOptions(field("Status"), "Active");
    await user.click(save());
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/clearing-agents/ca-2", expect.objectContaining({ status: "Active" })));
    expect(screen.queryByRole("alertdialog", { name: /^Deactivate/ })).not.toBeInTheDocument();
  });

  it("stays closed for an id that isn't in the list", () => {
    open("dialog=edit&id=ca-9");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
