// Shared data contracts (orchestrator-owned, D2). Screen-specific view types live in each feature's data/ folder.

/** The six stages every order passes through (login screen, sidebar, orders list). */
export const STAGES = [
  "Order and deposit",
  "Receiving in China",
  "Container loading",
  "Clearing in India",
  "Transport",
  "India warehouse",
] as const;
export type StageNumber = 1 | 2 | 3 | 4 | 5 | 6;

export type Tone = "danger" | "warning" | "success" | "info" | "purple" | "neutral";
export type Terms = "FOB" | "CNF";
export type Currency = "CNY" | "INR";
export type RecordStatus = "Active" | "Inactive";

export type Role = "Management" | "Procurement" | "Accounts" | "China staff" | "India staff" | "Warehouse staff";
export type Access = "Full" | "Enter" | "View" | "None";

export type Supplier = {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  city: string;
  currency: Currency;
  openOrders: number;
  status: RecordStatus;
};

export type ShippingAgent = {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  officeCity: string;
  activeContainers: number;
  status: RecordStatus;
};

export type ClearingAgent = {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  port: string;
  containersCleared: number;
  status: RecordStatus;
};

export type TransportCompany = {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  tripsSoFar: number;
  status: RecordStatus;
};

export type Location = {
  id: string;
  name: string;
  type: "China office" | "India office" | "Warehouse";
  country: "China" | "India";
  address: string;
  staff: string[];
  status: RecordStatus;
};

export type Team = {
  id: string;
  name: string;
  piecesInStock: number;
  /** INR */
  landedCostOfStock: number;
  /** INR per piece */
  averagePerPiece: number;
  status: RecordStatus;
};

export type ItemMaster = {
  id: string;
  name: string;
  countedIn: "Pieces" | "Metres";
  /** Number of pieces, or a unit label such as "Roll". */
  perBundle: number | string;
  usedInOrders: string[];
  status: RecordStatus;
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  office: string;
  /** Display value as shown in the reference, e.g. "Today, 09:12". */
  lastSignIn: string;
  status: RecordStatus;
};

export type RoleMatrixRow = { capability: string; access: Record<Role, Access> };

/** The signed-in user shown in the sidebar footer. Mock only: there is no authentication (scope §1). */
export type CurrentUser = {
  name: string;
  detail: string;
  initials: string;
  variant: "management" | "staff";
};
