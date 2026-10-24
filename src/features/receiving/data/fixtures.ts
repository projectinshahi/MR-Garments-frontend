import type { Marker } from "@/components/shared/timeline";
import type { Tone } from "@/types/domain";

// Screenshot-faithful fixtures (D1): 22_7.1_Receiving_list.jpeg and 21_7_Receiving_(China)_-_Stage_2_form.jpeg.

export type ReceiptState = "partly" | "short" | "complete";

export type ReceiptRow = {
  id: string;
  receivedOn: string;
  po: string;
  supplier: string;
  item: string;
  office: string;
  ordered: number;
  unit: string;
  thisReceipt: number;
  totalSoFar: number;
  /** null: not counted yet ("–"). */
  short: number | null;
  /** Shown after the short quantity when set ("12 m"). */
  shortUnit?: string;
  bundles: number;
  /** Shown after the bundle count when set ("24 rolls"). */
  bundleUnit?: string;
  receivedBy: string;
  state: ReceiptState;
  statusLabel: string;
};

const row = (r: Omit<ReceiptRow, "office" | "unit"> & { unit?: string }): ReceiptRow => ({
  office: "Guangzhou office",
  unit: "pcs",
  ...r,
});

export const receipts: ReceiptRow[] = [
  row({ id: "rcp-2035-2", receivedOn: "2026-09-24", po: "PO-2035", supplier: "Shenzhen Apparel", item: "Men's jackets", ordered: 1200, thisReceipt: 460, totalSoFar: 1160, short: 40, bundles: 9, receivedBy: "Chen Yu", state: "short", statusLabel: "40 pcs short" }),
  row({ id: "rcp-2035-1", receivedOn: "2026-09-18", po: "PO-2035", supplier: "Shenzhen Apparel", item: "Men's jackets", ordered: 1200, thisReceipt: 700, totalSoFar: 700, short: null, bundles: 14, receivedBy: "Wang Fang", state: "partly", statusLabel: "Partly received" }),
  row({ id: "rcp-2027-1", receivedOn: "2026-09-15", po: "PO-2027", supplier: "Foshan Fabrics", item: "Cotton fabric", ordered: 1200, unit: "m", thisReceipt: 1188, totalSoFar: 1188, short: 12, shortUnit: "m", bundles: 24, bundleUnit: "rolls", receivedBy: "Wang Fang", state: "short", statusLabel: "12 m short" }),
  row({ id: "rcp-2034-1", receivedOn: "2026-09-02", po: "PO-2034", supplier: "Shenzhen Apparel", item: "Men's shorts", ordered: 1500, thisReceipt: 1500, totalSoFar: 1500, short: 0, bundles: 30, receivedBy: "Chen Yu", state: "complete", statusLabel: "Complete" }),
  row({ id: "rcp-2028-1", receivedOn: "2026-08-26", po: "PO-2028", supplier: "Guangzhou Textile Co.", item: "Denim jeans", ordered: 2500, thisReceipt: 2500, totalSoFar: 2500, short: 0, bundles: 50, receivedBy: "Wang Fang", state: "complete", statusLabel: "Complete" }),
  row({ id: "rcp-2033-1", receivedOn: "2026-08-24", po: "PO-2033", supplier: "Hangzhou Knits", item: "Polo shirts", ordered: 2000, thisReceipt: 2000, totalSoFar: 2000, short: 0, bundles: 40, receivedBy: "Chen Yu", state: "complete", statusLabel: "Complete" }),
  row({ id: "rcp-2032-1", receivedOn: "2026-08-20", po: "PO-2032", supplier: "Guangzhou Textile Co.", item: "Ladies kurtis", ordered: 2800, thisReceipt: 2800, totalSoFar: 2800, short: 0, bundles: 56, receivedBy: "Wang Fang", state: "complete", statusLabel: "Complete" }),
  row({ id: "rcp-2030-1", receivedOn: "2026-08-16", po: "PO-2030", supplier: "Hangzhou Knits", item: "Track pants", ordered: 3000, thisReceipt: 3000, totalSoFar: 3000, short: 0, bundles: 60, receivedBy: "Chen Yu", state: "complete", statusLabel: "Complete" }),
  row({ id: "rcp-2029-1", receivedOn: "2026-08-14", po: "PO-2029", supplier: "Shenzhen Apparel", item: "Kids t-shirts", ordered: 4000, thisReceipt: 4000, totalSoFar: 4000, short: 0, bundles: 80, receivedBy: "Wang Fang", state: "complete", statusLabel: "Complete" }),
];

// KPI values as shown; they are not derivable from the nine rows (e.g. "from 3 suppliers").
export const receivingKpis = {
  receiptsThisMonth: 4,
  receiptsSupplierCount: 3,
  waitingToBeReceived: 9,
  partlyReceived: 1,
  partlyReceivedPos: ["PO-2035"],
  shortItems: 2,
  shortItemPos: ["PO-2035", "PO-2027"],
};

export type ReceiptLine = {
  item: string;
  unit: string;
  ordered: number;
  receivedEarlier: number;
  receivedNow: number;
  /** CNY per unit; lines with a price reduce the payment when short. */
  unitPrice?: number;
};

export type DeliveryEvent = { title: string; lines: string[]; marker: Marker };

export type RecordReceipt = {
  po: string;
  item: string;
  supplier: string;
  status: { label: string; tone: Tone };
  receivedOn: string;
  office: string;
  receivedBy: string;
  bundles: number;
  deliveryNote: string;
  lines: ReceiptLine[];
  shortRemark: string;
  payment: { orderValue: number; depositsPaid: number };
  deliveries: DeliveryEvent[];
};

export const recordReceipt: RecordReceipt = {
  po: "PO-2035",
  item: "Men's jackets",
  supplier: "Shenzhen Apparel",
  status: { label: "Partly received", tone: "warning" },
  receivedOn: "2026-09-24",
  office: "Guangzhou office",
  receivedBy: "Chen Yu",
  bundles: 9,
  deliveryNote: "DN-88214",
  lines: [
    { item: "Men's jackets", unit: "pcs", ordered: 1200, receivedEarlier: 700, receivedNow: 460, unitPrice: 60 },
    { item: "Care labels", unit: "pcs", ordered: 1200, receivedEarlier: 700, receivedNow: 500 },
  ],
  shortRemark: "40 jackets not delivered. Supplier says the last lot is with the factory. Reduce the payment for these 40 pieces.",
  payment: { orderValue: 72000, depositsPaid: 40000 },
  deliveries: [
    { title: "18 Sep · Guangzhou office", lines: ["700 jackets and 700 labels in 14 bundles", "Received by Wang Fang"], marker: "ring" },
    { title: "24 Sep · Guangzhou office (this receipt)", lines: ["460 jackets and 500 labels in 9 bundles", "Received by Chen Yu"], marker: "dot" },
    { title: "Total so far", lines: ["1,160 of 1,200 jackets · 40 short", "23 bundles"], marker: "ring" },
  ],
};
