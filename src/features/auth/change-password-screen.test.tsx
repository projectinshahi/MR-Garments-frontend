import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import { MESSAGES, SUCCESS } from "@/lib/feedback";

import { ChangePasswordScreen } from "./change-password-screen";

const { push, post } = vi.hoisted(() => ({ push: vi.fn(), post: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/api/client", () => ({ apiClient: { post } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => vi.clearAllMocks());

const field = (label: string) => screen.getByLabelText(label, { selector: "input" });
const save = () => screen.getByRole("button", { name: "Save new password" });

async function fillAll(current: string, next: string, confirm: string) {
  const user = userEvent.setup();
  await user.type(field("Current password"), current);
  await user.type(field("New password"), next);
  await user.type(field("Confirm new password"), confirm);
  return user;
}

describe("ChangePasswordScreen (AUTH-5)", () => {
  it("starts empty and updates the meter and rules as the new password is typed", async () => {
    render(<ChangePasswordScreen />);
    for (const label of ["Current password", "New password", "Confirm new password"]) expect(field(label)).toHaveValue("");
    const meter = screen.getByRole("meter", { name: "Password strength" });
    expect(meter).toHaveAttribute("aria-valuenow", "0");
    await userEvent.setup().type(field("New password"), "garments2026");
    expect(meter).toHaveAttribute("aria-valuenow", "3");
    expect(screen.getByRole("list", { name: "Password rules" })).toHaveTextContent("Not met: One capital letter");
  });

  it("saves, disables Save meanwhile, then toasts K3 and opens /profile", async () => {
    let finish: () => void = () => {};
    post.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    render(<ChangePasswordScreen />);
    const user = await fillAll("Old2026pass", "Ledger2026x", "Ledger2026x");
    await user.click(save());
    expect(post).toHaveBeenCalledWith("/auth/change-password", {
      currentPassword: "Old2026pass",
      newPassword: "Ledger2026x",
      confirmPassword: "Ledger2026x",
    });
    expect(save()).toBeDisabled();
    finish();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/profile"));
    expect(toast.success).toHaveBeenCalledWith(SUCCESS.passwordChanged);
    expect(field("New password")).toHaveValue("");
    expect(save()).toBeEnabled();
  });

  it("shows the API's field messages under each field, focuses the first and keeps the values (E1)", async () => {
    post.mockRejectedValue(
      new ApiError(422, "wrong_current_password", "Some fields need attention.", {
        currentPassword: MESSAGES.currentPasswordWrong,
        confirmPassword: MESSAGES.confirmMismatch,
      }),
    );
    render(<ChangePasswordScreen />);
    const user = await fillAll("Wrong2026x", "Ledger2026x", "Ledger2026y");
    await user.click(save());
    expect(await screen.findByText(MESSAGES.currentPasswordWrong)).toBeVisible();
    expect(screen.getByText(MESSAGES.confirmMismatch)).toBeVisible();
    expect(field("Current password")).toHaveAttribute("aria-invalid", "true");
    expect(field("Current password")).toHaveAccessibleDescription(MESSAGES.currentPasswordWrong);
    expect(field("New password")).toHaveAttribute("aria-invalid", "false");
    expect(field("Current password")).toHaveFocus();
    expect(field("Confirm new password")).toHaveValue("Ledger2026y");
    expect(save()).toBeEnabled();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows the M24 toast for other failures and keeps the values (E12)", async () => {
    post.mockRejectedValue(new ApiError(0, "network_error", "Something went wrong."));
    render(<ChangePasswordScreen />);
    const user = await fillAll("Old2026pass", "Ledger2026x", "Ledger2026x");
    await user.click(save());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(MESSAGES.somethingWrong, { description: MESSAGES.tryAgain }));
    expect(field("New password")).toHaveValue("Ledger2026x");
  });
});
