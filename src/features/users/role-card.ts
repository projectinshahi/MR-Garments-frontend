import type { RolesResponse } from "@/lib/api/types";
import type { Role } from "@/types/domain";

export type CardAccess = "Full" | "Enter" | "View" | "No";
export type RoleCard = { summary?: string; abilities: { label: string; access: CardAccess }[] };

/** The card drawn on 48: its summary and six rows, two of which merge two matrix rows. */
const CHINA_STAFF_CARD: RoleCard = {
  summary: "China staff can enter receipts and container loading. They cannot see payments, landed cost or reports.",
  abilities: [
    { label: "Dashboard", access: "No" },
    { label: "Orders", access: "No" },
    { label: "Receiving (China)", access: "Enter" },
    { label: "Container loading", access: "Enter" },
    { label: "Payments and cost", access: "No" },
    { label: "Reports", access: "No" },
  ],
};

/**
 * "What this role can do" (B5.1 option 3, B5.2 (i)): China staff get the card drawn on 48; every other role gets all
 * 13 rows of the ROL-1 matrix and no summary. No role chosen yet (Add user): an empty card.
 */
export function buildRoleCard(role: Role | "", { capabilities, matrix }: RolesResponse): RoleCard {
  if (role === "China staff") return CHINA_STAFF_CARD;
  if (!role) return { abilities: [] };
  return {
    abilities: capabilities.map(({ key, label }) => {
      const access = matrix[key][role];
      return { label, access: access === "None" ? "No" : access };
    }),
  };
}
