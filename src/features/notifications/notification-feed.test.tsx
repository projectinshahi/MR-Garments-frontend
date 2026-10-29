import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Me, Notification } from "@/lib/api/types";

import type { NotificationsData } from "./data/queries";
import { MarkAllReadButton } from "./mark-all-read-button";
import { NotificationFeed } from "./notification-feed";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
const get = vi.fn();
const post = vi.fn();
vi.mock("@/lib/api/client", () => ({ apiClient: { get: (path: string) => get(path), post: (path: string) => post(path) } }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const viewer = { shell: "management", permissions: { payments: "Enter", ordersView: "View", containers: "None" } } as Pick<Me, "shell" | "permissions">;
const note = (id: string, extra: Partial<Notification> = {}): Notification => ({
  id,
  kind: "payment-recorded",
  title: `${id} title`,
  details: [],
  href: null,
  createdAt: "2026-10-29T03:30:00Z",
  read: false,
  ...extra,
});
const data = (extra: Partial<NotificationsData> = {}): NotificationsData => ({
  items: [note("paid", { href: "/payments" }), note("short", { kind: "short-receipt", read: true }), note("sailed", { kind: "container-sailed", href: "/containers/c1" })],
  nextCursor: null,
  unread: 2,
  viewer,
  now: "2026-10-29T10:00:00Z",
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  // The shared count never answers here, so the chip shows the page's own `unread`.
  get.mockImplementation((path: string) => (path === "/notifications/unread-count" ? new Promise(() => {}) : Promise.resolve()));
});

const list = () => screen.getByRole("list", { name: "Notifications" });

describe("NotificationFeed", () => {
  it("shows the rows with their times, the unread count on the chip, and filters by kind", async () => {
    const user = userEvent.setup();
    render(<NotificationFeed data={data()} />);
    expect(within(list()).getAllByRole("listitem")).toHaveLength(3);
    expect(within(list()).getAllByText("New")).toHaveLength(2);
    // India time: 03:30 UTC is 09:00 IST on the same day as `now`.
    expect(within(list()).getAllByText("Today, 09:00 ·")).toHaveLength(2);

    const chips = screen.getByRole("group", { name: "Filter notifications" });
    await user.click(within(chips).getByRole("button", { name: "Containers" }));
    expect(within(list()).getAllByRole("listitem")).toHaveLength(1);
    await user.click(within(chips).getByRole("button", { name: "Unread (2)" }));
    expect(within(list()).getAllByRole("listitem")).toHaveLength(2);
  });

  it("marks a row read on click and opens its page only when the viewer may open it", async () => {
    post.mockImplementation(async (path: string) => ({ notification: note(path.split("/")[2]!, { read: true }) }));
    const user = userEvent.setup();
    render(<NotificationFeed data={data()} />);

    await user.click(within(list()).getByRole("button", { name: /sailed title/ }));
    expect(post).toHaveBeenCalledWith("/notifications/sailed/read");
    expect(push).not.toHaveBeenCalled();

    await user.click(within(list()).getByRole("button", { name: /paid title/ }));
    expect(post).toHaveBeenCalledWith("/notifications/paid/read");
    expect(push).toHaveBeenCalledExactlyOnceWith("/payments");
    await waitFor(() => expect(within(list()).queryByText("New")).toBeNull());
    expect(get).toHaveBeenCalledWith("/notifications/unread-count");
  });

  it("loads the next page with the cursor", async () => {
    get.mockImplementation(async (path: string) =>
      path === "/notifications/unread-count" ? new Promise(() => {}) : { items: [note("older")], nextCursor: null, unread: 2 },
    );
    const user = userEvent.setup();
    render(<NotificationFeed data={data({ nextCursor: "abc+/=" })} />);
    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(get).toHaveBeenCalledWith("/notifications?cursor=abc%2B%2F%3D");
    expect(await within(list()).findByText("older title")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("shows an empty state when there are no notifications", () => {
    render(<NotificationFeed data={data({ items: [], unread: 0 })} />);
    expect(screen.getByText("No notifications yet")).toBeInTheDocument();
  });
});

describe("MarkAllReadButton", () => {
  it("calls NTF-4, then refreshes the page and the count", async () => {
    post.mockResolvedValue({ updated: 2 });
    const user = userEvent.setup();
    render(<MarkAllReadButton />);
    await user.click(screen.getByRole("button", { name: "Mark all as read" }));
    expect(post).toHaveBeenCalledWith("/notifications/read-all");
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(get).toHaveBeenCalledWith("/notifications/unread-count");
  });
});
