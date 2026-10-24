// Screenshot-faithful records from 12_3.1.g_Warehouse.jpeg (D1). Read only through ./queries.ts (D2).

export type TeamShare = { team: string; pieces: number };

export type WarehouseReceipt = {
  pieces: number;
  bundlesLoaded: number;
  bundlesReceived: number;
  /** ISO date */
  receivedOn: string;
  warehouse: string;
  receivedBy: string;
  receivedByTeam: string;
  /** INR landed cost per piece, the same for every team */
  costPerPiece: number;
  teams: TeamShare[];
};

export const warehouseReceipts: Record<string, WarehouseReceipt> = {
  "PO-2028": {
    pieces: 2_500,
    bundlesLoaded: 50,
    bundlesReceived: 50,
    receivedOn: "2026-10-03",
    warehouse: "Main warehouse",
    receivedBy: "Joseph M",
    receivedByTeam: "Warehouse team",
    costPerPiece: 550.8,
    teams: [
      { team: "Retail team", pieces: 1_000 },
      { team: "Wholesale team", pieces: 1_000 },
      { team: "Online team", pieces: 500 },
    ],
  },
};
