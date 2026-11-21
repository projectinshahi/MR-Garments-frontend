import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SupplierBalance } from "./supplier-tables";

// The Suppliers page's Balance cells (pre-release audit M2): the signed ledger balance in words, never a bare sign.
describe("SupplierBalance", () => {
  it("says which way each balance goes, with the amount unsigned; settled, held and none are named", () => {
    const { container, rerender } = render(
      <SupplierBalance
        balance={[
          { currency: "CNY", amount: -1200 },
          { currency: "USD", amount: 300 },
          { currency: "INR", amount: 0 },
        ]}
        heldCurrencies={["CNY"]}
      />,
    );
    expect(screen.getByText("Payable to supplier").parentElement).toHaveTextContent("¥1,200.00Payable to supplier");
    expect(screen.getByText("Available with supplier").parentElement).toHaveTextContent("$300.00Available with supplier");
    expect(screen.getByText("Settled (INR)")).toBeInTheDocument();
    expect(screen.getByText("CNY pending review")).toBeInTheDocument();
    expect(container).not.toHaveTextContent("−");
    rerender(<SupplierBalance balance={[]} heldCurrencies={[]} />);
    expect(container).toHaveTextContent(/^–$/);
  });
});
