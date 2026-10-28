import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import { MESSAGES } from "@/lib/feedback";

import { LoginScreen } from "./login-screen";

const mocks = vi.hoisted(() => ({ post: vi.fn(), toastError: vi.fn(), replace: vi.fn(), search: "" }));
vi.mock("@/lib/api/client", () => ({ apiClient: { post: mocks.post } }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(mocks.search) }));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError, success: vi.fn() } }));

beforeEach(() => {
  mocks.search = "";
  vi.stubGlobal("location", { ...window.location, replace: mocks.replace });
  // The Radix checkbox measures itself; jsdom has no ResizeObserver.
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const fields = () => ({
  email: screen.getByLabelText("Email or username"),
  password: screen.getByLabelText("Password", { selector: "input" }),
  submit: screen.getByRole("button", { name: "Sign in" }),
});

async function fillAndSubmit(email = "suresh@mrgarments.com", password = "Secret2026x") {
  const user = userEvent.setup();
  const { email: emailInput, password: passwordInput, submit } = fields();
  if (email) await user.type(emailInput, email);
  if (password) await user.type(passwordInput, password);
  await user.click(submit);
  return user;
}

describe("LoginScreen (AUTH-1, U36)", () => {
  it("shows M1 and sends nothing while a field is empty", async () => {
    render(<LoginScreen />);
    await fillAndSubmit("   ", "");
    expect(screen.getByRole("alert")).toHaveTextContent(MESSAGES.signInEmpty);
    await fillAndSubmit("", "Secret2026x");
    expect(screen.getByRole("alert")).toHaveTextContent(MESSAGES.signInEmpty);
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("shows M2 above the button on 401, keeping the email and clearing the password (E4)", async () => {
    mocks.post.mockRejectedValue(new ApiError(401, "invalid_credentials", MESSAGES.signInWrong));
    render(<LoginScreen />);
    await fillAndSubmit();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(MESSAGES.signInWrong);
    expect(alert.nextElementSibling).toBe(fields().submit);
    expect(fields().email).toHaveValue("suresh@mrgarments.com");
    expect(fields().password).toHaveValue("");
    expect(fields().submit).toBeEnabled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("shows M3 on 429 (E5)", async () => {
    mocks.post.mockRejectedValue(new ApiError(429, "rate_limited", MESSAGES.tooManyAttempts));
    render(<LoginScreen />);
    await fillAndSubmit();
    expect(await screen.findByRole("alert")).toHaveTextContent(MESSAGES.tooManyAttempts);
  });

  it("sends the form, stays disabled while it runs, then loads the landing page (K1, E14)", async () => {
    let answer: (value: unknown) => void = () => {};
    mocks.post.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    render(<LoginScreen />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name: "Keep me signed in" }));
    await fillAndSubmit();
    expect(mocks.post).toHaveBeenCalledWith("/auth/login", { email: "suresh@mrgarments.com", password: "Secret2026x", keepSignedIn: true });
    expect(fields().submit).toBeDisabled();
    answer({ user: { landing: "/home" } });
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/home"));
    expect(fields().submit).toBeDisabled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows M4 above the form after the session ended, until the next attempt (E6, E7)", async () => {
    mocks.search = "reason=session-ended";
    render(<LoginScreen />);
    const notice = screen.getByRole("alert");
    expect(notice).toHaveTextContent(MESSAGES.sessionEnded);
    expect(notice.compareDocumentPosition(fields().email) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await fillAndSubmit("", "");
    expect(screen.getByRole("alert")).toHaveTextContent(MESSAGES.signInEmpty);
  });

  it("shows a field message from a 422 on the same line", async () => {
    mocks.post.mockRejectedValue(new ApiError(422, "validation_failed", "Some fields need attention.", { password: MESSAGES.signInWrong }));
    render(<LoginScreen />);
    await fillAndSubmit();
    expect(await screen.findByRole("alert")).toHaveTextContent(MESSAGES.signInWrong);
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("hands other failures to the error toast and keeps what was typed (E12)", async () => {
    mocks.post.mockRejectedValue(new ApiError(0, "network_error", "Something went wrong."));
    render(<LoginScreen />);
    await fillAndSubmit();
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(MESSAGES.somethingWrong, { description: MESSAGES.tryAgain }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(fields().password).toHaveValue("Secret2026x");
    expect(fields().submit).toBeEnabled();
  });
});
