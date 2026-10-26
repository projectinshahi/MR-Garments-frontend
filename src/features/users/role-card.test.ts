import { describe, expect, it } from "vitest";

import type { Access, Capability, RolesResponse } from "@/lib/api/types";
import type { Role } from "@/types/domain";

import { buildRoleCard } from "./role-card";

// ROL-1 as the API returns it (the matrix on 49).
const ROLES: Role[] = ["Management", "Procurement", "Accounts", "China staff", "India staff", "Warehouse staff"];
const ROWS: [Capability, string, Access[]][] = [
  ["dashboard", "Dashboard", ["Full", "Full", "Full", "None", "None", "None"]],
  ["ordersView", "Orders: view", ["Full", "Full", "View", "None", "None", "None"]],
  ["ordersEdit", "Orders: create and edit", ["Full", "Enter", "None", "None", "None", "None"]],
  ["payments", "Deposits and payments", ["Full", "View", "Enter", "None", "None", "None"]],
  ["calendar", "Delivery calendar", ["Full", "Full", "None", "None", "None", "None"]],
  ["receiving", "Receiving (China)", ["Full", "View", "None", "Enter", "None", "None"]],
  ["containers", "Container loading", ["Full", "None", "None", "Enter", "None", "None"]],
  ["clearing", "Clearing (India)", ["Full", "None", "None", "None", "Enter", "None"]],
  ["transport", "Transport", ["Full", "None", "None", "None", "Enter", "None"]],
  ["warehouse", "Warehouse", ["Full", "None", "None", "None", "None", "Enter"]],
  ["landedCost", "Landed cost", ["Full", "None", "None", "None", "None", "None"]],
  ["reports", "Reports", ["Full", "None", "None", "None", "None", "None"]],
  ["admin", "Settings and users", ["Full", "None", "None", "None", "None", "None"]],
];
const rol1: RolesResponse = {
  roles: ROLES,
  capabilities: ROWS.map(([key, label]) => ({ key, label })),
  matrix: Object.fromEntries(ROWS.map(([key, , access]) => [key, Object.fromEntries(ROLES.map((role, i) => [role, access[i]]))])) as RolesResponse["matrix"],
};

const rows = (role: Role) => buildRoleCard(role, rol1).abilities.map(({ label, access }) => `${label}: ${access}`);

describe("buildRoleCard (B5)", () => {
  it("gives China staff the card drawn on 48: the summary and six rows", () => {
    const card = buildRoleCard("China staff", rol1);
    expect(card.summary).toBe("China staff can enter receipts and container loading. They cannot see payments, landed cost or reports.");
    expect(rows("China staff")).toEqual([
      "Dashboard: No",
      "Orders: No",
      "Receiving (China): Enter",
      "Container loading: Enter",
      "Payments and cost: No",
      "Reports: No",
    ]);
  });

  it("gives every other role all 13 matrix rows and no summary", () => {
    for (const role of ROLES.filter((r) => r !== "China staff")) {
      const card = buildRoleCard(role, rol1);
      expect(card.summary, role).toBeUndefined();
      expect(card.abilities.map((a) => a.label), role).toEqual(ROWS.map(([, label]) => label));
    }
    expect(rows("Management").every((row) => row.endsWith(": Full"))).toBe(true);
    expect(rows("Procurement")).toEqual([
      "Dashboard: Full",
      "Orders: view: Full",
      "Orders: create and edit: Enter",
      "Deposits and payments: View",
      "Delivery calendar: Full",
      "Receiving (China): View",
      "Container loading: No",
      "Clearing (India): No",
      "Transport: No",
      "Warehouse: No",
      "Landed cost: No",
      "Reports: No",
      "Settings and users: No",
    ]);
    expect(rows("Accounts").filter((row) => !row.endsWith(": No"))).toEqual(["Dashboard: Full", "Orders: view: View", "Deposits and payments: Enter"]);
    expect(rows("India staff").filter((row) => !row.endsWith(": No"))).toEqual(["Clearing (India): Enter", "Transport: Enter"]);
    expect(rows("Warehouse staff").filter((row) => !row.endsWith(": No"))).toEqual(["Warehouse: Enter"]);
  });

  it("is empty until a role is chosen (Add user)", () => {
    expect(buildRoleCard("", rol1)).toEqual({ abilities: [] });
  });
});
