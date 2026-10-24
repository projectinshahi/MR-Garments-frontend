import {
  listClearingAgents,
  listItems,
  listLocations,
  listShippingAgents,
  listSuppliers,
  listTeams,
  listTransportCompanies,
} from "@/lib/data/master";

import { supplierDraft } from "./fixtures";

export async function getSuppliersSettings() {
  return { suppliers: await listSuppliers(), draft: structuredClone(supplierDraft) };
}

export const getShippingAgents = listShippingAgents;
export const getClearingAgents = listClearingAgents;
export const getTransportCompanies = listTransportCompanies;
export const getLocations = listLocations;
export const getTeams = listTeams;
export const getItems = listItems;
