import type { CurrencyInfo } from "@/lib/api/types";

import type { SupplierDraft } from "../settings-logic";

// Screen-only values (D1, D2). The seven tables come from the API (data/queries.ts).

/**
 * The Add supplier dialog opens empty (currency yuan) by user decision (2026-10-26), unlike
 * 53_17.4_Add_supplier_(pop-up).jpeg, which draws it partly filled with Ningbo Denim Works.
 */
/** A slice of the currency master (GET /currencies) for tests: the three the app started with and a few more. */
export const currencyFixture: CurrencyInfo[] = [
  { code: "CNY", name: "Chinese Yuan", isoName: "Yuan Renminbi", symbol: "¥", minorUnits: 2 },
  { code: "USD", name: "US Dollar", isoName: "US Dollar", symbol: "$", minorUnits: 2 },
  { code: "INR", name: "Indian Rupee", isoName: "Indian Rupee", symbol: "₹", minorUnits: 2 },
  { code: "AED", name: "United Arab Emirates Dirham", isoName: "UAE Dirham", symbol: "AED", minorUnits: 2 },
  { code: "EUR", name: "Euro", isoName: "Euro", symbol: "€", minorUnits: 2 },
  { code: "GBP", name: "British Pound", isoName: "Pound Sterling", symbol: "£", minorUnits: 2 },
  { code: "JPY", name: "Japanese Yen", isoName: "Yen", symbol: "JPY", minorUnits: 0 },
];

export const supplierDraft: SupplierDraft = {
  code: "",
  name: "",
  country: "",
  city: "",
  state: "",
  postalCode: "",
  contactPerson: "",
  email: "",
  phone: "",
  currency: "CNY",
  exchangeRate: "",
  address: "",
  paymentTerms: "",
  taxNumber: "",
  notes: "",
};
