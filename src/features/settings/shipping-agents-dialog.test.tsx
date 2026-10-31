import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { ShippingAgentRow } from "@/lib/api/types";

import { ShippingAgentDialog } from "./shipping-agents-dialog";

const nav = vi.hoisted(() => ({ query: "dialog=add", router: { refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/shipping-agents",
  useRouter: () => nav.router,
  useSearchParams: () => new URLSearchParams(nav.query),
}));
const replaceState = vi.spyOn(window.history, "replaceState");
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { post: vi.fn(), patch: vi.fn() } }));

const post = vi.mocked(apiClient.post);
const patch = vi.mocked(apiClient.patch);
const TAKEN = "A shipping agent with this name already exists.";
const OCEAN = { name: "Ocean Link Logistics", contactPerson: "Mr. Li Qiang", phone: "+86 21 6234 7788", officeCity: "Shanghai" };
const SINO: ShippingAgentRow = {
  id: "a-1",
  name: "Sino Freight",
  contactPerson: "Ms. Zhang Min",
  phone: "+86 20 8123 4567",
  officeCity: "Guangzhou",
  activeContainers: 4,
  status: "Active",
};

function open(query = "dialog=add") {
  nav.query = query;
  const user = userEvent.setup();
  render(<ShippingAgentDialog agents={[SINO]} />);
  // Prefix match: "Shipping agent name" is followed by the required mark.
  const field = (label: string) => screen.getByLabelText(new RegExp(`^${label}`));
  const save = screen.getByRole("button", { name: "Save shipping agent" });
  return { user, field, save };
}

beforeEach(() => vi.clearAllMocks());

describe("Add shipping agent", () => {
  it("opens empty, without Status", () => {
    const { field } = open();
    expect(screen.getByRole("dialog", { name: "Add shipping agent" })).toBeVisible();
    for (const label of ["Shipping agent name", "Contact person", "Phone", "Office city"]) expect(field(label)).toHaveValue("");
    expect(screen.queryByLabelText("Status")).not.toBeInTheDocument();
  });

  it("posts the trimmed fields, then toasts, closes and reloads the list", async () => {
    post.mockResolvedValue({ shippingAgent: { ...OCEAN, id: "a-3", activeContainers: 0, status: "Active" } });
    const { user, field, save } = open();
    await user.type(field("Shipping agent name"), ` ${OCEAN.name} `);
    await user.type(field("Contact person"), OCEAN.contactPerson);
    await user.type(field("Phone"), OCEAN.phone);
    await user.type(field("Office city"), OCEAN.officeCity);
    await user.click(save);

    await waitFor(() => expect(nav.router.refresh).toHaveBeenCalledOnce());
    expect(post).toHaveBeenCalledWith("/shipping-agents", OCEAN);
    expect(toast.success).toHaveBeenCalledWith("Shipping agent added");
    expect(replaceState).toHaveBeenCalledWith(null, "", "/settings/shipping-agents");
  });

  it("disables Save while the request runs", async () => {
    let finish: (value: unknown) => void = () => {};
    post.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { user, field, save } = open();
    await user.type(field("Shipping agent name"), OCEAN.name);
    await user.click(save);
    await waitFor(() => expect(save).toBeDisabled());
    finish({});
    await waitFor(() => expect(nav.router.refresh).toHaveBeenCalledOnce());
  });

  it("asks for the name without calling the API", async () => {
    const { user, field, save } = open();
    await user.click(save);
    expect(await screen.findByText("Enter the shipping agent name.")).toBeVisible();
    expect(field("Shipping agent name")).toHaveFocus();
    expect(post).not.toHaveBeenCalled();
  });

  it("shows a duplicate name under the name, keeping the values", async () => {
    post.mockRejectedValue(new ApiError(409, "name_exists", TAKEN, { name: TAKEN }));
    const { user, field, save } = open();
    await user.type(field("Shipping agent name"), "sino freight");
    await user.type(field("Office city"), "Guangzhou");
    await user.click(save);

    expect(await screen.findByText(TAKEN)).toBeVisible();
    expect(field("Shipping agent name")).toHaveFocus();
    expect(field("Office city")).toHaveValue("Guangzhou");
    expect(save).toBeEnabled();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("toasts and keeps the dialog when the request fails", async () => {
    post.mockRejectedValue(new ApiError(0, "network_error", "Something went wrong."));
    const { user, field, save } = open();
    await user.type(field("Shipping agent name"), OCEAN.name);
    await user.click(save);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Something went wrong.", { description: "Please try again." }));
    expect(screen.getByRole("dialog", { name: "Add shipping agent" })).toBeVisible();
    expect(replaceState).not.toHaveBeenCalled();
  });
});

describe("Edit shipping agent", () => {
  const EDIT = "dialog=edit&id=a-1";

  it("opens filled from the row, plus Status", () => {
    const { field } = open(EDIT);
    expect(screen.getByRole("dialog", { name: "Edit shipping agent" })).toBeVisible();
    expect(field("Shipping agent name")).toHaveValue("Sino Freight");
    expect(field("Contact person")).toHaveValue("Ms. Zhang Min");
    expect(field("Phone")).toHaveValue("+86 20 8123 4567");
    expect(field("Office city")).toHaveValue("Guangzhou");
    expect(field("Status")).toHaveValue("Active");
  });

  it("opens nothing for an id that isn't in the list", () => {
    nav.query = "dialog=edit&id=a-404";
    render(<ShippingAgentDialog agents={[SINO]} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("patches every editable field, then toasts Shipping agent saved", async () => {
    patch.mockResolvedValue({ shippingAgent: SINO });
    const { user, field, save } = open(EDIT);
    await user.clear(field("Office city"));
    await user.type(field("Office city"), "Nansha");
    await user.click(save);

    await waitFor(() => expect(nav.router.refresh).toHaveBeenCalledOnce());
    expect(patch).toHaveBeenCalledWith("/shipping-agents/a-1", {
      name: "Sino Freight",
      contactPerson: "Ms. Zhang Min",
      phone: "+86 20 8123 4567",
      officeCity: "Nansha",
      status: "Active",
    });
    expect(toast.success).toHaveBeenCalledWith("Shipping agent saved");
  });

  it("asks before deactivating; Cancel saves nothing, Deactivate saves", async () => {
    patch.mockResolvedValue({ shippingAgent: { ...SINO, status: "Inactive" } });
    const { user, field, save } = open(EDIT);
    await user.selectOptions(field("Status"), "Inactive");
    await user.click(save);

    const confirm = await screen.findByRole("alertdialog", { name: "Deactivate shipping agent?" });
    expect(confirm).toHaveTextContent("Are you sure you want to deactivate Sino Freight?");
    expect(confirm).toHaveTextContent("It won't appear when a container is loaded.");
    await user.click(within(confirm).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog", { name: /^Deactivate/ })).not.toBeInTheDocument());
    expect(patch).not.toHaveBeenCalled();

    await user.click(save);
    await user.click(await screen.findByRole("button", { name: "Deactivate shipping agent" }));
    await waitFor(() => expect(nav.router.refresh).toHaveBeenCalledOnce());
    expect(patch).toHaveBeenCalledWith("/shipping-agents/a-1", expect.objectContaining({ status: "Inactive" }));
    expect(toast.success).toHaveBeenCalledWith("Shipping agent saved");
  });
});
