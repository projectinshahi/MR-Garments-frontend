// API contracts shared with the backend (MR-Garments-Backend docs/contracts.md). Coordinator-owned.

import type { Currency, MoneyTotal, RecordStatus, Role } from "@/types/domain";

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

/** A supplier's profile beyond its name and contact (backend docs/suppliers.md, migration 0011). */
export type SupplierProfile = {
  /** Unique, upper-case: SUP-001 when the API assigned it. */
  code: string;
  email: string;
  country: string;
  city: string;
  state: string;
  postalCode: string;
  address: string;
  paymentTerms: string;
  taxNumber: string;
  notes: string;
  currency: Currency;
  /** INR per 1 unit of `currency` (backend docs/supplier-currency.md): what new orders and deposits snapshot; null while never set. */
  exchangeRate: number | null;
};
/**
 * MD-1 GET /api/v1/suppliers. `ytdValue`: this year's order value; `balance`: what is still owed over every order;
 * both one entry per order currency present (never added together), `[]` without orders.
 */
export type SupplierRow = Contact &
  SupplierProfile & {
    /** Orders with stage < 6 (the Settings tab's "Open orders"). */
    openOrders: number;
    /** Orders not closed (phase 2 §1): the Suppliers list's "Active POs", the same rule as its Open POs card. */
    openPos: number;
    ytdValue: MoneyTotal[];
    balance: MoneyTotal[];
    /** When the currency or rate was last set (ISO); null while never set. */
    rateUpdatedAt: string | null;
    /** Any order or supplier deposit: a change of currency or rate then applies to new transactions only. */
    hasTransactions: boolean;
  };
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
/** MD-19 GET /api/v1/items. */
export type ItemRow = {
  id: string;
  name: string;
  /** The name of a unit (GET /api/v1/units). */
  countedIn: string;
  /** Default rate per unit on a new order (0 or more, 2 decimals), in the order's currency; null when none is set. */
  price: number | null;
  usedInOrders: string[];
  status: RecordStatus;
};

// Settings create and edit (backend docs/wave3-contracts.md section 4). POST answers 201 and PATCH 200 with the full
// list row; PATCH needs at least one key, and `status: "Inactive"` is how a record is deactivated (there is no delete).
// Text fields are trimmed; only the name is required on create.
type Editable<T> = Partial<T> & { status?: RecordStatus };
type ContactBody = { name: string; contactPerson?: string; phone?: string };

/**
 * MD-2 POST /api/v1/suppliers. `currency` (CNY when left out) is the one currency of the supplier's new orders and
 * deposits; `exchangeRate` is INR per 1 unit of it (above 0, at most 4 decimals; an INR supplier's is 1, set when left
 * out; another currency's left out is "not set yet"). `code` left out is assigned (SUP-nnn), else kept upper-case
 * (409 `code_exists` under code when another supplier has it).
 */
export type CreateSupplierBody = ContactBody & Partial<Omit<SupplierProfile, "exchangeRate">> & { exchangeRate?: number };
/** PATCH /api/v1/suppliers/:id. A new currency or rate applies to new orders and deposits only; a new currency needs its rate in the same request. */
export type UpdateSupplierBody = Editable<CreateSupplierBody>;
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

/** GET /api/v1/units (Settings, Units). `usedByItems`: the names of the items counted in it. */
export type UnitRow = { id: string; name: string; symbol: string; usedByItems: string[]; status: RecordStatus };
/** POST /api/v1/units. `symbol` (optional) shows after quantities; without one the name does. */
export type CreateUnitBody = { name: string; symbol?: string };
/** PATCH /api/v1/units/:id. A rename reaches every item counted in it. */
export type UpdateUnitBody = Editable<CreateUnitBody>;
export type UnitResponse = { unit: UnitRow };

/** POST /api/v1/items. `price`: the default rate per unit on a new order, 0 or more with at most 2 decimals, or null. */
export type CreateItemBody = { name: string; countedIn: ItemRow["countedIn"]; price: number | null };
/** PATCH /api/v1/items/:id. `countedIn` can't change once the item is on an order (409 `item_in_use`). */
export type UpdateItemBody = Editable<CreateItemBody>;
export type ItemResponse = { item: ItemRow };

/** The one error body every endpoint returns (U36). */
export type ApiErrorBody = { error: { code: string; message: string; fields?: Record<string, string> } };

export type { RecordStatus, Role };

// ---------------------------------------------------------------------------------------------------------------
// Live screens (backend docs/live-screens-contracts.md): Orders, Deposits & Payments, Delivery calendar, Receiving
// in China, Container loading. Dates YYYY-MM-DD; money in the order's `currency` (the ...Cny names are kept: "in the
// order's currency"); rateInr is INR per 1 unit of it (1 for INR orders); quantities are whole numbers.
// ---------------------------------------------------------------------------------------------------------------

/** An item's unit as shown after quantities: its unit's symbol ("pcs", "m", "kg"), or the unit's name when it has none. */
export type Unit = string;
export type OrderStage = 1 | 2 | 3 | 4 | 5 | 6;
type Named = { id: string; name: string };

/**
 * ORD-1 GET /api/v1/orders. Item, quantity, received and stocked are the main line's (position 0). `closed` (backend
 * docs/phase2-contracts.md section 1): stage 6 and every container carrying the order has a stocked warehouse receipt;
 * `closedOn` is the day of the last of those receipts, null while open. Pending orders are stage 1.
 */
export type OrderListItem = {
  id: string;
  po: string;
  orderDate: string;
  deliveryDate: string;
  stage: OrderStage;
  supplier: Named;
  currency: Currency;
  /** INR per 1 of `currency` when the order was placed (migration 0012); null for older orders or a supplier without a rate then. */
  exchangeRate: number | null;
  item: string;
  quantity: number;
  unit: Unit;
  received: number;
  /** Quantity on stocked warehouse receipts. */
  stocked: number;
  closed: boolean;
  closedOn: string | null;
  orderValueCny: number;
  /** Every paid payment, agent (sea freight) ones included. */
  paidCny: number;
  /** Paid payments to the supplier only: balances, payment status and deposit figures read these (phase 2 fixes, 1). */
  supplierPaidCny: number;
  supplierPaidInr: number;
  paidInr: number;
  /** The deposit the supplier asked for (0009), in the order's currency; null when none was agreed. */
  depositRequiredCny: number | null;
  /** Paid supplier deposits (kind Deposit, payee the supplier). */
  depositPaidCny: number;
  /** max(0, required - paid); null without a requirement. */
  depositPendingCny: number | null;
  depositStatus: DepositStatus;
};

/** The order's deposit against what the supplier asked for: none agreed, nothing paid yet, partly paid, or paid in full (more is kept as paid). */
export type DepositStatus = "none" | "due" | "partly" | "paid";

/** ORD-2 GET /api/v1/orders/options */
export type OrderOptions = {
  nextPo: string;
  /** `currency`: the supplier's, which the order is in; `exchangeRate`: the supplier's rate now (null while not set), kept on the order. */
  suppliers: (Named & { contactPerson: string; phone: string; city: string; currency: Currency; exchangeRate: number | null })[];
  /** `price`: the item's default rate per unit, offered for the line when the item is chosen; null when none is set. */
  items: (Named & { unit: Unit; price: number | null })[];
  /** Active shipping agents: the other kind of deposit payee. */
  agents: Named[];
};

export type PayeeRole = "supplier" | "agent";

/** ORD-3 POST /api/v1/orders body; answers 201 `{ order: { id, po } }`. */
export type CreateOrderBody = {
  /** The PO number: the offered `nextPo`, or what the user changed it to (any format, up to 50 characters, trimmed; one another order uses in any letter case is a 422 on `po`). */
  po: string;
  supplierId: string;
  currency: Currency;
  orderDate: string;
  deliveryDate: string;
  lines: { itemId: string; quantity: number; rateCny: number }[];
  /** The deposit the supplier asked for, 0.01 to 999,999,999,999 with at most 2 decimals; left out, none. */
  depositRequiredCny?: number;
  /** `rateInr` is left out for an INR order (the server stores 1). `reference` (transaction number, up to 100) and `notes` (up to 1,000) are optional. */
  deposits: { payee: string; payeeRole: PayeeRole; amountCny: number; paidOn: string; rateInr?: number; mode: string; reference?: string; notes?: string }[];
};
export type CreateOrderResponse = { order: { id: string; po: string } };

/**
 * ORD-5 PATCH /api/v1/orders/:po (ordersEdit >= Enter; docs/orders-users-contract.md). Any subset, at least one key.
 * Stage 1: dates and lines; stages 2-5: `deliveryDate` only (else 409 `order_locked`); stage 6: nothing. `lines`
 * replaces the whole list in order: a line with `id` updates that line, one without is added, one left out is removed.
 */
export type UpdateOrderBody = {
  orderDate?: string;
  deliveryDate?: string;
  lines?: { id?: string; itemId: string; quantity: number; rateCny: number }[];
  /** The deposit the supplier asked for; null clears it. Allowed until the warehouse (stage 6), like the delivery date. */
  depositRequiredCny?: number | null;
};
export type UpdateOrderResponse = { order: { id: string; po: string; stage: number; orderDate: string; deliveryDate: string } };
// ORD-6 DELETE /api/v1/orders/:po (admin Full) and USR-5 DELETE /api/v1/users/:id (admin Full) answer 204 with no body;
// a record that is used answers 409 `in_use` with a message written for the user.

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
    currency: Currency;
    /** The supplier's rate now (INR per 1 of `currency`), a new payment's default; null while not set. */
    supplierRate: number | null;
    orderValueCny: number;
    /** Every paid payment, agents (sea freight) included. */
    paidCny: number;
    paidInr: number;
    /** Paid to the supplier only. */
    supplierPaidCny: number;
    supplierPaidInr: number;
    /** What the supplier is still owed: order value less supplier payments (phase 2 fixes, 1). */
    balanceCny: number;
    depositRequiredCny: number | null;
    depositPaidCny: number;
    depositPendingCny: number | null;
    depositStatus: DepositStatus;
    /** Earliest due payment, or null ("Not yet due"). */
    nextDue: string | null;
  }[];
  payments: {
    id: string;
    orderId: string;
    po: string;
    /** The order's. */
    currency: Currency;
    kind: "Deposit" | "Balance";
    payee: string;
    payeeRole: PayeeRole;
    amountCny: number;
    status: "paid" | "due";
    paidOn: string | null;
    dueDate: string | null;
    rateInr: number | null;
    mode: string | null;
    /** Transaction or receipt number and notes; "" when none (migration 0008). */
    reference: string;
    notes: string;
    /** INR at the payment's own rate, rounded in SQL like every total (the same paisa as ORD-4); null while due. */
    amountInr: number | null;
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
  /** This receipt's lines (none received as 0). Optional: a backend before 2026-11-04 leaves it and `containers` out. */
  lines?: { item: string; unit: Unit; quantity: number }[];
  /** Containers holding goods only this receipt covers: REC-4 refuses while there is any. */
  containers?: string[];
};

/** REC-2 GET /api/v1/receipts/options. The money fields are null for users without payments View (China staff). */
export type ReceiptOptions = {
  offices: Named[];
  orders: {
    orderId: string;
    po: string;
    supplier: string;
    /** Always given: it is not an amount. */
    currency: Currency;
    orderValueCny: number | null;
    depositsPaidCny: number | null;
    lines: { orderLineId: string; item: string; unit: Unit; ordered: number; receivedEarlier: number; unitPriceCny: number | null }[];
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
  supplier: Omit<OrderOptions["suppliers"][number], "currency" | "exchangeRate">;
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
  /** In the order's `currency`, with each payment's SQL `amountInr` as PAY-1 gives it. */
  payments: Omit<PaymentsResponse["payments"][number], "orderId" | "po" | "currency">[] | null;
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
        /**
         * Every PO in the container, this one included (CON-6 takes all their goods out with it). Absent from a backend
         * deployed before CON-6, which the page must survive: Vercel goes live before Render does.
         */
        orders?: string[];
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
  /** In the order's currency. */
  amountCny: number;
  paidOn: string;
  /** Left out for an INR order (the server stores 1). */
  rateInr?: number;
  mode: string;
  /** Transaction or receipt number (up to 100) and notes (up to 1,000); optional, stored as "" when left out. */
  reference?: string;
  notes?: string;
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

/** "warehouse-receipt-deleted" (0009): the audit trail of a deleted warehouse receipt, the only way a received order reopens. */
export type NotificationKind = "short-receipt" | "payment-recorded" | "container-loaded" | "container-sailed" | "container-arrived" | "warehouse-receipt-deleted";

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
