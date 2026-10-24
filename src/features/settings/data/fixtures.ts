import type { SupplierDraft } from "../settings-logic";

// Screen-only values (D1, D2). The seven tables come from the shared master data (src/lib/data/master.ts).

/** The Add supplier dialog opens partly filled, as in 53_17.4_Add_supplier_(pop-up).jpeg. */
export const supplierDraft: SupplierDraft = {
  name: "Ningbo Denim Works",
  city: "Ningbo",
  contactPerson: "Mr. Xu Feng",
  phone: "+86 138 5740 9921",
  currency: "CNY",
  address: "",
  notes: "",
};
