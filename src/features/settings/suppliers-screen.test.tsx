import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SupplierRow } from "@/lib/api/types";

import { supplierDraft } from "./data/fixtures";
import { SuppliersScreen } from "./suppliers-screen";

vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/suppliers",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const row: SupplierRow = {
  id: "s-1",
  name: "ABC Textiles",
  contactPerson: "Ms. Test",
  phone: "+86 20 0000 0001",
  city: "Guangzhou",
  address: "",
  notes: "",
  currency: "CNY",
  openOrders: 0,
  openPos: 0,
  code: "SUP-001",
  email: "",
  country: "China",
  state: "",
  postalCode: "",
  paymentTerms: "",
  taxNumber: "",
  ytdValue: [],
  balance: [],
  exchangeRate: null,
  rateUpdatedAt: null,
  hasTransactions: false,
  status: "Active",
};

describe("Settings > Suppliers row actions", () => {
  it("adds a Deposits link to the supplier's statement in the actions cell, before the unchanged Edit and Delete", () => {
    render(<SuppliersScreen suppliers={[row]} draft={structuredClone(supplierDraft)} />);
    const line = screen.getByRole("row", { name: /ABC Textiles/ });
    const cells = within(line).getAllByRole("cell");
    expect(cells.at(-1)).toHaveTextContent(/^DepositsEditDelete$/);
    expect(cells.at(-2)).toHaveTextContent("Active");
    expect(within(line).getByRole("link", { name: "Deposits of ABC Textiles" })).toHaveAttribute("href", "/deposits/suppliers/s-1");
    expect(within(line).getByRole("link", { name: "Edit ABC Textiles" })).toHaveAttribute("href", "/settings/suppliers?dialog=edit&id=s-1");
    expect(within(line).getByRole("button", { name: /^Delete/ })).toBeInTheDocument();
  });
});
