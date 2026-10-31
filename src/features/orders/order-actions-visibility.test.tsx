import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrderDetailActions } from "@/features/order-detail/shared/order-detail-actions";
import { apiClient } from "@/lib/api/client";
import type { Access, Me } from "@/lib/api/types";

import type { OrderRow } from "./data/queries";
import type { EditableOrder } from "./edit-order-dialog";
import { isEditableStage, orderPermissions } from "./order-permissions";
import { OrdersList } from "./orders-list";

// D1: Management sees Edit and Delete, Procurement Edit only, Accounts neither; no Edit at stage 6 (warehouse).

const nav = vi.hoisted(() => ({ router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }, pathname: "/orders", query: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => nav.router,
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.query),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { delete: vi.fn(), patch: vi.fn() } }));

// The ROL-1 matrix rows that decide (role-card.test.ts has the whole matrix).
const me = (ordersEdit: Access, admin: Access) => ({ permissions: { ordersEdit, admin } as Me["permissions"] });
const ROLES = {
  Management: orderPermissions(me("Full", "Full")),
  Procurement: orderPermissions(me("Enter", "None")),
  Accounts: orderPermissions(me("None", "None")),
};

beforeEach(() => {
  vi.clearAllMocks();
  nav.pathname = "/orders";
  nav.query = "";
});

describe("orderPermissions", () => {
  it("checks the capabilities, never the role", () => {
    expect(ROLES.Management).toEqual({ canEdit: true, canDelete: true });
    expect(ROLES.Procurement).toEqual({ canEdit: true, canDelete: false });
    expect(ROLES.Accounts).toEqual({ canEdit: false, canDelete: false });
    expect(orderPermissions(null)).toEqual({ canEdit: false, canDelete: false });
    expect([1, 2, 5, 6].map(isEditableStage)).toEqual([true, true, true, false]);
  });
});

const row = (po: string, stage: OrderRow["stage"]): OrderRow => ({
  id: po,
  po,
  orderDate: "2026-10-01",
  deliveryDate: "2026-11-15",
  stage,
  supplier: "Foshan Fabrics",
  item: "Denim jeans",
  quantity: 100,
  unit: "pcs",
  received: 0,
  orderValueCny: 1000,
  paidCny: 0,
  paidInr: 0,
  status: "On track",
  tone: "success",
  chip: null,
});

function renderList(permissions: { canEdit: boolean; canDelete: boolean }) {
  render(
    <OrdersList
      orders={[row("PO-2051", 1), row("PO-2040", 6)]}
      counts={{ all: 2, late: 0, dueSoon: 0, shortReceived: 0 }}
      supplierNames={["Foshan Fabrics"]}
      {...permissions}
    />,
  );
}

describe("Orders list actions", () => {
  it("Management: Edit opens the order's edit dialog (none at stage 6), and Delete on every row", () => {
    renderList(ROLES.Management);
    expect(screen.getByRole("link", { name: "Edit PO-2051" })).toHaveAttribute("href", "/orders/PO-2051?edit=1");
    expect(screen.queryByRole("link", { name: "Edit PO-2040" })).toBeNull();
    expect(screen.getByRole("button", { name: "Delete PO-2051" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Delete PO-2040" })).toBeVisible();
  });

  it("Procurement: Edit only", () => {
    renderList(ROLES.Procurement);
    expect(screen.getByRole("link", { name: "Edit PO-2051" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Delete/ })).toBeNull();
  });

  it("Accounts: no actions column at all, as on 05", () => {
    renderList(ROLES.Accounts);
    expect(screen.queryByRole("link", { name: /^Edit/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Delete/ })).toBeNull();
    expect(screen.getAllByRole("columnheader")).toHaveLength(8);
  });

  it("Delete asks without opening the row, and Cancel sends nothing", async () => {
    const user = userEvent.setup();
    renderList(ROLES.Management);
    await user.click(screen.getByRole("button", { name: "Delete PO-2051" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete order?" });
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(nav.router.push).not.toHaveBeenCalled();
    expect(apiClient.delete).not.toHaveBeenCalled();
  });
});

const ORDER: EditableOrder = { po: "PO-2051", stage: 1, orderDate: "2026-10-01", deliveryDate: "2026-11-15", paidCny: 0, lines: [] };

function renderHeader(permissions: { canEdit: boolean; canDelete: boolean }) {
  render(<OrderDetailActions order={ORDER} supplier="Foshan Fabrics" items={[]} {...permissions} />);
}

describe("Order page header", () => {
  it("Management: Delete and Edit order (no Print order, D5); Edit opens the dialog", async () => {
    nav.pathname = "/orders/PO-2051";
    renderHeader(ROLES.Management);
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual(["Delete order", "Edit order"]);
    await userEvent.setup().click(screen.getByRole("button", { name: "Edit order" }));
    expect(await screen.findByRole("dialog", { name: "Edit order" })).toBeVisible();
  });

  it("Procurement: Edit but no Delete", () => {
    renderHeader(ROLES.Procurement);
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual(["Edit order"]);
  });

  it("Accounts, or anyone at stage 6 (the frame passes canEdit false): neither", () => {
    renderHeader(ROLES.Accounts);
    expect(screen.queryAllByRole("button")).toEqual([]);
  });

  it("?edit=1 (the list's Edit) opens the dialog on this order's page only", () => {
    nav.query = "edit=1";
    nav.pathname = "/orders/PO-2052";
    const { unmount } = render(<OrderDetailActions order={ORDER} supplier="Foshan Fabrics" items={[]} canEdit canDelete={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    unmount();
    nav.pathname = "/orders/PO-2051";
    renderHeader(ROLES.Procurement);
    expect(screen.getByRole("dialog", { name: "Edit order" })).toBeVisible();
  });
});
