import { describe, expect, it } from "vitest";

import type { Me, Notification } from "@/lib/api/types";

import { filterNotifications, isNotificationFilter, kindStyle, notificationFilterOptions, notificationTarget } from "./notification-filter";

const note = (id: string, kind: string, read = false): Notification => ({
  id,
  kind,
  title: id,
  details: [],
  href: null,
  createdAt: "2026-10-29T03:30:00Z",
  read,
});
const items = [
  note("short", "short-receipt"),
  note("paid", "payment-recorded", true),
  note("loaded", "container-loaded"),
  note("sailed", "container-sailed", true),
  note("arrived", "container-arrived"),
  note("future", "duty-calculated"),
];

describe("notification kinds", () => {
  it("map to the reference dot colours: red for a short receipt, blue for payments and containers", () => {
    expect(kindStyle("short-receipt").dot).toBe("bg-chart-5");
    for (const kind of ["payment-recorded", "container-loaded", "container-sailed", "container-arrived"]) {
      expect(kindStyle(kind).dot).toBe("bg-chart-1");
    }
  });

  it("show an unknown kind with a neutral dot, under All only", () => {
    expect(kindStyle("duty-calculated")).toEqual({ dot: "bg-muted-foreground/50" });
    expect(filterNotifications(items, "all").map((n) => n.id)).toContain("future");
  });
});

describe("filter chips", () => {
  it("are labelled as in the reference, with the unread count from the API", () => {
    expect(notificationFilterOptions(4).map((o) => o.label)).toEqual(["All", "Unread (4)", "Late deliveries", "Payments", "Containers"]);
  });

  it("accept only chip values", () => {
    expect(isNotificationFilter("unread")).toBe(true);
    expect(isNotificationFilter("short-receipt")).toBe(false);
  });

  it("filter unread rows and each category, keeping the order", () => {
    const ids = (filter: Parameters<typeof filterNotifications>[1]) => filterNotifications(items, filter).map((n) => n.id);
    expect(ids("all")).toHaveLength(6);
    expect(ids("unread")).toEqual(["short", "loaded", "arrived", "future"]);
    expect(ids("payment")).toEqual(["paid"]);
    expect(ids("container")).toEqual(["loaded", "sailed", "arrived"]);
    expect(ids("late-delivery")).toEqual([]);
  });
});

describe("notificationTarget", () => {
  const accounts = { shell: "management", permissions: { payments: "Enter", ordersView: "View", containers: "None" } } as Pick<Me, "shell" | "permissions">;

  it("opens app paths the viewer may open, query included", () => {
    expect(notificationTarget(accounts, "/orders/PO-2050")).toBe("/orders/PO-2050");
    expect(notificationTarget(accounts, "/payments?po=PO-2050")).toBe("/payments?po=PO-2050");
    expect(notificationTarget(accounts, "/notifications")).toBe("/notifications");
  });

  it("refuses pages the role can't open, other sites, missing links and an unknown viewer", () => {
    expect(notificationTarget(accounts, "/containers/c1")).toBeNull();
    expect(notificationTarget(accounts, "//evil.example/orders")).toBeNull();
    expect(notificationTarget(accounts, "https://evil.example/orders")).toBeNull();
    expect(notificationTarget(accounts, "orders/PO-2050")).toBeNull();
    expect(notificationTarget(accounts, null)).toBeNull();
    expect(notificationTarget(null, "/orders/PO-2050")).toBeNull();
  });
});
