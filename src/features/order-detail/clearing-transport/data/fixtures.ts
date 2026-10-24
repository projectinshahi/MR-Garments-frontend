// Screenshot-faithful records from 11_3.1.f_Clearing_&_transport.jpeg (D1). Read only through ./queries.ts (D2).

export type CostLine = { label: string; /** INR */ amount: number };

export type ClearingTransport = {
  container: string;
  clearing: {
    agent: string;
    contactPerson: string;
    contactPhone: string;
    billOfEntry: string;
    /** ISO dates */
    arrivedAtPort: string;
    handedToAgent: string;
    dutyPaid: string;
    cleared: string;
    costs: CostLine[];
  };
  transport: {
    company: string;
    lrNumber: string;
    vehicle: string;
    driver: string;
    driverPhone: string;
    loadedAt: string;
    /** ISO date */
    loadedOn: string;
    loadedBy: string;
    /** ISO date */
    unloadedOn: string;
    bundlesUnloaded: number;
    bundlesTotal: number;
    costs: CostLine[];
  };
};

export const clearingTransport: Record<string, ClearingTransport> = {
  "PO-2028": {
    container: "CAIU 2298076",
    clearing: {
      agent: "Kochi Clearing Services",
      contactPerson: "Mr. Anil Kumar",
      contactPhone: "+91 98470 12345",
      billOfEntry: "BE-7710482",
      arrivedAtPort: "2026-09-28",
      handedToAgent: "2026-09-29",
      dutyPaid: "2026-09-30",
      cleared: "2026-10-01",
      costs: [
        { label: "Customs duty", amount: 196_000 },
        { label: "Other duties and taxes", amount: 142_000 },
        { label: "Clearing agent charges", amount: 18_000 },
        { label: "Port and terminal charges", amount: 14_500 },
      ],
    },
    transport: {
      company: "Kerala Roadways",
      lrNumber: "LR-558214",
      vehicle: "KL 07 CD 4821",
      driver: "Suresh P",
      driverPhone: "+91 94470 55123",
      loadedAt: "Kochi port yard",
      loadedOn: "2026-10-01",
      loadedBy: "Ravi K",
      unloadedOn: "2026-10-03",
      bundlesUnloaded: 50,
      bundlesTotal: 50,
      costs: [
        { label: "Freight", amount: 22_000 },
        { label: "Loading and unloading", amount: 4_500 },
      ],
    },
  },
};
