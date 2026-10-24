import type { Marker } from "@/components/shared/timeline";

// Screenshot-faithful fixtures (D1): 28_10.1_Transport_list.jpeg and 27_10_Transport_-_Stage_5_form.jpeg.
// Known difference (inventory §9): the list shows CAIU 2298076 unloaded on 3 Oct, the form shows unloading "Waiting".

export type TransportState = "on-the-way" | "delivered";

export type TransportRow = {
  id: string;
  vehicle: string;
  lr: string;
  company: string;
  container: string;
  orders: string[];
  bundlesLoaded: number;
  bundlesReceived: number;
  loadedOn: string;
  unloadedOn: string;
  cost: number;
  state: TransportState;
};

export const transports: TransportRow[] = [
  { id: "trp-4821", vehicle: "KL 07 CD 4821", lr: "LR-558214", company: "Kerala Roadways", container: "CAIU 2298076", orders: ["PO-2028"], bundlesLoaded: 50, bundlesReceived: 50, loadedOn: "2026-10-01", unloadedOn: "2026-10-03", cost: 26500, state: "delivered" },
  { id: "trp-2210", vehicle: "KL 07 CD 2210", lr: "LR-558102", company: "Kerala Roadways", container: "MEDU 4470912", orders: ["PO-2034"], bundlesLoaded: 30, bundlesReceived: 30, loadedOn: "2026-09-27", unloadedOn: "2026-09-29", cost: 14000, state: "delivered" },
  { id: "trp-3308", vehicle: "KL 11 BT 3308", lr: "LR-MC-4471", company: "Malabar Carriers", container: "HLXU 9034471", orders: ["PO-2032", "PO-2033"], bundlesLoaded: 96, bundlesReceived: 96, loadedOn: "2026-09-20", unloadedOn: "2026-09-22", cost: 34000, state: "delivered" },
  { id: "trp-1102", vehicle: "KL 01 AB 1102", lr: "LR-557630", company: "Kerala Roadways", container: "TCLU 6620148", orders: ["PO-2029", "PO-2030"], bundlesLoaded: 140, bundlesReceived: 140, loadedOn: "2026-09-13", unloadedOn: "2026-09-15", cost: 33000, state: "delivered" },
];

export type TransportForm = {
  container: string;
  company: string;
  lr: string;
  bundlesLoaded: number;
  vehicle: string;
  driver: string;
  driverPhone: string;
  loading: { loadedOn: string; loadedFrom: string; loadedBy: string };
  progress: { title: string; detail?: string; marker: Marker; number?: number }[];
  goods: { po: string; item: string; bundles: number; qty: number; unit: string }[];
  deliveringTo: string;
  charges: { label: string; amount: number }[];
};

/** The only designed form: container CAIU 2298076, loaded at the port, unloading still waiting. */
export const transportForms: TransportForm[] = [
  {
    container: "CAIU 2298076",
    company: "Kerala Roadways",
    lr: "LR-558214",
    bundlesLoaded: 50,
    vehicle: "KL 07 CD 4821",
    driver: "Suresh P",
    driverPhone: "+91 94470 55123",
    loading: { loadedOn: "2026-10-01", loadedFrom: "Kochi port yard", loadedBy: "Ravi K" },
    progress: [
      { title: "Cleared, handed to transport", detail: "1 Oct · from Kochi Clearing Services", marker: "check" },
      { title: "Loaded on vehicle", detail: "1 Oct · KL 07 CD 4821", marker: "check" },
      { title: "On the way to warehouse", detail: "LR-558214", marker: "current", number: 3 },
      { title: "Unloaded at our warehouse", marker: "pending", number: 4 },
    ],
    goods: [{ po: "PO-2028", item: "Denim jeans", bundles: 50, qty: 2500, unit: "pcs" }],
    deliveringTo: "MR Garments warehouse",
    charges: [
      { label: "Freight", amount: 22000 },
      { label: "Loading and unloading", amount: 4500 },
    ],
  },
];
