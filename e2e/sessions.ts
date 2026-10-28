// Saved sign-ins for browser tests (B4), written by e2e/auth.setup.ts. Orchestrator-owned.
// Specs run as Management by default; use `test.use({ storageState: STAFF_STATE })` or `SIGNED_OUT` to change.

/** Suresh Menon, Management (the shell on references 04-53). */
export const MANAGEMENT_STATE = "playwright/.auth/management.json";
/** Chen Yu, China staff granted Receiving only (the staff shell on reference 39). */
export const STAFF_STATE = "playwright/.auth/staff.json";
/** Priya Nair, Procurement: orders Enter; payments, receiving and containers View or less (permission tests). */
export const PROCUREMENT_STATE = "playwright/.auth/procurement.json";
/** Anita Joseph, Accounts: payments Enter, orders View (permission tests). */
export const ACCOUNTS_STATE = "playwright/.auth/accounts.json";
/** Wang Fang, China staff granted Receiving and Containers (stages 2 and 3). */
export const LOADING_STAFF_STATE = "playwright/.auth/loading-staff.json";
/** No session, for the sign-in pages. */
export const SIGNED_OUT = { cookies: [], origins: [] };

export const ACCOUNTS = [
  { email: "suresh@mrgarments.com", state: MANAGEMENT_STATE },
  { email: "chen@mrgarments.com", state: STAFF_STATE },
  { email: "priya@mrgarments.com", state: PROCUREMENT_STATE },
  { email: "anita@mrgarments.com", state: ACCOUNTS_STATE },
  { email: "wang@mrgarments.com", state: LOADING_STAFF_STATE },
];
