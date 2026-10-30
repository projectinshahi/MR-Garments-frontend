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

// Settings create and edit (backend docs/wave3-contracts.md section 4). POST answers 201 and PATCH 200 with the full
// list row; PATCH needs at least one key, and `status: "Inactive"` is how a record is deactivated (there is no delete).
// Text fields are trimmed; only the name is required on create.
type Editable<T> = Partial<T> & { status?: RecordStatus };
type ContactBody = { name: string; contactPerson?: string; phone?: string };

/** MD-2 POST /api/v1/suppliers. The currency is always CNY. */
export type CreateSupplierBody = ContactBody & { city?: string; address?: string; notes?: string; currency?: "CNY" };
/** PATCH /api/v1/suppliers/:id */
export type UpdateSupplierBody = Editable<Omit<CreateSupplierBody, "currency">>;
export type SupplierResponse = { supplier: SupplierRow };

/** POST /api/v1/shipping-agents */
export type CreateShippingAgentBody = ContactBody & { officeCity?: string };
/** PATCH /api/v1/shipping-agents/:id */
export type UpdateShippingAgentBody = Editable<CreateShippingAgentBody>;
export type ShippingAgentResponse = { shippingAgent: ShippingAgentRow };

/** POST /api/v1/clearing-agents */
export type CreateClearingAgentBody = ContactBody & { port?: string };
/** PATCH /api/v1/clearing-agents/:id */
export type UpdateClearingAgentBody = Editable<CreateClearingAgentBody>;
export type ClearingAgentResponse = { clearingAgent: ClearingAgentRow };

/** POST /api/v1/transport-companies */
export type CreateTransportCompanyBody = ContactBody;
/** PATCH /api/v1/transport-companies/:id */
export type UpdateTransportCompanyBody = Editable<CreateTransportCompanyBody>;
export type TransportCompanyResponse = { transportCompany: TransportCompanyRow };

/** POST /api/v1/locations. The server sets `country` from the type (China office: China, otherwise India). */
export type CreateLocationBody = { name: string; type: OfficeType; address?: string };
/** PATCH /api/v1/locations/:id. The type can't change after creation. */
export type UpdateLocationBody = Editable<Omit<CreateLocationBody, "type">>;
export type LocationResponse = { location: LocationRow };

/** POST /api/v1/teams */
export type CreateTeamBody = { name: string };
/** PATCH /api/v1/teams/:id */
export type UpdateTeamBody = Editable<CreateTeamBody>;
export type TeamResponse = { team: TeamRow };

/** POST /api/v1/items. Exactly one of `perBundle` (whole number 1-100000) and `bundleLabel` is set, the other null. */
export type CreateItemBody = { name: string; countedIn: ItemRow["countedIn"]; perBundle: number | null; bundleLabel: string | null };
/** PATCH /api/v1/items/:id. `countedIn` can't change once the item is on an order (409 `item_in_use`). */
export type UpdateItemBody = Editable<CreateItemBody>;
export type ItemResponse = { item: ItemRow };

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

/** CAL-1 GET /api/v1/deliveries: orders at stage 1-2, due date oldest first. Item, quantity and received: main line. */
export type DeliveryItem = {
  orderId: string;
  po: string;
  supplier: string;
  item: string;
  quantity: number;
  unit: Unit;
  received: number;
  due: string;
  /** Every line has received >= its quantity. Missing from an API older than this field. */
  fullyReceived?: boolean;
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

// Five-tab completion (contracts: "Five-tab completion"): order detail, recording a payment, container detail and
// status. No new tables; order stages still change only through REC-3 and CON-3.

export type PaymentKind = "Deposit" | "Balance";

/**
 * ORD-4 GET /api/v1/orders/:po. The ORD-1 figures for one order, its lines, and its records. A section is null when
 * the signed-in user can't view it (payments, receiving, containers access). Records are oldest first.
 */
export type OrderDetail = Omit<OrderListItem, "supplier"> & {
  supplier: OrderOptions["suppliers"][number];
  balanceCny: number;
  lines: {
    id: string;
    position: number;
    item: Named;
    unit: Unit;
    quantity: number;
    rateCny: number;
    valueCny: number;
    received: number;
    loaded: number;
  }[];
  payments: Omit<PaymentsResponse["payments"][number], "orderId" | "po">[] | null;
  receipts:
    | {
        id: string;
        receivedOn: string;
        office: string;
        bundles: number;
        deliveryNote: string;
        shortRemark: string;
        receivedBy: string;
        lines: { orderLineId: string; item: string; unit: Unit; quantity: number }[];
      }[]
    | null;
  containers:
    | {
        id: string;
        number: string;
        status: ContainerState;
        terms: ContainerTerms;
        agent: Named;
        loadedOn: string | null;
        sailedOn: string | null;
        eta: string;
        /** Only this order's lines in the container. */
        lines: { orderLineId: string; item: string; unit: Unit; bundles: number; quantity: number }[];
      }[]
    | null;
};

/**
 * PAY-2 POST /api/v1/payments body: a payment already made (saved as status "paid"). The server sets the payee name
 * from the order's supplier or the chosen agent. Answers 201 `{ payment: { id } }`. Records only: nothing moves money.
 */
export type CreatePaymentBody = {
  orderId: string;
  kind: PaymentKind;
  payeeRole: PayeeRole;
  /** An active shipping agent when payeeRole is "agent"; null for the supplier. */
  agentId: string | null;
  amountCny: number;
  paidOn: string;
  rateInr: number;
  mode: string;
};
export type CreatePaymentResponse = { payment: { id: string } };

/** CON-4 GET /api/v1/containers/:id */
export type ContainerDetail = ContainerListItem & {
  portOfLoading: string;
  portOfArrival: string;
  lines: { orderLineId: string; orderId: string; po: string; item: string; unit: Unit; bundles: number; quantity: number }[];
};

/**
 * CON-5 PATCH /api/v1/containers/:id (at least one key). Forward only: loading -> sea (needs a sailing date) ->
 * arrived; the sailing date and ETA can be corrected until the container arrives.
 */
export type UpdateContainerBody = { status?: "sea" | "arrived"; sailedOn?: string; eta?: string };
export type UpdateContainerResponse = { container: { id: string; status: ContainerState; sailedOn: string | null; eta: string } };

// ---------------------------------------------------------------------------------------------------------------
// Notifications (docs/notifications-contract.md, NTF-1 to NTF-4): only ever the caller's own.
// ---------------------------------------------------------------------------------------------------------------

export type NotificationKind = "short-receipt" | "payment-recorded" | "container-loaded" | "container-sailed" | "container-arrived";

export type Notification = {
  id: string;
  /** The backend may add kinds later; the UI shows an unknown one with a neutral style. */
  kind: NotificationKind | (string & {});
  title: string;
  /** Short muted parts, shown joined with " · " (may be empty). */
  details: string[];
  /** An app path the recipient may open, or null. */
  href: string | null;
  /** ISO 8601 timestamp. */
  createdAt: string;
  read: boolean;
};

/** NTF-1 GET /api/v1/notifications?limit&cursor: newest first; `unread` counts all of the caller's unread. */
export type NotificationsPage = { items: Notification[]; nextCursor: string | null; unread: number };
/** NTF-2 GET /api/v1/notifications/unread-count */
export type UnreadCountResponse = { unread: number };
/** NTF-3 POST /api/v1/notifications/:id/read */
export type NotificationResponse = { notification: Notification };
/** NTF-4 POST /api/v1/notifications/read-all */
export type ReadAllResponse = { updated: number };

// ---------------------------------------------------------------------------------------------------------------
// My profile (docs/profile-contract.md, PRF-1 and PRF-2): always the caller's own account, taken from the session.
// No user id in the path, query or body.
// ---------------------------------------------------------------------------------------------------------------

export type Profile = {
  name: string;
  /** Read-only here: the sign-in identity (Management changes it in Users). */
  email: string;
  /** "" when not set. */
  phone: string;
  role: Role;
  office: { id: string; name: string } | null;
  /** One of `options.languages` (today only "English"). */
  language: string;
  /** ISO 8601 timestamp; null when no password was ever set. */
  passwordChangedAt: string | null;
};

/** PRF-1 GET /api/v1/profile */
export type ProfileResponse = { profile: Profile; options: { languages: string[] } };
/** PRF-2 PATCH /api/v1/profile: at least one of these keys and no other (400 otherwise). */
export type UpdateProfileBody = Partial<Pick<Profile, "name" | "phone" | "language">>;
export type UpdateProfileResponse = { profile: Profile };
