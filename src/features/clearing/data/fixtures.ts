import type { Marker } from "@/components/shared/timeline";
import type { Terms } from "@/types/domain";

// Screenshot-faithful fixtures (D1): 26_9.1_Clearing_list.jpeg and 25_9_Clearing_(India)_-_Stage_4_form.jpeg.
// The list shows CAIU 2298076 "Cleared 1 Oct" while the form shows its duty still unpaid. Both are kept (inventory §9).

export type ClearingState = "waiting" | "duty" | "cleared";

export type ClearingRow = {
  container: string;
  agent: string;
  arrivedAtPort: string;
  billOfEntry: string;
  orders: string[];
  state: ClearingState;
  statusLabel: string;
  timeAtPort: string;
  clearingCost: number;
};

export const clearingKpis = {
  inClearingNow: 0,
  clearedLast30Days: 4,
  averageTimeToClear: "3.3 days",
  clearingCostLast30Days: 956060,
};

export const clearings: ClearingRow[] = [
  { container: "CAIU 2298076", agent: "Kochi Clearing Services", arrivedAtPort: "2026-09-28", billOfEntry: "BE-7710482", orders: ["PO-2028"], state: "cleared", statusLabel: "Cleared 1 Oct", timeAtPort: "3 days", clearingCost: 370500 },
  { container: "MEDU 4470912", agent: "Southern Port Agents", arrivedAtPort: "2026-09-25", billOfEntry: "BE-7708834", orders: ["PO-2034"], state: "cleared", statusLabel: "Cleared 27 Sep", timeAtPort: "2 days", clearingCost: 48600 },
  { container: "HLXU 9034471", agent: "Southern Port Agents", arrivedAtPort: "2026-09-16", billOfEntry: "BE-7702190", orders: ["PO-2032", "PO-2033"], state: "cleared", statusLabel: "Cleared 20 Sep", timeAtPort: "4 days", clearingCost: 250960 },
  { container: "TCLU 6620148", agent: "Kochi Clearing Services", arrivedAtPort: "2026-09-09", billOfEntry: "BE-7698021", orders: ["PO-2029", "PO-2030"], state: "cleared", statusLabel: "Cleared 13 Sep", timeAtPort: "4 days", clearingCost: 286000 },
];

export type ClearingForm = {
  container: string;
  arrivedAtPort: string;
  agent: string;
  handedToAgentOn: string;
  contactPerson: string;
  phone: string;
  billOfEntry: string;
  /** null: not yet entered ("Select date"). */
  dutyPaidOn: string | null;
  clearedOn: string | null;
  goodsValue: number;
  /** The duty, taxes and charges that make up the total clearing cost. */
  charges: { id: string; label: string; amount: number }[];
  progress: { title: string; detail?: string; marker: Marker; number?: number }[];
  goods: { po: string; item: string; bundles: number; quantity: number; unit: string }[];
  terms: Terms;
  supplier: string;
};

export const clearingForms: ClearingForm[] = [
  {
    container: "CAIU 2298076",
    arrivedAtPort: "2026-09-28",
    agent: "Kochi Clearing Services",
    handedToAgentOn: "2026-09-29",
    contactPerson: "Mr. Anil Kumar",
    phone: "+91 98470 12345",
    billOfEntry: "BE-7710482",
    dutyPaidOn: null,
    clearedOn: null,
    goodsValue: 980000,
    charges: [
      { id: "customs-duty", label: "Customs duty", amount: 196000 },
      { id: "other-duties", label: "Other duties and taxes", amount: 142000 },
      { id: "agent-charges", label: "Clearing agent charges", amount: 18000 },
      { id: "port-charges", label: "Port and terminal charges", amount: 14500 },
    ],
    progress: [
      { title: "Arrived at port", detail: "28 Sep", marker: "check" },
      { title: "Handed to clearing agent", detail: "29 Sep · Kochi Clearing Services", marker: "check" },
      { title: "Duty calculated", detail: "30 Sep · ₹3,70,500", marker: "check" },
      { title: "Duty paid", detail: "Waiting", marker: "current", number: 4 },
      { title: "Cleared from port", marker: "pending", number: 5 },
      { title: "Handed over to transport", marker: "pending", number: 6 },
    ],
    goods: [{ po: "PO-2028", item: "Denim jeans", bundles: 50, quantity: 2500, unit: "pcs" }],
    terms: "CNF",
    supplier: "Guangzhou Textile Co.",
  },
];
