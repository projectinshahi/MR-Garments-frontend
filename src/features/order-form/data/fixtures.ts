// Screenshot-faithful fixtures (D1): 15_4_New_order.jpeg, the Stage 1 form prefilled for PO-2050.
// The contact, phone and city are the form's own values (not the supplier master's Mr. Chen Hao).

export type OrderLine = { item: string; rate: number; quantity: number; unit: string };

export type Deposit = {
  payee: string;
  /** Shown in brackets after the payee: "Foshan Fabrics (supplier)". */
  payeeRole: string;
  /** CNY */
  amount: number;
  paidOn: string;
  /** CNY to INR */
  rate: number;
  mode: string;
};

export type NewOrderDraft = {
  po: string;
  orderDate: string;
  deliveryDate: string;
  supplier: string;
  currency: string;
  contactPerson: string;
  phone: string;
  city: string;
  lines: OrderLine[];
  deposits: Deposit[];
};

export const newOrder: NewOrderDraft = {
  po: "PO-2050",
  orderDate: "2026-09-30",
  deliveryDate: "2026-10-25",
  supplier: "Foshan Fabrics",
  // The currency select lists CNY only (Q8).
  currency: "CNY (¥)",
  contactPerson: "Mr. Li Wei",
  phone: "+86 757 8812 0345",
  city: "Foshan, China",
  lines: [
    { item: "Cotton denim fabric", rate: 18.5, quantity: 2400, unit: "m" },
    { item: "Denim lining", rate: 6.2, quantity: 2400, unit: "m" },
    { item: "Metal buttons", rate: 0.35, quantity: 10000, unit: "pcs" },
  ],
  deposits: [
    { payee: "Foshan Fabrics", payeeRole: "supplier", amount: 20000, paidOn: "2026-09-30", rate: 11.6, mode: "Bank transfer" },
    { payee: "Sino Freight", payeeRole: "agent", amount: 1500, paidOn: "2026-09-30", rate: 11.6, mode: "Bank transfer" },
  ],
};
