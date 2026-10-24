// Users screen fixtures (D1, D2): only the values the shared master does not hold. Users, roles, offices and the role
// matrix come from the master accessors. Imported only by ./queries.ts.

/** The one user whose edit form is designed (48_16.2_Add_or_edit_user.jpeg: Wang Fang, China staff). */
export const EDIT_USER_ID = "usr-wang";

export type StageOption = { id: string; label: string; checked: boolean };
export type RoleAbility = { label: string; access: "No" | "Enter" };

/** Edit form values shown in 48 that the master user record does not hold. */
export const editUserDetails = {
  phone: "+86 138 2210 7745",
  language: "English",
  languages: ["English"],
  passwordPlaceholder: "Set by user at first sign-in",
};

/** "Stages this person can enter data for" (48). Labels as written on that card. */
export const editUserStages: StageOption[] = [
  { id: "receiving", label: "Receiving (China)", checked: true },
  { id: "containers", label: "Container loading", checked: true },
  { id: "clearing", label: "Clearing (India)", checked: false },
  { id: "transport", label: "Transport", checked: false },
  { id: "warehouse", label: "Warehouse", checked: false },
];

/** "What this role can do" card for China staff (48). No other role's card is designed. */
export const chinaStaffRoleCard = {
  summary: "China staff can enter receipts and container loading. They cannot see payments, landed cost or reports.",
  abilities: [
    { label: "Dashboard", access: "No" },
    { label: "Orders", access: "No" },
    { label: "Receiving (China)", access: "Enter" },
    { label: "Container loading", access: "Enter" },
    { label: "Payments and cost", access: "No" },
    { label: "Reports", access: "No" },
  ] satisfies RoleAbility[],
};
