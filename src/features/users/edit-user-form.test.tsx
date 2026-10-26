import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import type { RolesResponse } from "@/lib/api/types";

import type { UserDetail } from "./data/queries";
import { EditUserForm } from "./edit-user-form";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/users/edit" }));
const patch = vi.fn();
const post = vi.fn();
vi.mock("@/lib/api/client", () => ({ apiClient: { patch: (...args: unknown[]) => patch(...args), post: (...args: unknown[]) => post(...args) } }));
const success = vi.fn();
vi.mock("@/lib/feedback", async (original) => ({ ...(await original<typeof import("@/lib/feedback")>()), notifySuccess: (m: string) => success(m) }));

const roles = ["Management", "Procurement", "Accounts", "China staff", "India staff", "Warehouse staff"] as const;
const matrix = { roles: [...roles], capabilities: [], matrix: {} } as unknown as RolesResponse;
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
  it("shows the API's field error under the stage ticks, focuses it and keeps the values (E1, AT-U4)", async () => {
    const user = userEvent.setup();
    let fail!: (error: unknown) => void;
    patch.mockReturnValue(new Promise((_, reject) => (fail = reject)));
    render(<EditUserForm user={wang} options={options} matrix={matrix} />);

    await user.click(screen.getByRole("checkbox", { name: "Clearing (India)" }));
    const save = screen.getByRole("button", { name: "Save user" });
    await user.click(save);
    expect(patch).toHaveBeenCalledWith("/users/u-wang", expect.objectContaining({ stages: [2, 3, 4], officeId: "loc-gz" }));
    expect(patch.mock.calls[0]![1]).not.toHaveProperty("password");
    await waitFor(() => expect(save).toBeDisabled()); // E14

    const m18 = "China staff can't enter data for Clearing (India). Untick it first.";
    fail(new ApiError(422, "validation_failed", "Some fields need attention.", { stages: m18 }));
    expect(await screen.findByText(m18)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Receiving (China)" })).toHaveFocus();
    expect(screen.getByRole("checkbox", { name: "Clearing (India)" })).toBeChecked();
    expect(save).toBeEnabled();
    expect(push).not.toHaveBeenCalled();
  });

  it("puts M20 under the field that changed (E3, AT-U6)", async () => {
    const user = userEvent.setup();
    const m20 = "At least one active Management user is required.";
    patch.mockRejectedValue(new ApiError(409, "last_management", m20, { role: m20 }));
    render(<EditUserForm user={{ ...wang, role: "Management", stages: [] }} options={options} matrix={matrix} />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Role" }), "Procurement");
    await user.click(screen.getByRole("button", { name: "Save user" }));
    expect(await screen.findByText(m20)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Role" })).toHaveFocus();
    expect(screen.getByRole("combobox", { name: "Role" })).toHaveValue("Procurement");
  });

  it("saves, says so and goes to the list (K6)", async () => {
    const user = userEvent.setup();
    patch.mockResolvedValue({ user: wang });
    render(<EditUserForm user={wang} options={options} matrix={matrix} />);
    await user.click(screen.getByRole("checkbox", { name: "Container loading" }));
    await user.click(screen.getByRole("button", { name: "Save user" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/users"));
    expect(patch).toHaveBeenCalledWith("/users/u-wang", expect.objectContaining({ stages: [2] }));
    expect(success).toHaveBeenCalledWith("User saved");
  });

  it("adds a user from an empty form, checking the required fields first (K5, M13, M14, M16)", async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ user: wang });
    render(<EditUserForm user={null} options={options} matrix={matrix} />);
    expect(screen.getByLabelText("Password")).toHaveAttribute("readonly");
    await user.click(screen.getByRole("button", { name: "Save user" }));
    expect(await screen.findByText("Enter the full name.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Choose a role.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Full name" })).toHaveFocus();
    expect(post).not.toHaveBeenCalled();

    await user.type(screen.getByRole("textbox", { name: "Full name" }), "Test User");
    await user.type(screen.getByRole("textbox", { name: "Email" }), "test@mrgarments.com");
    await user.selectOptions(screen.getByRole("combobox", { name: "Role" }), "China staff");
    await user.click(screen.getByRole("checkbox", { name: "Receiving (China)" }));
    await user.click(screen.getByRole("button", { name: "Save user" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/users"));
    expect(post).toHaveBeenCalledWith("/users", {
      name: "Test User",
      email: "test@mrgarments.com",
      phone: "",
      role: "China staff",
      officeId: null,
      language: "English",
      status: "Active",
      stages: [2],
    });
    expect(success).toHaveBeenCalledWith("User added");
  });
});
