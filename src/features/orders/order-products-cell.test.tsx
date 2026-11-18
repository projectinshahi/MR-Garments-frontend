import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { OrderProduct } from "./order-products";
import { OrderProductsCell, OrderQuantityCell } from "./order-products-cell";

const first = { po: "PO-2051", item: "Denim jeans", quantity: 100, unit: "pcs" };
const FOUR: OrderProduct[] = [
  { item: "Denim jeans", quantity: 100, unit: "pcs" },
  { item: "Cotton fabric", quantity: 300, unit: "m" },
  { item: "Polo shirts", quantity: 50, unit: "pcs" },
  { item: "Silk scarves", quantity: 25, unit: "pcs" },
];

/** The cells inside a clickable row, as the Orders list draws them (a row click opens the order). */
function row(products?: OrderProduct[]) {
  const open = vi.fn();
  render(
    <table>
      <tbody>
        <tr onClick={open}>
          <td>
            <OrderProductsCell order={{ ...first, products }} />
          </td>
          <td data-testid="quantity">
            <OrderQuantityCell order={{ ...first, products }} />
          </td>
        </tr>
      </tbody>
    </table>,
  );
  return { open, user: userEvent.setup() };
}

describe("Orders list products", () => {
  it("shows a one-product order as before: its item and quantity, no count, nothing more", () => {
    row([FOUR[0]!]);
    expect(screen.getByText("Denim jeans")).toBeVisible();
    expect(screen.getByText("· 100 pcs")).toBeVisible();
    expect(screen.getByTestId("quantity")).toHaveTextContent(/^100 pcs$/);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("names the first two products with their own quantities, says how many more, and totals per unit with the count", () => {
    row(FOUR);
    expect(screen.getByText("Denim jeans")).toBeVisible();
    expect(screen.getByText("Cotton fabric")).toBeVisible();
    expect(screen.getByText("· 300 m")).toBeVisible();
    expect(screen.queryByText("Polo shirts")).toBeNull();
    expect(screen.getByRole("button", { name: "+2 more: show all 4 products of PO-2051" })).toHaveTextContent("+2 more");
    expect(screen.getByTestId("quantity")).toHaveTextContent("175 pcs300 m4 products");
  });

  it("opens every product with its quantity on click or tap, without opening the order, and closes on Escape", async () => {
    const { open, user } = row(FOUR);
    await user.click(screen.getByRole("button", { name: /^\+2 more/ }));
    const list = await screen.findByRole("dialog", { name: "Products of PO-2051" });
    expect(within(list).getByText("4 products · 175 pcs · 300 m", { exact: false })).toBeVisible();
    expect(within(list).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Denim jeans100 pcs", "Cotton fabric300 m", "Polo shirts50 pcs", "Silk scarves25 pcs"]);
    await user.click(within(list).getByText("Polo shirts"));
    expect(open).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens on mouse hover and closes on leaving; a click while hovered keeps it open", async () => {
    const { user } = row(FOUR);
    const more = screen.getByRole("button", { name: /^\+2 more/ });
    await user.hover(more);
    expect(await screen.findByRole("dialog", { name: "Products of PO-2051" })).toBeVisible();
    // Opening on hover leaves the focus where it was.
    expect(more).not.toHaveFocus();
    await user.unhover(more);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await user.hover(more);
    await screen.findByRole("dialog", { name: "Products of PO-2051" });
    await user.click(more);
    await user.unhover(more);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(screen.getByRole("dialog", { name: "Products of PO-2051" })).toBeVisible();
  });

  it("ignores touch hover: a tap toggles it", async () => {
    const { user } = row(FOUR);
    const more = screen.getByRole("button", { name: /^\+2 more/ });
    fireEvent.pointerEnter(more, { pointerType: "touch" });
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(more);
    expect(await screen.findByRole("dialog")).toBeVisible();
    await user.click(more);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens from the keyboard", async () => {
    const { user, open } = row(FOUR);
    await user.tab();
    expect(screen.getByRole("button", { name: /^\+2 more/ })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("dialog", { name: "Products of PO-2051" })).toBeVisible();
    expect(open).not.toHaveBeenCalled();
  });

  it("without the order's lines, shows ORD-1's first line", () => {
    row(undefined);
    expect(screen.getByText("Denim jeans")).toBeVisible();
    expect(screen.getByTestId("quantity")).toHaveTextContent(/^100 pcs$/);
  });
});
