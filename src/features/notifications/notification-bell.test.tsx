import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import type { Me, Notification, NotificationsPage } from "@/lib/api/types";

import { badgeText, NotificationBell } from "./notification-bell";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }), usePathname: () => "/" }));
const get = vi.fn();
const post = vi.fn();
vi.mock("@/lib/api/client", () => ({ apiClient: { get: (path: string) => get(path), post: (path: string) => post(path) } }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

/** Accounts: payments Enter, orders View, no containers. */
const viewer = { shell: "management", permissions: { payments: "Enter", ordersView: "View", containers: "None" } } as Pick<Me, "shell" | "permissions">;
const note = (id: string, extra: Partial<Notification> = {}): Notification => ({
  id,
  kind: "payment-recorded",
  title: `${id} title`,
  details: ["Foshan Fabrics", "¥3,000"],
  href: null,
  createdAt: new Date().toISOString(),
  read: false,
  ...extra,
});

const api = { unread: 3, list: [] as Notification[] | Error };
const pageOf = (items: Notification[]): NotificationsPage => ({ items, nextCursor: null, unread: api.unread });

beforeEach(() => {
  vi.clearAllMocks();
  api.unread = 3;
  api.list = [];
  get.mockImplementation(async (path: string) => {
    if (path === "/notifications/unread-count") return { unread: api.unread };
    if (api.list instanceof Error) throw api.list;
    return pageOf(api.list);
  });
});

// hidden: the open panel (a modal sheet) hides the rest of the page from the accessibility tree.
const bell = (name: string | RegExp = /^Notifications/) => screen.findByRole("button", { name, hidden: true });
const panel = () => screen.getByRole("dialog", { name: "Notifications" });
const row = (title: string) => within(panel()).getByRole("button", { name: new RegExp(title) });

describe("NotificationBell count", () => {
  it("names the count and shows it in a badge, capped at 9+, with no badge at 0", async () => {
    const { unmount } = render(<NotificationBell viewer={viewer} />);
    expect(await bell("Notifications, 3 unread")).toHaveTextContent("3");
    unmount();

    api.unread = 12;
    const second = render(<NotificationBell viewer={viewer} />);
    expect(await bell("Notifications, 12 unread")).toHaveTextContent("9+");
    second.unmount();

    api.unread = 0;
    render(<NotificationBell viewer={viewer} />);
    await waitFor(() => expect(get).toHaveBeenLastCalledWith("/notifications/unread-count"));
    expect(await bell("Notifications")).toHaveTextContent("");
    expect(badgeText(9)).toBe("9");
  });

  it("fetches the count once on mount and again when the window regains focus, never the list until opened", async () => {
    render(<NotificationBell viewer={viewer} />);
    await bell("Notifications, 3 unread");
    expect(get).toHaveBeenCalledTimes(1);

    api.unread = 5;
    act(() => void window.dispatchEvent(new Event("focus")));
    expect(await bell("Notifications, 5 unread")).toBeInTheDocument();
    expect(get.mock.calls.map(([path]) => path)).toEqual(["/notifications/unread-count", "/notifications/unread-count"]);
  });

  it("keeps working when the count request fails (a 401 included)", async () => {
    get.mockRejectedValue(new ApiError(401, "unauthenticated", "Sign in"));
    render(<NotificationBell viewer={viewer} />);
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(await bell("Notifications")).toBeEnabled();
  });
});

describe("NotificationBell panel", () => {
  it("shows a loading state, then the latest 10", async () => {
    let answer: (page: NotificationsPage) => void = () => {};
    get.mockImplementation((path: string) =>
      path === "/notifications/unread-count" ? Promise.resolve({ unread: 3 }) : new Promise((resolve) => (answer = resolve)),
    );
    const user = userEvent.setup();
    render(<NotificationBell viewer={viewer} />);
    await user.click(await bell("Notifications, 3 unread"));
    expect(within(panel()).getByText("Loading notifications…")).toBeInTheDocument();
    await act(async () => answer(pageOf([note("PO-2050 payment")])));
    expect(row("PO-2050 payment")).toHaveTextContent("Foshan Fabrics · ¥3,000");
    expect(get).toHaveBeenCalledWith("/notifications?limit=10");
    expect(within(panel()).getByRole("link", { name: "View all" })).toHaveAttribute("href", "/notifications");
  });

  it("shows an empty state", async () => {
    const user = userEvent.setup();
    render(<NotificationBell viewer={viewer} />);
    await user.click(await bell());
    expect(await within(panel()).findByText("No notifications yet")).toBeInTheDocument();
  });

  it("shows an error with a retry", async () => {
    api.list = new ApiError(500, "internal", "Something went wrong.");
    const user = userEvent.setup();
    render(<NotificationBell viewer={viewer} />);
    await user.click(await bell());
    const alert = await within(panel()).findByRole("alert");
    expect(alert).toHaveTextContent("Notifications failed to load.");

    api.list = [note("PO-2051 payment")];
    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await within(panel()).findByRole("button", { name: /PO-2051 payment/ })).toBeInTheDocument();
  });

  it("marks one read and updates the badge; opens only pages the viewer may open", async () => {
    api.list = [
      note("allowed", { href: "/orders/PO-2050" }),
      note("forbidden", { kind: "container-sailed", href: "/containers/c1" }),
      note("external", { href: "//evil.example/orders" }),
    ];
    post.mockImplementation(async (path: string) => ({ notification: note(path.split("/")[2]!, { read: true }) }));
    const user = userEvent.setup();
    render(<NotificationBell viewer={viewer} />);
    await user.click(await bell("Notifications, 3 unread"));
    await within(panel()).findByRole("list", { name: "Notifications" });

    api.unread = 2;
    await user.click(row("forbidden"));
    expect(post).toHaveBeenCalledWith("/notifications/forbidden/read");
    expect(await bell("Notifications, 2 unread")).toBeInTheDocument();
    // Read now and nothing to open: the row is no longer a button, and the panel stays.
    await waitFor(() => expect(within(panel()).queryByRole("button", { name: /forbidden/ })).toBeNull());
    await user.click(row("external"));
    expect(push).not.toHaveBeenCalled();

    await user.click(row("allowed"));
    expect(post).toHaveBeenCalledWith("/notifications/allowed/read");
    expect(push).toHaveBeenCalledExactlyOnceWith("/orders/PO-2050");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("marks all as read", async () => {
    api.list = [note("one"), note("two")];
    post.mockResolvedValue({ updated: 2 });
    const user = userEvent.setup();
    render(<NotificationBell viewer={viewer} />);
    await user.click(await bell("Notifications, 3 unread"));
    await within(panel()).findByRole("list", { name: "Notifications" });
    expect(within(panel()).getAllByText("New")).toHaveLength(2);

    api.unread = 0;
    await user.click(within(panel()).getByRole("button", { name: "Mark all as read" }));
    expect(post).toHaveBeenCalledWith("/notifications/read-all");
    await waitFor(() => expect(within(panel()).queryByText("New")).toBeNull());
    expect(await bell("Notifications")).toBeInTheDocument();
    expect(within(panel()).getByRole("button", { name: "Mark all as read" })).toBeDisabled();
  });
});
