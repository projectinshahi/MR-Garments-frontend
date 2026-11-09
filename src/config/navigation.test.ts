import { describe, expect, it } from "vitest";

import type { Access, Capability, Me } from "@/lib/api/types";

import { canOpen, MANAGEMENT_NAV, navFor } from "./navigation";

// The Closed Orders entry (sidebar, right after the Stages group): it follows the orders permission, not a stage's.

const NONE = Object.fromEntries((["dashboard", "ordersView", "ordersEdit", "payments", "calendar", "receiving", "containers", "clearing", "transport", "warehouse", "landedCost", "reports", "admin"] as Capability[]).map((key) => [key, "None"])) as Record<Capability, Access>;
const me = (permissions: Partial<Record<Capability, Access>>, shell: Me["shell"] = "management"): Pick<Me, "shell" | "permissions" | "stages"> => ({
  shell,
  permissions: { ...NONE, ...permissions },
  stages: [],
});
const titles = (sections: ReturnType<typeof navFor>) => sections.flatMap((section) => section.items.map((item) => item.title));

describe("Closed Orders in the sidebar", () => {
  it("is its own group immediately after the Stages group, after Warehouse, and opens /closed-orders", () => {
    const stages = MANAGEMENT_NAV.findIndex((section) => section.label === "Stages");
    expect(MANAGEMENT_NAV[stages]!.items.at(-1)).toEqual({ title: "Warehouse", href: "/warehouse" });
    expect(MANAGEMENT_NAV[stages + 1]).toEqual({ items: [{ title: "Closed Orders", href: "/closed-orders" }] });
  });

  it("shows for anyone who may view orders, warehouse access or not, and never for roles without it or for staff", () => {
    const accounts = me({ dashboard: "Full", ordersView: "View", payments: "Enter" });
    expect(titles(navFor(accounts))).toEqual(["Dashboard", "Orders", "Deposits & Payments", "Deposits", "Closed Orders"]);
    expect(canOpen(accounts, "/closed-orders")).toBe(true);

    const warehouseOnly = me({ warehouse: "Full" });
    expect(titles(navFor(warehouseOnly))).toEqual(["Warehouse"]);
    expect(canOpen(warehouseOnly, "/closed-orders")).toBe(false);

    // Staff get Home and their stages only (no staff role holds the orders permission).
    const staff = { ...me({ warehouse: "Full" }, "staff"), stages: [6] };
    expect(titles(navFor(staff))).toEqual(["Home", "Warehouse"]);
    expect(canOpen(staff, "/closed-orders")).toBe(false);
  });
});
