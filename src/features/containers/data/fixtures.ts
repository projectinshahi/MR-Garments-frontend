import type { Terms } from "@/types/domain";

// Screenshot-faithful fixtures (D1): 24_8.1_Containers_list.jpeg and 23_8_Container_loading_-_Stage_3_form.jpeg.
// FCIU 5527310 differs between the two on purpose: the list shows "–" loaded and 23 bundles, the form 27 Sep and 71.

export type ContainerStatus = "loading" | "sea" | "arrived";

export type ContainerRow = {
  number: string;
  agent: string;
  terms: Terms;
  /** As shown: "PO-2037 (part)" marks an order split across containers. */
  orders: string[];
  bundles: number;
  /** null: not yet ("–"). */
  loadedOn: string | null;
  sailedOn: string | null;
  etaIndia: string;
  /** "Est. 24 Oct" */
  etaEstimated?: boolean;
  status: ContainerStatus;
};

export const containers: ContainerRow[] = [
  { number: "FCIU 5527310", agent: "Sino Freight", terms: "FOB", orders: ["PO-2035"], bundles: 23, loadedOn: null, sailedOn: null, etaIndia: "2026-10-24", etaEstimated: true, status: "loading" },
  { number: "MSKU 4471203", agent: "Sino Freight", terms: "FOB", orders: ["PO-2027", "PO-2037 (part)"], bundles: 60, loadedOn: "2026-09-14", sailedOn: "2026-09-16", etaIndia: "2026-10-02", status: "sea" },
  { number: "TGHU 8820156", agent: "Sino Freight", terms: "CNF", orders: ["PO-2037 (part)", "PO-2039"], bundles: 72, loadedOn: "2026-09-16", sailedOn: "2026-09-17", etaIndia: "2026-10-04", status: "sea" },
  { number: "CAIU 3305871", agent: "Dragon Cargo", terms: "FOB", orders: ["PO-2040", "PO-2042"], bundles: 96, loadedOn: "2026-09-22", sailedOn: "2026-09-24", etaIndia: "2026-10-11", status: "sea" },
  { number: "OOLU 6094412", agent: "Dragon Cargo", terms: "CNF", orders: ["PO-2043", "PO-2045"], bundles: 110, loadedOn: "2026-09-29", sailedOn: "2026-10-01", etaIndia: "2026-10-18", status: "sea" },
  // Other screens show PO-2028 as received; here it is still in clearing (inventory §9).
  { number: "CAIU 2298076", agent: "Sino Freight", terms: "CNF", orders: ["PO-2028"], bundles: 50, loadedOn: "2026-09-09", sailedOn: "2026-09-12", etaIndia: "2026-09-28", status: "arrived" },
];

// KPI values as shown.
export const containerKpis = {
  active: 6,
  arrivingThisWeek: ["MSKU 4471203", "TGHU 8820156"],
  loadingNow: ["FCIU 5527310"],
  arrivedInClearing: ["CAIU 2298076"],
};

export const listFootnote = "An order can be split across containers (PO-2037 above), and one container can hold many orders.";

export type LoadLine = { id: string; po: string; item: string; bundles: number; quantity: number; unit: string; terms: Terms };

/** "Where each order is loaded": the line whose quantity is loaded against the order's total. */
export type OrderLoad = { po: string; item: string; lineId: string; ordered: number; note: string };

export type LoadContainer = {
  number: string;
  agent: string;
  terms: Terms;
  loadedOn: string;
  etd: string;
  eta: string;
  portOfLoading: string;
  portOfArrival: string;
  lines: LoadLine[];
  orderLoads: OrderLoad[];
};

export const loadContainer: LoadContainer = {
  number: "FCIU 5527310",
  agent: "Sino Freight",
  terms: "FOB",
  loadedOn: "2026-09-27",
  etd: "2026-10-02",
  eta: "2026-10-24",
  portOfLoading: "Nansha, Guangzhou",
  portOfArrival: "Kochi",
  lines: [
    { id: "2035-jackets", po: "PO-2035", item: "Men's jackets", bundles: 23, quantity: 1160, unit: "pcs", terms: "FOB" },
    { id: "2035-labels", po: "PO-2035", item: "Care labels", bundles: 8, quantity: 1200, unit: "pcs", terms: "FOB" },
    { id: "2031-tshirts", po: "PO-2031", item: "Kids t-shirts", bundles: 40, quantity: 4000, unit: "pcs", terms: "CNF" },
  ],
  orderLoads: [
    { po: "PO-2035", item: "Men's jackets", lineId: "2035-jackets", ordered: 1200, note: "40 still to receive from the supplier" },
    { po: "PO-2031", item: "Kids t-shirts", lineId: "2031-tshirts", ordered: 6000, note: "Rest, 2,000 pcs, goes in the next container" },
  ],
};
