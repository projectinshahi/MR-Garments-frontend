import { apiGet } from "@/lib/api/server";
import type {
  ClearingAgentRow,
  ItemRow,
  LocationRow,
  ShippingAgentRow,
  SupplierRow,
  TeamRow,
  TransportCompanyRow,
} from "@/lib/api/types";

import { supplierDraft } from "./fixtures";

// The seven Settings lists come from the API (MD-1, MD-4, MD-7, MD-10, MD-13, MD-16, MD-19), unfiltered: search and
// the status chips stay client-side (filterRecords). apiGet reads cookies, so the pages render inside (app)/loading.

export async function getSuppliersSettings() {
  return { suppliers: await apiGet<SupplierRow[]>("/suppliers"), draft: structuredClone(supplierDraft) };
}

export const getShippingAgents = () => apiGet<ShippingAgentRow[]>("/shipping-agents");
export const getClearingAgents = () => apiGet<ClearingAgentRow[]>("/clearing-agents");
export const getTransportCompanies = () => apiGet<TransportCompanyRow[]>("/transport-companies");
export const getLocations = () => apiGet<LocationRow[]>("/locations");
export const getTeams = () => apiGet<TeamRow[]>("/teams");
export const getItems = () => apiGet<ItemRow[]>("/items");
