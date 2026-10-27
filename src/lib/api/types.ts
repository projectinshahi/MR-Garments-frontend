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

// ---------------------------------------------------------------------------------------------------------------
// Live screens (backend docs/live-screens-contracts.md): Orders, Deposits & Payments, Delivery calendar, Receiving
// in China, Container loading. Dates YYYY-MM-DD; money CNY; rateInr is INR per CNY; quantities are whole numbers.
// ---------------------------------------------------------------------------------------------------------------

export type Unit = "m" | "pcs";
export type OrderStage = 1 | 2 | 3 | 4 | 5 | 6;
type Named = { id: string; name: string };

/** ORD-1 GET /api/v1/orders. Item, quantity and received are the main line's (position 0). */
export type OrderListItem = {
  id: string;
  po: string;
  orderDate: string;
  deliveryDate: string;
  stage: OrderStage;
  supplier: Named;
  item: string;
  quantity: number;
  unit: Unit;
  received: number;
  orderValueCny: number;
  paidCny: number;
  paidInr: number;
};

/** ORD-2 GET /api/v1/orders/options */
export type OrderOptions = {
  nextPo: string;
  suppliers: (Named & { contactPerson: string; phone: string; city: string })[];
  items: (Named & { unit: Unit })[];
  /** Active shipping agents: the other kind of deposit payee. */
  agents: Named[];
};

export type PayeeRole = "supplier" | "agent";

/** ORD-3 POST /api/v1/orders body; answers 201 `{ order: { id, po } }`. */
export type CreateOrderBody = {
  supplierId: string;
  orderDate: string;
  deliveryDate: string;
  lines: { itemId: string; quantity: number; rateCny: number }[];
  deposits: { payee: string; payeeRole: PayeeRole; amountCny: number; paidOn: string; rateInr: number; mode: string }[];
};
export type CreateOrderResponse = { order: { id: string; po: string } };

/** CAL-1 GET /api/v1/deliveries: orders at stage 1-2, due date oldest first. */
export type DeliveryItem = {
  orderId: string;
  po: string;
  supplier: string;
  item: string;
  quantity: number;
  unit: Unit;
  received: number;
  due: string;
};

/** PAY-1 GET /api/v1/payments */
export type PaymentsResponse = {
  orders: {
    orderId: string;
    po: string;
    supplier: string;
    orderValueCny: number;
    paidCny: number;
    paidInr: number;
    balanceCny: number;
    /** Earliest due payment, or null ("Not yet due"). */
    nextDue: string | null;
  }[];
  payments: {
    id: string;
    orderId: string;
    po: string;
    kind: "Deposit" | "Balance";
    payee: string;
    payeeRole: PayeeRole;
    amountCny: number;
    status: "paid" | "due";
    paidOn: string | null;
    dueDate: string | null;
    rateInr: number | null;
    mode: string | null;
  }[];
};

/** REC-1 GET /api/v1/receipts, received date newest first. Main-line figures. */
export type ReceiptListItem = {
  id: string;
  receivedOn: string;
  orderId: string;
  po: string;
  supplier: string;
  item: string;
  office: string;
  ordered: number;
  unit: Unit;
  thisReceipt: number;
  /** This receipt plus every earlier one. */
  totalSoFar: number;
  bundles: number;
  receivedBy: string;
};

/** REC-2 GET /api/v1/receipts/options */
export type ReceiptOptions = {
  offices: Named[];
  orders: {
    orderId: string;
    po: string;
    supplier: string;
    orderValueCny: number;
    depositsPaidCny: number;
    lines: { orderLineId: string; item: string; unit: Unit; ordered: number; receivedEarlier: number; unitPriceCny: number }[];
  }[];
};

/** REC-3 POST /api/v1/receipts body; answers 201 `{ receipt: { id } }`. */
export type CreateReceiptBody = {
  orderId: string;
  receivedOn: string;
  locationId: string;
  bundles: number;
  deliveryNote: string;
  shortRemark: string;
  lines: { orderLineId: string; quantity: number }[];
};

export type ContainerTerms = "FOB" | "CNF";
export type ContainerState = "loading" | "sea" | "arrived";

/** CON-1 GET /api/v1/containers, newest first. */
export type ContainerListItem = {
  id: string;
  number: string;
  agent: Named;
  terms: ContainerTerms;
  loadedOn: string | null;
  sailedOn: string | null;
  eta: string;
  etaEstimated: boolean;
  status: ContainerState;
  bundles: number;
  /** `part`: some line of that order is not fully loaded in this container. */
  orders: { po: string; part: boolean }[];
};

/** CON-2 GET /api/v1/containers/options */
export type ContainerOptions = {
  agents: Named[];
  lines: { orderLineId: string; orderId: string; po: string; item: string; unit: Unit; received: number; loaded: number }[];
};

/** CON-3 POST /api/v1/containers body; answers 201 `{ container: { id } }`. */
export type CreateContainerBody = {
  number: string;
  shippingAgentId: string;
  terms: ContainerTerms;
  portOfLoading: string;
  portOfArrival: string;
  loadedOn: string;
  sailedOn: string | null;
  eta: string;
  lines: { orderLineId: string; bundles: number; quantity: number }[];
};
