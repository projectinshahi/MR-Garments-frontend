import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import type { RolesResponse } from "@/lib/api/types";
import { MESSAGES } from "@/lib/feedback";

import type { UserDetail } from "./data/queries";
import { EditUserForm } from "./edit-user-form";
import { DEACTIVATE_NOTE } from "./user-form";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/users/edit" }));
const patch = vi.fn();
const post = vi.fn();
vi.mock("@/lib/api/client", () => ({ apiClient: { patch: (...args: unknown[]) => patch(...args), post: (...args: unknown[]) => post(...args) } }));
const success = vi.fn();
vi.mock("@/lib/feedback", async (original) => ({ ...(await original<typeof import("@/lib/feedback")>()), notifySuccess: (m: string) => success(m) }));

const roles = ["Management", "Procurement", "Accounts", "China staff", "India staff", "Warehouse staff"] as const;
// The stage rows of ROL-1 (49): Management Full, Procurement View on Receiving, each staff role Enter on its own stages.
const stageRow = (staff: string, extra: object = {}) => ({
  ...Object.fromEntries(roles.map((role) => [role, role === "Management" ? "Full" : role === staff ? "Enter" : "None"])),
  ...extra,
});
const matrix = {
  roles: [...roles],
  capabilities: [],
  matrix: {
    receiving: stageRow("China staff", { Procurement: "View" }),
    containers: stageRow("China staff"),
    clearing: stageRow("India staff"),
    transport: stageRow("India staff"),
    warehouse: stageRow("Warehouse staff"),
  },
} as unknown as RolesResponse;
const STAGES = ["Receiving (China)", "Container loading", "Clearing (India)", "Transport", "Warehouse"];
const tick = (name: string) => screen.getByRole("checkbox", { name });
/** The stage ticks the role can hold (enabled), in screen order. */
const enabledStages = () => STAGES.filter((name) => !tick(name).hasAttribute("disabled"));
const checkedStages = () => STAGES.filter((name) => tick(name).getAttribute("aria-checked") === "true");
const options = { roles: [...roles], offices: [{ id: "loc-gz", name: "Guangzhou office" }], languages: ["English"] };
const wang: UserDetail = {
  id: "u-wang",
  name: "Wang Fang",
  email: "wang@mrgarments.com",
  phone: "",
  role: "China staff",
  officeId: "loc-gz",
  office: "Guangzhou office",
  language: "English",
  status: "Active",
  stages: [2, 3],
  lastSignInAt: null,
};

// jsdom has no ResizeObserver; the Radix checkbox measures itself with one.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

beforeEach(() => vi.clearAllMocks());

describe("EditUserForm", () => {
  it("shows the API's field error under the stage ticks, focuses it and keeps the values (E1; M18 stays the backstop)", async () => {
    const user = userEvent.setup();
    let fail!: (error: unknown) => void;
    patch.mockReturnValue(new Promise((_, reject) => (fail = reject)));
    render(<EditUserForm user={{ ...wang, stages: [2] }} options={options} matrix={matrix} isSelf={false} />);

    await user.click(tick("Container loading"));
    const save = screen.getByRole("button", { name: "Save user" });
    await user.click(save);
    expect(patch).toHaveBeenCalledWith("/users/u-wang", expect.objectContaining({ stages: [2, 3], officeId: "loc-gz" }));
    expect(patch.mock.calls[0]![1]).not.toHaveProperty("password");
    await waitFor(() => expect(save).toBeDisabled()); // E14

    // The browser only offers the role's stages; the API still checks them (for example after a matrix change).
    const m18 = "China staff can't enter data for Container loading. Untick it first.";
    fail(new ApiError(422, "validation_failed", "Some fields need attention.", { stages: m18 }));
    expect(await screen.findByText(m18)).toBeInTheDocument();
    expect(tick("Receiving (China)")).toHaveFocus();
    expect(tick("Container loading")).toBeChecked();
    expect(save).toBeEnabled();
    expect(push).not.toHaveBeenCalled();
  });

  it("offers only the role's own stages: China staff 2-3, India staff 4-5, Warehouse staff 6", () => {
    const { unmount } = render(<EditUserForm user={wang} options={options} matrix={matrix} isSelf={false} />);
    expect(enabledStages()).toEqual(["Receiving (China)", "Container loading"]);
    expect(tick("Clearing (India)")).toBeDisabled();
    expect(screen.queryByText(/doesn't use stage access/)).not.toBeInTheDocument();
    unmount();
    render(<EditUserForm user={{ ...wang, role: "India staff", stages: [4, 5] }} options={options} matrix={matrix} isSelf={false} />);
    expect(enabledStages()).toEqual(["Clearing (India)", "Transport"]);
  });

  it("China staff -> India staff unticks Receiving and Container loading before Save", async () => {
    const user = userEvent.setup();
    patch.mockResolvedValue({ user: wang });
    render(<EditUserForm user={wang} options={options} matrix={matrix} isSelf={false} />);
    expect(checkedStages()).toEqual(["Receiving (China)", "Container loading"]);
    await user.selectOptions(screen.getByRole("combobox", { name: "Role" }), "India staff");
    expect(checkedStages()).toEqual([]);
    expect(enabledStages()).toEqual(["Clearing (India)", "Transport"]);
    await user.click(tick("Clearing (India)"));
    await user.click(screen.getByRole("button", { name: "Save user" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/users"));
    expect(patch).toHaveBeenCalledWith("/users/u-wang", expect.objectContaining({ role: "India staff", stages: [4] }));
  });

  it("India staff [4, 5] -> Warehouse staff clears 4 and 5 and offers Warehouse only", async () => {
    const user = userEvent.setup();
    patch.mockResolvedValue({ user: wang });
    render(<EditUserForm user={{ ...wang, role: "India staff", stages: [4, 5] }} options={options} matrix={matrix} isSelf={false} />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Role" }), "Warehouse staff");
    expect(checkedStages()).toEqual([]);
    expect(enabledStages()).toEqual(["Warehouse"]);
    await user.click(tick("Warehouse"));
    await user.click(screen.getByRole("button", { name: "Save user" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/users"));
    expect(patch).toHaveBeenCalledWith("/users/u-wang", expect.objectContaining({ role: "Warehouse staff", stages: [6] }));
  });

  it("disables every tick for a role without stage access and says why; moving staff there clears the ticks", async () => {
    const user = userEvent.setup();
    render(<EditUserForm user={wang} options={options} matrix={matrix} isSelf={false} />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Role" }), "Procurement");
    expect(enabledStages()).toEqual([]);
    expect(checkedStages()).toEqual([]);
    const hint = screen.getByText("Procurement doesn't use stage access.");
    for (const name of STAGES) expect(tick(name)).toHaveAttribute("aria-describedby", hint.id);
    await user.selectOptions(screen.getByRole("combobox", { name: "Role" }), "Management");
    expect(screen.getByText("Management doesn't use stage access.")).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "Role" }), "China staff");
    expect(screen.queryByText(/doesn't use stage access/)).not.toBeInTheDocument();
    expect(enabledStages()).toEqual(["Receiving (China)", "Container loading"]);
    expect(checkedStages()).toEqual([]);
  });

  it("Add user: no ticks until a role is chosen, and no hint either", () => {
    render(<EditUserForm user={null} options={options} matrix={matrix} isSelf={false} />);
    expect(enabledStages()).toEqual([]);
    expect(screen.queryByText(/doesn't use stage access/)).not.toBeInTheDocument();
  });

  it("puts M20 under the field that changed (E3, AT-U6)", async () => {
    const user = userEvent.setup();
    const m20 = "At least one active Management user is required.";
    patch.mockRejectedValue(new ApiError(409, "last_management", m20, { role: m20 }));
    render(<EditUserForm user={{ ...wang, role: "Management", stages: [] }} options={options} matrix={matrix} isSelf={false} />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Role" }), "Procurement");
    await user.click(screen.getByRole("button", { name: "Save user" }));
    expect(await screen.findByText(m20)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Role" })).toHaveFocus();
    expect(screen.getByRole("combobox", { name: "Role" })).toHaveValue("Procurement");
  });

  it("saves, says so and goes to the list (K6)", async () => {
    const user = userEvent.setup();
    patch.mockResolvedValue({ user: wang });
    render(<EditUserForm user={wang} options={options} matrix={matrix} isSelf={false} />);
    await user.click(screen.getByRole("checkbox", { name: "Container loading" }));
    await user.click(screen.getByRole("button", { name: "Save user" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/users"));
    expect(patch).toHaveBeenCalledWith("/users/u-wang", expect.objectContaining({ stages: [2] }));
    expect(patch.mock.calls[0]![1]).not.toHaveProperty("password");
    expect(success).toHaveBeenCalledWith("User saved");
  });

  it("sets a new password for another user, shows the API's rule message, and clears the field after saving", async () => {
    const user = userEvent.setup();
    patch.mockRejectedValueOnce(new ApiError(422, "validation_failed", "Some fields need attention.", { password: MESSAGES.passwordRules }));
    patch.mockResolvedValueOnce({ user: wang });
    render(<EditUserForm user={wang} options={options} matrix={matrix} isSelf={false} />);
    const field = screen.getByLabelText("Set a new password");
    expect(field).toHaveValue("");
    expect(field).not.toBeRequired();
    expect(screen.queryByRole("meter", { name: "Password strength" })).not.toBeInTheDocument();

    await user.type(field, "ledger2026");
    expect(screen.getByRole("meter", { name: "Password strength" })).toHaveAttribute("aria-valuenow", "2");
    await user.click(screen.getByRole("button", { name: "Save user" }));
    expect(await screen.findByText(MESSAGES.passwordRules)).toBeInTheDocument();
    expect(field).toHaveFocus();
    expect(patch).toHaveBeenLastCalledWith("/users/u-wang", expect.objectContaining({ password: "ledger2026" }));

    await user.clear(field);
    await user.type(field, "Ledger2026x");
    await user.click(screen.getByRole("button", { name: "Save user" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/users"));
    expect(patch).toHaveBeenLastCalledWith("/users/u-wang", expect.objectContaining({ password: "Ledger2026x" }));
    expect(field).toHaveValue("");
  });

  it("forgets an unsaved password, masked again, when the page is hidden (Activity) or unmounted", async () => {
    const user = userEvent.setup();
    const page = (detail: UserDetail | null, mode: "visible" | "hidden") => (
      <Activity mode={mode}>
        <EditUserForm user={detail} options={options} matrix={matrix} isSelf={false} />
      </Activity>
    );
    for (const [detail, label, toggle] of [
      [wang, "Set a new password", "Show new password"],
      [null, /^Password/, "Show password"],
    ] as const) {
      const { rerender, unmount } = render(page(detail, "visible"));
      await user.type(screen.getByLabelText(label, { selector: "input" }), "Typed2026x");
      await user.click(screen.getByRole("button", { name: toggle }));
      rerender(page(detail, "hidden"));
      rerender(page(detail, "visible"));
      const field = screen.getByLabelText(label, { selector: "input" });
      expect(field).toHaveValue("");
      expect(field).toHaveAttribute("type", "password");
      unmount();
    }

    // Edit user: saving another field later sends no password.
    patch.mockResolvedValue({ user: wang });
    const { rerender } = render(page(wang, "visible"));
    await user.type(screen.getByLabelText("Set a new password"), "Typed2026x");
    rerender(page(wang, "hidden"));
    rerender(page(wang, "visible"));
    await user.click(screen.getByRole("checkbox", { name: "Container loading" }));
    await user.click(screen.getByRole("button", { name: "Save user" }));
    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect(patch.mock.calls[0]![1]).not.toHaveProperty("password");
  });

  it("asks before deactivating: Cancel saves nothing and keeps the form, Deactivate saves (contract D3)", async () => {
    const user = userEvent.setup();
    patch.mockResolvedValue({ user: { ...wang, status: "Inactive" } });
    render(<EditUserForm user={wang} options={options} matrix={matrix} isSelf={false} />);
    const status = screen.getByRole("combobox", { name: "Status" });
    await user.selectOptions(status, "Inactive");
    await user.click(screen.getByRole("button", { name: "Save user" }));

    const confirm = await screen.findByRole("alertdialog", { name: "Deactivate user?" });
    expect(confirm).toHaveTextContent(`Are you sure you want to deactivate Wang Fang? ${DEACTIVATE_NOTE}`);
    await user.click(within(confirm).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(patch).not.toHaveBeenCalled();
    expect(status).toHaveValue("Inactive");

    await user.click(screen.getByRole("button", { name: "Save user" }));
    await user.click(within(await screen.findByRole("alertdialog", { name: "Deactivate user?" })).getByRole("button", { name: "Deactivate user" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/users"));
    expect(patch).toHaveBeenCalledOnce();
    expect(patch).toHaveBeenCalledWith("/users/u-wang", expect.objectContaining({ status: "Inactive" }));
    expect(success).toHaveBeenCalledWith("User saved");
  });

  it("shows the API's own-account refusal under Status (409 own_account)", async () => {
    const user = userEvent.setup();
    const own = "You can't deactivate your own account.";
    patch.mockRejectedValue(new ApiError(409, "own_account", own, { status: own }));
    render(<EditUserForm user={wang} options={options} matrix={matrix} isSelf={false} />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Status" }), "Inactive");
    await user.click(screen.getByRole("button", { name: "Save user" }));
    await user.click(within(await screen.findByRole("alertdialog", { name: "Deactivate user?" })).getByRole("button", { name: "Deactivate user" }));

    const group = screen.getAllByRole("group").find((field) => within(field).queryByRole("combobox", { name: "Status" }))!;
    expect(await within(group).findByText(own)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(push).not.toHaveBeenCalled();
  });

  it("locks Status on the signed-in user's own account and says why; other changes still save", async () => {
    const user = userEvent.setup();
    patch.mockResolvedValue({ user: wang });
    render(<EditUserForm user={wang} options={options} matrix={matrix} isSelf />);
    const status = screen.getByRole("combobox", { name: "Status" });
    expect(status).toBeDisabled();
    expect(status).toHaveAccessibleDescription("You can't deactivate your own account.");

    await user.click(tick("Container loading"));
    await user.click(screen.getByRole("button", { name: "Save user" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/users"));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(patch).toHaveBeenCalledWith("/users/u-wang", expect.objectContaining({ status: "Active", stages: [2] }));
  });

  it("shows no password field on the signed-in user's own account", () => {
    render(<EditUserForm user={wang} options={options} matrix={matrix} isSelf />);
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Full name" })).toHaveValue("Wang Fang");
  });

  it("adds a user from an empty form, checking the required fields first (K5, M13, M14, M16)", async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ user: wang });
    render(<EditUserForm user={null} options={options} matrix={matrix} isSelf={false} />);
    const password = screen.getByLabelText(/^Password/, { selector: "input" });
    expect(password).toBeRequired();
    expect(password).toHaveAttribute("type", "password");
    expect(screen.getByRole("meter", { name: "Password strength" })).toHaveAttribute("aria-valuenow", "0");
    await user.click(screen.getByRole("button", { name: "Save user" }));
    expect(await screen.findByText("Enter the full name.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Choose a role.")).toBeInTheDocument();
    expect(screen.getByText("Enter a password.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Full name" })).toHaveFocus();
    expect(post).not.toHaveBeenCalled();

    await user.type(screen.getByRole("textbox", { name: "Full name" }), "Test User");
    await user.type(screen.getByRole("textbox", { name: "Email" }), "test@mrgarments.com");
    await user.selectOptions(screen.getByRole("combobox", { name: "Role" }), "China staff");
    await user.click(screen.getByRole("checkbox", { name: "Receiving (China)" }));
    await user.type(password, "Welcome2026x");
    await user.click(screen.getByRole("button", { name: "Save user" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/users"));
    expect(password).toHaveValue("");
    expect(post).toHaveBeenCalledWith("/users", {
      name: "Test User",
      email: "test@mrgarments.com",
      phone: "",
      role: "China staff",
      officeId: null,
      language: "English",
      status: "Active",
      stages: [2],
      password: "Welcome2026x",
    });
    expect(success).toHaveBeenCalledWith("User added");
  });
});
