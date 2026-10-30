import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import type { Profile } from "@/lib/api/types";

import { PROFILE_TEXT, ProfileScreen } from "./profile-screen";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }), usePathname: () => "/profile" }));
const patch = vi.fn();
vi.mock("@/lib/api/client", () => ({ apiClient: { patch: (...args: unknown[]) => patch(...args) } }));
const success = vi.fn();
vi.mock("@/lib/feedback", async (original) => ({ ...(await original<typeof import("@/lib/feedback")>()), notifySuccess: (m: string) => success(m) }));

const priya: Profile = {
  name: "Priya Nair",
  email: "priya@mrgarments.com",
  phone: "+91 98470 20012",
  role: "Procurement",
  office: { id: "loc-kochi", name: "Kochi office" },
  language: "English",
  // 01:30 on 12 Aug in India: the card shows the India date.
  passwordChangedAt: "2026-08-11T20:00:00.000Z",
};

const renderScreen = (profile = priya) => render(<ProfileScreen profile={profile} languages={["English"]} />);
const textbox = (name: string) => screen.getByRole("textbox", { name });
const save = () => screen.getByRole("button", { name: "Save changes" });

beforeEach(() => vi.clearAllMocks());

describe("ProfileScreen", () => {
  it("shows the API's profile; email, role and office are read-only; no password change and no switches", () => {
    renderScreen();
    expect(textbox("Full name")).toHaveValue("Priya Nair");
    expect(textbox("Phone")).toHaveValue("+91 98470 20012");
    expect(screen.getByRole("combobox", { name: "Language" })).toHaveValue("English");
    for (const [name, value] of [
      ["Email", "priya@mrgarments.com"],
      ["Role", "Procurement"],
      ["Office", "Kochi office"],
    ]) {
      expect(textbox(name!)).toHaveValue(value);
      expect(textbox(name!)).toHaveAttribute("readonly");
    }
    expect(screen.getByText("Last changed 12 Aug 2026")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /change password/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /change password/i })).not.toBeInTheDocument();
    expect(screen.getByText("To change it, ask a Management user.")).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.getByText(PROFILE_TEXT.notifications)).toBeInTheDocument();
  });

  it("says Not set when no password was ever set, and leaves the office empty without one", () => {
    renderScreen({ ...priya, passwordChangedAt: null, office: null });
    expect(screen.getByText("Not set")).toBeInTheDocument();
    expect(textbox("Office")).toHaveValue("");
  });

  it("saves only the editable keys from the header button, says so and refreshes", async () => {
    const user = userEvent.setup();
    let done!: (value: unknown) => void;
    patch.mockReturnValue(new Promise((resolve) => (done = resolve)));
    renderScreen();

    expect(save()).toHaveAttribute("form", screen.getByRole("form", { name: "My details" }).id);
    await user.clear(textbox("Full name"));
    await user.type(textbox("Full name"), "  Priya N  ");
    await user.clear(textbox("Phone"));
    await user.click(save());
    expect(patch).toHaveBeenCalledWith("/profile", { name: "Priya N", phone: "", language: "English" });
    await waitFor(() => expect(save()).toBeDisabled());

    done({ profile: { ...priya, name: "Priya N", phone: "" } });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(success).toHaveBeenCalledWith("Profile saved");
    expect(textbox("Full name")).toHaveValue("Priya N");
    expect(save()).toBeEnabled();
  });

  it("checks the name first (M13) and sends nothing", async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.clear(textbox("Full name"));
    await user.click(save());
    expect(await screen.findByText("Enter the full name.")).toBeInTheDocument();
    expect(textbox("Full name")).toHaveFocus();
    expect(patch).not.toHaveBeenCalled();
  });

  it("shows the API's field errors under their fields, focuses the first and keeps the values", async () => {
    const user = userEvent.setup();
    patch.mockRejectedValue(
      new ApiError(422, "validation_failed", "Some fields need attention.", { language: "Choose a language from the list.", name: "Enter the full name." }),
    );
    renderScreen();
    await user.type(textbox("Full name"), " K");
    await user.type(textbox("Phone"), " 3");
    await user.click(save());
    expect(await screen.findByText("Enter the full name.")).toBeInTheDocument();
    expect(screen.getByText("Choose a language from the list.")).toBeInTheDocument();
    expect(textbox("Full name")).toHaveFocus();
    expect(textbox("Full name")).toHaveValue("Priya Nair K");
    expect(textbox("Phone")).toHaveValue("+91 98470 20012 3");
    expect(save()).toBeEnabled();
    expect(success).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it.each([
    ["a server error", new ApiError(500, "internal", "Something went wrong.")],
    ["a lost request", new ApiError(0, "network_error", "Something went wrong.")],
  ])("keeps the typed values after %s", async (_, error) => {
    const user = userEvent.setup();
    let fail!: (error: unknown) => void;
    patch.mockReturnValue(new Promise((_, reject) => (fail = reject)));
    renderScreen();
    await user.type(textbox("Full name"), " K");
    await user.click(save());
    await waitFor(() => expect(save()).toBeDisabled());
    fail(error);
    await waitFor(() => expect(save()).toBeEnabled());
    expect(patch).toHaveBeenCalledTimes(1);
    expect(textbox("Full name")).toHaveValue("Priya Nair K");
    expect(success).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
