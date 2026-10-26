import type { SupplierDraft } from "../settings-logic";

// Screen-only values (D1, D2). The seven tables come from the API (data/queries.ts).

/**
 * The Add supplier dialog opens empty (currency yuan) by user decision (2026-10-26), unlike
 * 53_17.4_Add_supplier_(pop-up).jpeg, which draws it partly filled with Ningbo Denim Works.
 */
export const supplierDraft: SupplierDraft = {
  name: "",
  city: "",
  contactPerson: "",
  phone: "",
  currency: "CNY",
  address: "",
  notes: "",
};
