import { describe, expect, it } from "vitest";

import type { RolesResponse } from "@/lib/api/types";

import { formatLastSignIn, toRoleRows, toUserRow } from "./user-rows";

// 10:00 on 26 Oct 2026, India time.
const now = new Date("2026-10-26T10:00:00+05:30");

describe("formatLastSignIn", () => {
  it("writes today, yesterday and older sign-ins as 47 does", () => {
    expect(formatLastSignIn("2026-10-26T09:12:00+05:30", now)).toBe("Today, 09:12");
    expect(formatLastSignIn("2026-10-25T15:31:00+05:30", now)).toBe("Yesterday, 15:31");
    expect(formatLastSignIn("2026-09-26T14:02:00+05:30", now)).toBe("26 Sep, 14:02");
    expect(formatLastSignIn("2026-10-24T23:59:00+05:30", now)).toBe("24 Oct, 23:59");
  });

  it("uses India time, whatever the timestamp's zone", () => {
    expect(formatLastSignIn("2026-10-25T20:00:00Z", now)).toBe("Today, 01:30");
    expect(formatLastSignIn("2026-10-25T18:29:00Z", now)).toBe("Yesterday, 23:59");
  });

  it("adds the year for another year, and shows – before the first sign-in (5.6)", () => {
    expect(formatLastSignIn("2025-09-26T14:02:00+05:30", now)).toBe("26 Sep 2025, 14:02");
    expect(formatLastSignIn(null, now)).toBe("–");
  });
});

describe("toUserRow", () => {
  it("leaves the office empty for Head office users (U28) and formats the last sign-in", () => {
    const row = { id: "u1", name: "Suresh Menon", email: "suresh@mrgarments.com", role: "Management", office: null, lastSignInAt: null, status: "Active" } as const;
    expect(toUserRow(row, now)).toEqual({
      id: "u1",
      name: "Suresh Menon",
      email: "suresh@mrgarments.com",
      role: "Management",
      office: "",
      lastSignIn: "–",
      status: "Active",
    });
    expect(toUserRow({ ...row, office: "Guangzhou office", lastSignInAt: "2026-10-26T03:42:00Z" }, now)).toMatchObject({
      office: "Guangzhou office",
      lastSignIn: "Today, 09:12",
    });
  });
});

describe("toRoleRows", () => {
  it("turns ROL-1 into the Roles table rows, in capability order", () => {
    const roles: RolesResponse = {
      roles: ["Management", "Procurement", "Accounts", "China staff", "India staff", "Warehouse staff"],
      capabilities: [
        { key: "dashboard", label: "Dashboard" },
        { key: "payments", label: "Deposits and payments" },
      ],
      matrix: {
        dashboard: { Management: "Full", Procurement: "Full", Accounts: "Full", "China staff": "None", "India staff": "None", "Warehouse staff": "None" },
        payments: { Management: "Full", Procurement: "View", Accounts: "Enter", "China staff": "None", "India staff": "None", "Warehouse staff": "None" },
      } as RolesResponse["matrix"],
    };
    const { rows } = toRoleRows(roles);
    expect(rows.map((row) => row.capability)).toEqual(["Dashboard", "Deposits and payments"]);
    expect(rows[1]!.access.Accounts).toBe("Enter");
  });
});
