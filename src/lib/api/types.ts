// API contracts shared with the backend (MR-Garments-Backend docs/contracts.md). Coordinator-owned.

import type { RecordStatus, Role } from "@/types/domain";

export type Access = "None" | "View" | "Enter" | "Full";

export type Capability =
  | "dashboard"
  | "ordersView"
  | "ordersEdit"
  | "payments"
  | "calendar"
  | "receiving"
  | "containers"
  | "clearing"
  | "transport"
  | "warehouse"
  | "landedCost"
  | "reports"
  | "admin";

export type OfficeType = "China office" | "India office" | "Warehouse";

/** ME-1 GET /api/v1/me */
export type Me = {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: Role;
  office: { id: string; name: string; type: OfficeType } | null;
  /** "Full access", "Procurement", "Accounts" or "Entry only" (B2). */
  accessLabel: string;
  shell: "management" | "staff";
  /** Where this user lands after signing in or opening a blocked page (B3). */
  landing: string;
  stages: number[];
  permissions: Record<Capability, Access>;
};

/** ROL-1 GET /api/v1/roles */
export type RolesResponse = {
  roles: Role[];
  capabilities: { key: Capability; label: string }[];
  matrix: Record<Capability, Record<Role, Access>>;
};

// Master-data lists (backend docs/contracts.md, "Endpoint formats fixed in Phase 0"). Arrays in creation order.
type Contact = { id: string; name: string; contactPerson: string; phone: string; status: RecordStatus };

/** MD-1 GET /api/v1/suppliers */
export type SupplierRow = Contact & { city: string; address: string; notes: string; currency: "CNY"; openOrders: number };
/** MD-4 GET /api/v1/shipping-agents */
export type ShippingAgentRow = Contact & { officeCity: string; activeContainers: number };
/** MD-7 GET /api/v1/clearing-agents */
export type ClearingAgentRow = Contact & { port: string; containersCleared: number };
/** MD-10 GET /api/v1/transport-companies */
export type TransportCompanyRow = Contact & { tripsSoFar: number };
/** MD-13 GET /api/v1/locations. `staff`: names of the active users there (B6). */
export type LocationRow = {
  id: string;
  name: string;
  type: OfficeType;
  country: "China" | "India";
  address: string;
  staff: string[];
  status: RecordStatus;
};
/** MD-16 GET /api/v1/teams. `averagePerPieceInr` is null until stock exists (shown as "–", 5.6). */
export type TeamRow = {
  id: string;
  name: string;
  piecesInStock: number;
  landedCostOfStockInr: number;
  averagePerPieceInr: number | null;
  status: RecordStatus;
};
/** MD-19 GET /api/v1/items. Exactly one of `perBundle` and `bundleLabel` is set. */
export type ItemRow = {
  id: string;
  name: string;
  countedIn: "Pieces" | "Metres";
  perBundle: number | null;
  bundleLabel: string | null;
  usedInOrders: string[];
  status: RecordStatus;
};

/** The one error body every endpoint returns (U36). */
export type ApiErrorBody = { error: { code: string; message: string; fields?: Record<string, string> } };

export type { RecordStatus, Role };
