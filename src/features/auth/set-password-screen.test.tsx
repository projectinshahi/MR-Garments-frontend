import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import { MESSAGES, SUCCESS } from "@/lib/feedback";

import { SetPasswordScreen, setPasswordProblems } from "./set-password-screen";

const { push, post } = vi.hoisted(() => ({ push: vi.fn(), post: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/api/client", () => ({ apiClient: { post } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/set-password?token=abc123");
});

const field = (label: string) => screen.getByLabelText(label, { selector: "input" });
const save = () => screen.getByRole("button", { name: "Save password" });

async function fill(next: string, confirm: string) {
  const user = userEvent.setup();
  if (next) await user.type(field("New password"), next);
  if (confirm) await user.type(field("Confirm new password"), confirm);
  return user;
}

describe("setPasswordProblems", () => {
  it("checks the new password is there and the confirmation matches (M7, M10, M11)", () => {
    expect(setPasswordProblems({ newPassword: "", confirmPassword: "" })).toEqual({
      newPassword: MESSAGES.newPasswordEmpty,
      confirmPassword: MESSAGES.confirmEmpty,
    });
    expect(setPasswordProblems({ newPassword: "Ledger2026x", confirmPassword: "Ledger2026y" })).toEqual({
      confirmPassword: MESSAGES.confirmMismatch,
    });
    // Rules (M8, M9) are the API's to check.
    expect(setPasswordProblems({ newPassword: "weak", confirmPassword: "weak" })).toEqual({});
  });
});

describe("SetPasswordScreen (AUTH-4)", () => {
  it("shows 03's layout without Current password", () => {
    render(<SetPasswordScreen />);
    expect(screen.getByRole("heading", { level: 1, name: "Set your password" })).toBeVisible();
    expect(screen.getByText("Choose a password for your account.")).toBeVisible();
    expect(screen.queryByLabelText("Current password")).toBeNull();
    expect(screen.getByRole("meter", { name: "Password strength" })).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByRole("button", { name: "Show confirm new password" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/login");
  });

  it("refuses a mismatched confirmation in the browser, without calling the API", async () => {
    render(<SetPasswordScreen />);
    const user = await fill("Ledger2026x", "Ledger2026y");
    await user.click(save());
    expect(screen.getByText(MESSAGES.confirmMismatch)).toBeVisible();
    expect(field("Confirm new password")).toHaveFocus();
    expect(post).not.toHaveBeenCalled();
  });

  it("asks for both empty fields and focuses the first", async () => {
    render(<SetPasswordScreen />);
    await userEvent.setup().click(save());
    expect(screen.getByText(MESSAGES.newPasswordEmpty)).toBeVisible();
    expect(screen.getByText(MESSAGES.confirmEmpty)).toBeVisible();
    expect(field("New password")).toHaveFocus();
  });

  it("sends the link's token and shows the API's rule message (M8)", async () => {
    post.mockRejectedValue(new ApiError(422, "password_rules", "Some fields need attention.", { newPassword: MESSAGES.passwordRules }));
    render(<SetPasswordScreen />);
    const user = await fill("ledger2026", "ledger2026");
    await user.click(save());
    expect(post).toHaveBeenCalledWith("/auth/reset-password", { token: "abc123", newPassword: "ledger2026" });
    expect(await screen.findByText(MESSAGES.passwordRules)).toBeVisible();
    expect(field("New password")).toHaveFocus();
    expect(field("New password")).toHaveValue("ledger2026");
  });

  it("shows M12 above the form for an invalid link", async () => {
    post.mockRejectedValue(new ApiError(422, "token_invalid", MESSAGES.linkInvalid));
    render(<SetPasswordScreen />);
    const user = await fill("Ledger2026x", "Ledger2026x");
    await user.click(save());
    expect(await screen.findByRole("alert")).toHaveTextContent(MESSAGES.linkInvalid);
    expect(toast.error).not.toHaveBeenCalled();
    expect(save()).toBeEnabled();
  });

  it("toasts K4 and opens /login on success", async () => {
    post.mockResolvedValue(undefined);
    render(<SetPasswordScreen />);
    const user = await fill("Ledger2026x", "Ledger2026x");
    await user.click(save());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    expect(toast.success).toHaveBeenCalledWith(SUCCESS.passwordSet);
    expect(field("New password")).toHaveValue("");
  });
});
