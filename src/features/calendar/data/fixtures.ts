// Screenshot-faithful records from 18_6.a_Month.jpeg, 19_6.b_Week.jpeg and 20_6.c_List.jpeg (D1).
// Read only through ./queries.ts (D2). Several POs show other items on the Orders screens (inventory §9);
// the calendar keeps its own values.

/** late = past due, due-soon = due within 2 days, on-track = later. */
export type DeliveryStatus = "late" | "due-soon" | "on-track";

export type Delivery = {
  po: string;
  supplier: string;
  item: string;
  quantity: number;
  unit: string;
  /** ISO date */
  due: string;
  status: DeliveryStatus;
  /** Label as shown ("4 days late", "Due in 1 day"), stored rather than computed (D1). */
  statusLabel: string;
};

/** The month the Month view shows (October 2026), although MOCK_TODAY is 30 Sep. */
export const calendarMonth = "2026-10-01";

export const deliveries: Delivery[] = [
  { po: "PO-2041", supplier: "Guangzhou Textile Co.", item: "Ladies tops", quantity: 2_000, unit: "pcs", due: "2026-09-26", status: "late", statusLabel: "4 days late" },
  { po: "PO-2038", supplier: "Yiwu Trims Ltd.", item: "Zips and buttons", quantity: 30_000, unit: "sets", due: "2026-09-27", status: "late", statusLabel: "3 days late" },
  { po: "PO-2044", supplier: "Shenzhen Apparel", item: "Men's shirts", quantity: 1_800, unit: "pcs", due: "2026-09-29", status: "late", statusLabel: "1 day late" },
  { po: "PO-2047", supplier: "Guangzhou Textile Co.", item: "Ladies leggings", quantity: 2_000, unit: "pcs", due: "2026-10-01", status: "due-soon", statusLabel: "Due in 1 day" },
  { po: "PO-2053", supplier: "Yiwu Trims Ltd.", item: "Labels and tags", quantity: 15_000, unit: "pcs", due: "2026-10-01", status: "due-soon", statusLabel: "Due in 1 day" },
  { po: "PO-2051", supplier: "Shenzhen Apparel", item: "Winter jackets", quantity: 900, unit: "pcs", due: "2026-10-02", status: "due-soon", statusLabel: "Due in 2 days" },
  { po: "PO-2049", supplier: "Foshan Fabrics", item: "Polyester fabric", quantity: 3_000, unit: "m", due: "2026-10-03", status: "on-track", statusLabel: "On track" },
  { po: "PO-2046", supplier: "Guangzhou Textile Co.", item: "Hoodies", quantity: 1_500, unit: "pcs", due: "2026-10-03", status: "on-track", statusLabel: "On track" },
  { po: "PO-2055", supplier: "Yiwu Trims Ltd.", item: "Packing bags", quantity: 8_000, unit: "pcs", due: "2026-10-05", status: "on-track", statusLabel: "On track" },
  { po: "PO-2056", supplier: "Shenzhen Apparel", item: "Kids shorts", quantity: 2_400, unit: "pcs", due: "2026-10-06", status: "on-track", statusLabel: "On track" },
  { po: "PO-2057", supplier: "Hangzhou Knits", item: "Track pants", quantity: 2_500, unit: "pcs", due: "2026-10-07", status: "on-track", statusLabel: "On track" },
  { po: "PO-2058", supplier: "Foshan Fabrics", item: "Cotton fabric", quantity: 4_000, unit: "m", due: "2026-10-12", status: "on-track", statusLabel: "On track" },
  { po: "PO-2059", supplier: "Shenzhen Apparel", item: "Polo shirts", quantity: 1_800, unit: "pcs", due: "2026-10-15", status: "on-track", statusLabel: "On track" },
  { po: "PO-2060", supplier: "Guangzhou Textile Co.", item: "Ladies kurtis", quantity: 2_200, unit: "pcs", due: "2026-10-20", status: "on-track", statusLabel: "On track" },
  { po: "PO-2061", supplier: "Yiwu Trims Ltd.", item: "Hangers", quantity: 12_000, unit: "pcs", due: "2026-10-20", status: "on-track", statusLabel: "On track" },
  { po: "PO-2050", supplier: "Foshan Fabrics", item: "Denim fabric", quantity: 5_000, unit: "m", due: "2026-10-25", status: "on-track", statusLabel: "On track" },
];
