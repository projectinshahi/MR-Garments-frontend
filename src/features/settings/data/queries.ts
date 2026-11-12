import { apiGet } from "@/lib/api/server";
import type { ClearingAgentRow, CurrenciesResponse, ItemRow, LocationRow, ShippingAgentRow, SupplierRow, TeamRow, TransportCompanyRow, UnitRow } from "@/lib/api/types";

import { supplierDraft } from "./fixtures";

// The seven Settings lists come from the API (MD-1, MD-4, MD-7, MD-10, MD-13, MD-16, MD-19), unfiltered: search and
// the status chips stay client-side (filterRecords). apiGet reads cookies, so the pages render inside (app)/loading.

/**
 * The currency master for the supplier form's picker (GET /currencies). A failure leaves the list empty instead of
 * failing the page: the picker then says the list could not be loaded and still shows a supplier's saved currency.
 */
export const getCurrencies = () =>
  apiGet<CurrenciesResponse>("/currencies").then(
    (response) => response.currencies,
    () => [],
  );

export async function getSuppliersSettings() {
  const [suppliers, currencies] = await Promise.all([apiGet<SupplierRow[]>("/suppliers"), getCurrencies()]);
  return { suppliers, currencies, draft: structuredClone(supplierDraft) };
}

export const getShippingAgents = () => apiGet<ShippingAgentRow[]>("/shipping-agents");
export const getClearingAgents = () => apiGet<ClearingAgentRow[]>("/clearing-agents");
export const getTransportCompanies = () => apiGet<TransportCompanyRow[]>("/transport-companies");
export const getLocations = () => apiGet<LocationRow[]>("/locations");
export const getTeams = () => apiGet<TeamRow[]>("/teams");
export const getItems = () => apiGet<ItemRow[]>("/items");
export const getUnits = () => apiGet<UnitRow[]>("/units");
