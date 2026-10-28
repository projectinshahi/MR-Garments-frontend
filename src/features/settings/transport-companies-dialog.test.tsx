import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { TransportCompanyRow } from "@/lib/api/types";

import { TransportCompanyDialogs } from "./transport-companies-dialog";

const nav = vi.hoisted(() => ({ query: "", router: { refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/transport-companies",
  useRouter: () => nav.router,
  useSearchParams: () => new URLSearchParams(nav.query),
}));
const replaceState = vi.spyOn(window.history, "replaceState");
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { post: vi.fn(), patch: vi.fn() } }));

const post = vi.mocked(apiClient.post);
const patch = vi.mocked(apiClient.patch);
const TAKEN = "A transport company with this name already exists.";
const KERALA: TransportCompanyRow = {
  id: "tc-1",
  name: "Kerala Roadways",
  contactPerson: "Mr. Biju Thomas",
  phone: "+91 94470 30011",
  tripsSoFar: 3,
  status: "Active",
};
const PERIYAR = { name: "Periyar Logistics", contactPerson: "Mr. Jose Mathew", phone: "+91 94470 88123" };

function open(query: string) {
  nav.query = query;
  const user = userEvent.setup();
  render(<TransportCompanyDialogs rows={[KERALA]} />);
  // Prefix match: "Transport company name" is followed by the required mark.
  const field = (label: string) => screen.getByLabelText(new RegExp(`^${label}`));
  const save = () => screen.getByRole("button", { name: "Save transport company" });
  return { user, field, save };
}

beforeEach(() => vi.clearAllMocks());

describe("Add transport company", () => {
  it("opens empty without Status, posts the fields, then toasts, closes and reloads", async () => {
    post.mockResolvedValue({ transportCompany: { ...PERIYAR, id: "tc-3", tripsSoFar: 0, status: "Active" } });
    const { user, field, save } = open("dialog=add");
    expect(screen.getByRole("dialog", { name: "Add transport company" })).toBeVisible();
    for (const label of ["Transport company name", "Contact person", "Phone"]) expect(field(label)).toHaveValue("");
    expect(screen.queryByLabelText("Status")).not.toBeInTheDocument();
    await user.type(field("Transport company name"), PERIYAR.name);
    await user.type(field("Contact person"), PERIYAR.contactPerson);
    await user.type(field("Phone"), PERIYAR.phone);
    await user.click(save());

    await waitFor(() => expect(nav.router.refresh).toHaveBeenCalledOnce());
    expect(post).toHaveBeenCalledWith("/transport-companies", PERIYAR);
    expect(toast.success).toHaveBeenCalledWith("Transport company added");
    expect(replaceState).toHaveBeenCalledWith(null, "", "/settings/transport-companies");
  });

  it("shows the name message without calling the API when the name is empty", async () => {
    const { user, save } = open("dialog=add");
    await user.click(save());
    expect(await screen.findByText("Enter the transport company name.")).toBeVisible();
    expect(post).not.toHaveBeenCalled();
  });

  it("shows a duplicate name under the field, keeping the values", async () => {
    post.mockRejectedValue(new ApiError(409, "name_exists", TAKEN, { name: TAKEN }));
    const { user, field, save } = open("dialog=add");
    await user.type(field("Transport company name"), "KERALA ROADWAYS");
    await user.click(save());
    expect(await screen.findByText(TAKEN)).toBeVisible();
    expect(field("Transport company name")).toHaveValue("KERALA ROADWAYS");
    expect(field("Transport company name")).toHaveFocus();
    expect(save()).toBeEnabled();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("disables Save while the request runs", async () => {
    let finish: () => void = () => {};
    post.mockReturnValue(new Promise((resolve) => (finish = () => resolve({}))));
    const { user, field, save } = open("dialog=add");
    await user.type(field("Transport company name"), PERIYAR.name);
    await user.click(save());
    await waitFor(() => expect(save()).toBeDisabled());
    finish();
    await waitFor(() => expect(nav.router.refresh).toHaveBeenCalledOnce());
  });
});

describe("Edit transport company", () => {
  it("opens with the row's values and Status, and patches every field", async () => {
    patch.mockResolvedValue({ transportCompany: { ...KERALA, contactPerson: "Mr. Biju T" } });
    const { user, field, save } = open("dialog=edit&id=tc-1");
    expect(screen.getByRole("dialog", { name: "Edit transport company" })).toBeVisible();
    expect(field("Transport company name")).toHaveValue(KERALA.name);
    expect(field("Phone")).toHaveValue(KERALA.phone);
    expect(field("Status")).toHaveValue("Active");
    await user.clear(field("Contact person"));
    await user.type(field("Contact person"), "Mr. Biju T");
    await user.click(save());

    await waitFor(() => expect(nav.router.refresh).toHaveBeenCalledOnce());
    expect(patch).toHaveBeenCalledWith("/transport-companies/tc-1", { name: KERALA.name, contactPerson: "Mr. Biju T", phone: KERALA.phone, status: "Active" });
    expect(toast.success).toHaveBeenCalledWith("Transport company saved");
  });

  it("asks before deactivating: Cancel keeps the dialog, Deactivate saves", async () => {
    patch.mockResolvedValue({ transportCompany: { ...KERALA, status: "Inactive" } });
    const { user, field, save } = open("dialog=edit&id=tc-1");
    await user.selectOptions(field("Status"), "Inactive");
    await user.click(save());

    const confirm = screen.getByRole("dialog", { name: "Deactivate Kerala Roadways?" });
    await user.click(within(confirm).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(confirm).not.toBeInTheDocument());
    expect(patch).not.toHaveBeenCalled();

    await user.click(save());
    await user.click(within(screen.getByRole("dialog", { name: "Deactivate Kerala Roadways?" })).getByRole("button", { name: "Deactivate" }));
    await waitFor(() => expect(nav.router.refresh).toHaveBeenCalledOnce());
    expect(patch).toHaveBeenCalledWith("/transport-companies/tc-1", expect.objectContaining({ status: "Inactive" }));
    expect(toast.success).toHaveBeenCalledWith("Transport company saved");
  });
});
