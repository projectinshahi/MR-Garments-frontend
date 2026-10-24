// Screenshot-faithful fixtures (D1): 30_11.1_Warehouse_list.jpeg and 29_11_Warehouse_-_Stage_6_form.jpeg.
// The 3 Oct 2026 dates come after MOCK_TODAY (30 Sep 2026); they are stored as shown (inventory §9).

export type WarehouseReceipt = {
  id: string;
  receivedOn: string;
  item: string;
  po: string;
  supplier: string;
  container: string;
  received: number;
  retail: number;
  wholesale: number;
  online: number;
  receivedBy: string;
  /** INR per piece, shown to management only. */
  costPerPiece: number;
};

// D1: Track pants is PO-2030 · Hangzhou Knits here; Orders (5) and Landed Cost (31) show PO-2019 · Shenzhen Apparel.
export const warehouseReceipts: WarehouseReceipt[] = [
  { id: "wh-2028", receivedOn: "2026-10-03", item: "Denim jeans", po: "PO-2028", supplier: "Guangzhou Textile Co.", container: "CAIU 2298076", received: 2500, retail: 1000, wholesale: 1000, online: 500, receivedBy: "Joseph M", costPerPiece: 550.8 },
  { id: "wh-2034", receivedOn: "2026-09-29", item: "Men's shorts", po: "PO-2034", supplier: "Shenzhen Apparel", container: "MEDU 4470912", received: 1500, retail: 500, wholesale: 500, online: 500, receivedBy: "Joseph M", costPerPiece: 176.4 },
  { id: "wh-2033", receivedOn: "2026-09-22", item: "Polo shirts", po: "PO-2033", supplier: "Hangzhou Knits", container: "HLXU 9034471", received: 2000, retail: 900, wholesale: 900, online: 200, receivedBy: "Joseph M", costPerPiece: 205 },
  { id: "wh-2032", receivedOn: "2026-09-22", item: "Ladies kurtis", po: "PO-2032", supplier: "Guangzhou Textile Co.", container: "HLXU 9034471", received: 2800, retail: 1400, wholesale: 800, online: 600, receivedBy: "Joseph M", costPerPiece: 318.2 },
  { id: "wh-2029", receivedOn: "2026-09-15", item: "Kids t-shirts", po: "PO-2029", supplier: "Shenzhen Apparel", container: "TCLU 6620148", received: 4000, retail: 1000, wholesale: 1500, online: 1500, receivedBy: "Joseph M", costPerPiece: 142.5 },
  { id: "wh-2030", receivedOn: "2026-09-15", item: "Track pants", po: "PO-2030", supplier: "Hangzhou Knits", container: "TCLU 6620148", received: 3000, retail: 1200, wholesale: 1200, online: 600, receivedBy: "Joseph M", costPerPiece: 236.33 },
];

export type ReceiveGoods = {
  po: string;
  item: string;
  vehicleNumber: string;
  lrNumber: string;
  container: string;
  unloadedOn: string;
  warehouse: string;
  receivedBy: string;
  bundlesLoaded: number;
  bundlesReceived: number;
  /** Pieces received in this delivery. */
  received: number;
  /** Pieces per team, keyed by master team id. */
  split: Record<string, number>;
  /** INR so far. Sea freight is in the supplier price (CNF), so it has no amount. */
  cost: { goods: number; dutyTaxesClearing: number; transport: number };
};

export const receiveGoods: ReceiveGoods = {
  po: "PO-2028",
  item: "Denim jeans",
  vehicleNumber: "KL 07 CD 4821",
  lrNumber: "LR-558214",
  container: "CAIU 2298076",
  unloadedOn: "2026-10-03",
  warehouse: "Main warehouse",
  receivedBy: "Joseph M",
  bundlesLoaded: 50,
  bundlesReceived: 50,
  received: 2500,
  split: { "team-retail": 1000, "team-wholesale": 1000, "team-online": 500 },
  cost: { goods: 980000, dutyTaxesClearing: 370500, transport: 26500 },
};
