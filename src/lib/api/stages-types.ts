// Clearing (CLR-1..3), Transport (TRN-1..3) and Warehouse (WH-1..3): backend docs/wave3-contracts.md section 8.
// Owner: A5. Dates YYYY-MM-DD; money INR with 2 decimals; quantities whole numbers.

import type { Terms } from "@/types/domain";

import type { ContainerState } from "./types";

type Ref = { id: string; name: string };

/** A container line as the stage forms show it, PO then line order. */
export type StageGoodsLine = { orderLineId: string; orderId: string; po: string; item: string; unit: string; bundles: number; quantity: number };

// Clearing

export type ClearingStatus = "in_clearing" | "cleared";

/** CLR-1 row: every arrived container. `status` "waiting" = no clearing saved yet. */
export type ClearingListRow = {
  containerId: string;
  number: string;
  terms: Terms;
  eta: string;
  agent: Ref | null;
  arrivedOn: string | null;
  handedOn: string | null;
  billOfEntry: string;
  dutyPaidOn: string | null;
  clearedOn: string | null;
  orders: string[];
  status: ClearingStatus | "waiting";
  /** The four charges; 0 while waiting. */
  clearingCostInr: number;
};

/** CLR-1 GET /clearings. KPIs count clearings cleared today or in the 29 days before (India). */
export type ClearingList = {
  kpis: { inClearingNow: number; clearedLast30Days: number; averageDaysToClear: number | null; clearingCostLast30DaysInr: number };
  rows: ClearingListRow[];
  agents: Ref[];
};

export type SavedClearing = {
  id: string;
  clearingAgentId: string;
  arrivedOn: string;
  handedOn: string | null;
  billOfEntry: string;
  dutyPaidOn: string | null;
  clearedOn: string | null;
  goodsValueInr: number | null;
  customsDutyInr: number;
  otherDutiesInr: number;
  agentChargesInr: number;
  portChargesInr: number;
  status: ClearingStatus;
};

/** CLR-2 GET /clearings/:containerId. `agents`: active ones plus the saved one. */
export type ClearingForm = {
  container: { id: string; number: string; status: ContainerState; terms: Terms; loadedOn: string | null; eta: string };
  clearing: SavedClearing | null;
  goods: StageGoodsLine[];
  suppliers: string[];
  agents: (Ref & { contactPerson: string; phone: string })[];
};

/** CLR-3 PUT /clearings/:containerId. */
export type SaveClearingBody = Omit<SavedClearing, "id" | "status"> & { complete: boolean };
export type SaveClearingResponse = { clearing: { id: string; status: ClearingStatus } };

// Transport

export type TripStatus = "on_road" | "unloaded";

export type TripListRow = {
  id: string;
  containerId: string;
  container: string;
  vehicleNumber: string;
  lrNumber: string;
  company: Ref;
  orders: string[];
  bundlesLoaded: number;
  loadedOn: string;
  unloadedOn: string | null;
  bundlesReceived: number | null;
  status: TripStatus;
  /** Freight + loading and unloading. */
  costInr: number;
};

/** TRN-1 GET /transports. KPIs count trips unloaded today or in the 29 days before (India). */
export type TransportList = {
  kpis: {
    onTheWay: number;
    deliveredLast30Days: number;
    bundlesDeliveredLast30Days: number;
    shortLast30Days: number;
    transportCostLast30DaysInr: number;
  };
  rows: TripListRow[];
  /** Cleared containers without a trip, oldest clearing first. */
  ready: { containerId: string; container: string; clearedOn: string; clearingAgent: string; orders: string[]; bundles: number }[];
  companies: Ref[];
};

export type SavedTrip = {
  id: string;
  transportCompanyId: string;
  destinationId: string;
  lrNumber: string;
  vehicleNumber: string;
  driverName: string;
  driverPhone: string;
  bundlesLoaded: number;
  loadedOn: string;
  loadedFrom: string;
  loadedBy: string;
  unloadedOn: string | null;
  bundlesReceived: number | null;
  receivedBy: string;
  shortRemark: string;
  freightInr: number;
  handlingInr: number;
  status: TripStatus;
};

/** TRN-2 GET /transports/:containerId. `companies` and `warehouses`: active ones plus the saved ones. */
export type TransportForm = {
  container: { id: string; number: string; status: ContainerState; terms: Terms };
  clearing: { status: ClearingStatus; clearedOn: string | null; agent: Ref } | null;
  trip: SavedTrip | null;
  goods: StageGoodsLine[];
  suppliers: string[];
  companies: Ref[];
  warehouses: Ref[];
};

/** TRN-3 PUT /transports/:containerId. */
export type SaveTripBody = Omit<SavedTrip, "id" | "status"> & { complete: boolean };
export type SaveTripResponse = { trip: { id: string; status: TripStatus } };

// Warehouse

/** WH-1 row: one order on one stocked receipt. `teams`: pieces per team id. */
export type WarehouseListRow = {
  id: string;
  receiptId: string;
  transportId: string;
  receivedOn: string;
  receivedBy: string;
  container: string;
  orderId: string;
  po: string;
  /** The order's main item. */
  item: string;
  supplier: string;
  location: Ref;
  received: number;
  teams: Record<string, number>;
  /** The order's landed cost per piece; null without landedCost >= View or while unknown. */
  costPerPieceInr: number | null;
};

/** WH-1 GET /warehouse-receipts. `teams`: the active teams (the split columns). */
export type WarehouseList = {
  rows: WarehouseListRow[];
  /** Unloaded trips without a stocked receipt, oldest unloading first. */
  ready: {
    transportId: string;
    containerId: string;
    container: string;
    vehicleNumber: string;
    lrNumber: string;
    unloadedOn: string;
    bundlesReceived: number;
    destination: string;
    receiptStatus: "draft" | null;
    orders: string[];
  }[];
  teams: Ref[];
  warehouses: Ref[];
};

export type ReceiptSplitLine = { orderLineId: string; teamId: string; quantity: number };

/** WH-2 GET /warehouse-receipts/:transportId. `cost` is null without landedCost >= View. */
export type ReceiveGoodsForm = {
  trip: {
    id: string;
    containerId: string;
    container: string;
    terms: Terms;
    vehicleNumber: string;
    lrNumber: string;
    bundlesLoaded: number;
    bundlesReceived: number | null;
    unloadedOn: string | null;
    destinationId: string;
    status: TripStatus;
  };
  receipt: {
    id: string;
    locationId: string;
    receivedOn: string;
    receivedBy: string;
    bundlesReceived: number;
    status: "draft" | "stocked";
    lines: ReceiptSplitLine[];
  } | null;
  lines: Omit<StageGoodsLine, "bundles">[];
  teams: Ref[];
  warehouses: Ref[];
  /** The landed cost so far of the orders in this container, added up. */
  cost: {
    goodsInr: number;
    seaFreightInr: number;
    clearingInr: number | null;
    transportInr: number | null;
    totalInr: number;
    /** Every line of those orders: the cost per piece so far is totalInr / orderedPieces. */
    orderedPieces: number;
    final: boolean;
  } | null;
};

/** WH-3 PUT /warehouse-receipts/:transportId. */
export type SaveReceiptBody = { locationId: string; receivedOn: string; receivedBy: string; bundlesReceived: number; lines: ReceiptSplitLine[]; complete: boolean };
export type SaveReceiptResponse = { receipt: { id: string; status: "draft" | "stocked" } };
