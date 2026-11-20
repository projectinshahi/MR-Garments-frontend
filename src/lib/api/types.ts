// API contracts shared with the backend (MR-Garments-Backend docs/contracts.md). Coordinator-owned.

import type { Currency, MoneyTotal, RecordStatus, Role } from "@/types/domain";
import type { LedgerAccount, LedgerChange, LedgerOverviewResponse, PaymentRow, SettlementSlice } from "./ledger-types";

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

/** GET /api/v1/currencies: the currency master (backend docs/supplier-currency.md) behind the supplier form's searchable picker. */
export type CurrencyInfo = { code: string; name: string; /** ISO's own name ("UAE Dirham"), searched too. */ isoName: string; symbol: string; minorUnits: number };
export type CurrenciesResponse = { currencies: CurrencyInfo[]; preferred: string[] };

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
 * MD-1 GET /api/v1/suppliers. `ytdValue`: this year's order value, one entry per order currency present; `balance`:
 * the signed ledger balance per currency (+ available with the supplier, − payable), held accounts left out and named
 * in `heldCurrencies`. Never added together; `[]` without orders or postings.
 */
export type SupplierRow = Contact &
  SupplierProfile & {
    /** Orders with stage < 6 (the Settings tab's "Open orders"). */
    openOrders: number;
    /** Orders not closed (phase 2 §1): the Suppliers list's "Active POs", the same rule as its Open POs card. */
    openPos: number;
    ytdValue: MoneyTotal[];
    balance: MoneyTotal[];
    heldCurrencies: string[];
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
  /**
   * The order's container terms (backend docs/order-container-terms.md, 0015): containers loading it take them. Null
   * for an older order not set yet; absent from an older backend.
   */
  terms?: ContainerTerms | null;
  item: string;
  quantity: number;
  unit: Unit;
  received: number;
  /** Quantity on stocked warehouse receipts. */
  stocked: number;
  closed: boolean;
  closedOn: string | null;
  orderValueCny: number;
  /** Paid to shipping agents (sea freight, never posted to the ledger), non-void; null without payments View. */
  agentPaidCny: number | null;
  agentPaidInr: number | null;
  /** settledInr + agentPaidInr; null when settledInr is null (held, unposted, a slice without rate) or without payments View. */
  paidInr: number | null;
} & SettlementFields &
  MilestoneFields;

/**
 * SettlementFields (backend docs/unified-ledger.md): the order's FIFO settlement from its supplier account, read-only.
 * Null figures while the account is held or the order's debit is not posted. `outstandingCny` is never negative.
 */
export type PaymentStatus = "unpaid" | "partly" | "paid";
export type SettlementFields = {
  held: boolean;
  settledCny: number | null;
  outstandingCny: number | null;
  paymentStatus: PaymentStatus | null;
  /** Goods INR: the settling credits at their own rates; null when any has no rate. */
  settledInr: number | null;
};

/** The Deposit Required milestone (D11): met once the FIFO-settled amount reaches what the supplier asked for. Never a balance. */
export type MilestoneStatus = "none" | "unmet" | "partly" | "met";
export type MilestoneFields = {
  depositRequiredCny: number | null;
  depositSettledCny: number | null;
  depositPendingCny: number | null;
  /** Null while held or not posted. */
  depositStatus: MilestoneStatus | null;
};

/**
 * ORD-7 GET /api/v1/order-lines (backend docs/report-downloads.md): every line of every order, ORD-1's order then
 * position. `rateCny` is the rate saved on the line (never the item's price now), `valueCny` quantity x rate.
 */
export type OrderLineItem = {
  orderId: string;
  po: string;
  currency: Currency;
  position: number;
  item: string;
  unit: Unit;
  quantity: number;
  rateCny: number;
  valueCny: number;
  /** Received in China over every receipt, and on stocked warehouse receipts in India. */
  received: number;
  stocked: number;
};


/** ORD-2 GET /api/v1/orders/options */
export type OrderOptions = {
  nextPo: string;
  /** `currency`: the supplier's, which the order is in; `exchangeRate`: the supplier's rate now (null while not set), kept on the order. */
  suppliers: (Named & {
    contactPerson: string;
    phone: string;
    city: string;
    currency: Currency;
    exchangeRate: number | null;
    /** The supplier's current-currency account is held (pending review): no order can be placed for it. */
    held: boolean;
    /** The supplier's signed ledger balances (non-held accounts): + available with the supplier, − payable. */
    /** Null without payments View (money). */
    ledgerBalance: { currency: Currency; balanceCny: number }[] | null;
  })[];
  /** `price`: the item's default rate per unit, offered for the line when the item is chosen; null when none is set. */
  items: (Named & { unit: Unit; price: number | null })[];
  /** Active shipping agents: the other kind of deposit payee. */
  agents: Named[];
};

export type PayeeRole = "supplier" | "agent";

/** ORD-3 POST /api/v1/orders body; answers 201 with CreateOrderResponse. */
export type CreateOrderBody = {
  /** The PO number: the offered `nextPo`, or what the user changed it to (any format, up to 50 characters, trimmed; one another order uses in any letter case is a 422 on `po`). */
  po: string;
  supplierId: string;
  currency: Currency;
  orderDate: string;
  deliveryDate: string;
  lines: { itemId: string; quantity: number; rateCny: number }[];
  /** The deposit the supplier asked for (a milestone, never a payment), 0.01 to 999,999,999,999 with at most 2 decimals; left out, none. */
  depositRequiredCny?: number;
  /** The container terms (0015): FOB or CNF. */
  terms?: ContainerTerms;
  /** Shipping-agent payees only (a supplier payee is 422 `deposits`); left out, none. */
  deposits?: { payee: string; payeeRole: "agent"; amountCny: number; paidOn: string; rateInr?: number; mode: string; reference?: string; notes?: string }[];
};
/** ORD-3: the order and its debit on the supplier's account (balance signed, before and after). */
export type CreateOrderResponse = {
  order: { id: string; po: string };
  /** Null without payments View (money). */
  ledger: { supplierId: string; currency: Currency; debitCny: number; balanceBefore: number; balanceAfter: number } | null;
};

/**
 * ORD-5 PATCH /api/v1/orders/:po (ordersEdit >= Enter; docs/orders-users-contract.md). Any subset, at least one key.
 * Stage 1: dates and lines; stages 2-5: `deliveryDate` only (else 409 `order_locked`); stage 6: nothing. `lines`
 * replaces the whole list in order: a line with `id` updates that line, one without is added, one left out is removed.
 * A line change posts the value change to the supplier's account (the "total below paid" refusal is gone).
 */
export type UpdateOrderBody = {
  /** A new PO number (ORD-5): the same order, renumbered; 422 `po` when another order uses it. */
  po?: string;
  /** New container terms (0015): refused (422 `terms`) once a container holds the order, unless it had none. */
  terms?: ContainerTerms;
  orderDate?: string;
  deliveryDate?: string;
  lines?: { id?: string; itemId: string; quantity: number; rateCny: number }[];
  /** The deposit the supplier asked for; null clears it. Allowed until the warehouse (stage 6), like the delivery date. */
  depositRequiredCny?: number | null;
};
/** `ledger` only when `lines` were sent: the order's value change posted to the supplier's account. */
export type UpdateOrderResponse = {
  order: { id: string; po: string; stage: number; orderDate: string; deliveryDate: string; terms?: ContainerTerms | null };
  /** Sent when lines were; null without payments View (money). */
  ledger?: { supplierId: string; currency: Currency; changeCny: number; balanceBefore: number; balanceAfter: number } | null;
};
// ORD-6 DELETE /api/v1/orders/:po (admin Full; posts the order's cancellation entry first) and USR-5 DELETE /api/v1/users/:id (admin Full) answer 204 with no body;
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

/** PAY-1 GET /api/v1/payments (payments View). Orders newest first; payments latest date first, orderless and voided included. */
export type PaymentsResponse = {
  orders: ({
    orderId: string;
    po: string;
    supplierId: string;
    supplier: string;
    currency: Currency;
    /** The supplier's rate now (INR per 1 of `currency`), a new payment's default; null while not set. */
    supplierRate: number | null;
    orderValueCny: number;
    agentPaidCny: number | null;
    agentPaidInr: number | null;
    /** settledInr + agentPaidInr; null when settledInr is null. */
    paidInr: number | null;
    /** Earliest due payment, or null ("Not yet due"). */
    nextDue: string | null;
  } & SettlementFields &
    MilestoneFields)[];
  payments: PaymentRow[];
  /** As LED-2: every supplier account and the per-currency totals (held left out); absent from a backend before 0017. */
  accounts?: LedgerOverviewResponse["accounts"];
  totals?: LedgerOverviewResponse["totals"];
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
  /**
   * This receipt's lines (none received as 0). Optional: a backend before 2026-11-04 leaves it and `containers` out.
   * `ordered`: the order line's quantity; `received`: that line over every receipt so far (report downloads, 2026-11-12).
   */
  lines?: { item: string; unit: Unit; quantity: number; ordered?: number; received?: number }[];
  /** The receipt's notes (""). Backend docs/report-downloads.md; absent from an older backend. */
  deliveryNote?: string;
  shortRemark?: string;
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
    /** What the supplier is still owed for the order (the ledger's FIFO projection); null without payments View, while held or not posted. */
    outstandingCny: number | null;
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
  /** `part`: some line of that order is not fully loaded in this container. `supplier`: Backend docs/report-downloads.md; absent from an older backend. */
  orders: { po: string; part: boolean; supplier?: string }[];
  /** "" when not given. Backend docs/report-downloads.md; absent from an older backend. */
  portOfLoading?: string;
  portOfArrival?: string;
};

/** CON-2 GET /api/v1/containers/options */
export type ContainerOptions = {
  agents: Named[];
  /** `terms`: the line's order's container terms (0015), which the container loading it takes; null until set, absent from an older backend. */
  lines: { orderLineId: string; orderId: string; po: string; terms?: ContainerTerms | null; item: string; unit: Unit; received: number; loaded: number }[];
};

/** CON-3 POST /api/v1/containers body; answers 201 `{ container: { id } }`. */
export type CreateContainerBody = {
  number: string;
  shippingAgentId: string;
  /** The loaded orders' terms (0015): the API takes them from the orders anyway; sent so an older backend gets them too. */
  terms?: ContainerTerms;
  portOfLoading: string;
  portOfArrival: string;
  loadedOn: string;
  sailedOn: string | null;
  eta: string;
  lines: { orderLineId: string; bundles: number; quantity: number }[];
};

// Five-tab completion (contracts: "Five-tab completion"): order detail, recording a payment, container detail and
// status. No new tables; order stages still change only through REC-3 and CON-3.

/** Deposit and Balance remain on legacy and shipping-agent payments; an orderless supplier payment is "Payment". */
export type PaymentKind = "Deposit" | "Balance";

/**
 * ORD-4 GET /api/v1/orders/:po. The ORD-1 figures for one order, its lines, and its records. A section is null when
 * the signed-in user can't view it (payments, receiving, containers access). Records are oldest first.
 */
export type OrderDetail = Omit<OrderListItem, "supplier"> & {
  supplier: Omit<OrderOptions["suppliers"][number], "currency" | "exchangeRate" | "held" | "ledgerBalance">;
  /** The credits that settled the order, oldest first; null without payments View. */
  slices: SettlementSlice[] | null;
  /** The supplier's account in the order's currency; null without payments View. */
  supplierAccount: LedgerAccount | null;
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
  /** Order-linked payments: legacy supplier rows (a memo: they settle through the account) and agent rows (sea freight); null without payments View. */
  payments: PaymentRow[] | null;
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
 * PAY-2 POST /api/v1/payments, the supplier body (the unified Record payment): no order, no kind. `currency` left out is
 * the supplier's and must be one of its `currencyOptions`; `rateInr` is required for non-INR and left out for INR.
 * `clientRequestId` is generated once per dialog open and reused on retry (the same details answer 200 with the same body).
 */
export type CreateSupplierPaymentBody = {
  supplierId: string;
  amount: number;
  currency?: Currency;
  paidOn: string;
  rateInr?: number;
  mode: string;
  reference?: string;
  notes?: string;
  clientRequestId: string;
};
/** PAY-2, the shipping-agent body (sea freight on an order, never posted to the ledger). */
export type CreateAgentPaymentBody = {
  orderId: string;
  payeeRole: "agent";
  agentId: string;
  kind: PaymentKind;
  amountCny: number;
  paidOn: string;
  rateInr?: number;
  mode: string;
  reference?: string;
  notes?: string;
  clientRequestId: string;
};
export type CreatePaymentBody = CreateSupplierPaymentBody | CreateAgentPaymentBody;
/** PAY-2: `ledger` on a supplier payment (its account's balance before and after); absent on an agent payment. */
export type CreatePaymentResponse = { payment: PaymentRow; ledger?: LedgerChange };
/** PAY-3 DELETE /api/v1/payments/:id with `{ reason }` (payments Full): voids the payment; `ledger` null for an unposted one. */
export type VoidPaymentResponse = { payment: PaymentRow; ledger: LedgerChange | null };

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
