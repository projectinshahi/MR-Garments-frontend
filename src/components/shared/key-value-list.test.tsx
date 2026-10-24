import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KeyValueList } from "@/components/shared/key-value-list";

const items = [
  { label: "Goods", value: "₹10,00,000" },
  { label: "Customs duty", value: "₹2,00,000", muted: true },
];

describe("KeyValueList total row", () => {
  const totalRow = () => screen.getByText("Landed cost").parentElement;

  it("is 16 px under a 2 px navy rule with 12 px above the text by default", () => {
    render(<KeyValueList items={items} total={{ label: "Landed cost", value: "₹12,00,000" }} />);
    expect(totalRow()).toHaveClass("border-t-2", "border-navy", "mt-1", "pt-3", "text-base");
  });

  it("is 15 px on a 20 px line with 7 px above the text when sm", () => {
    render(<KeyValueList items={items} total={{ label: "Landed cost", value: "₹12,00,000" }} size="sm" />);
    expect(totalRow()).toHaveClass("border-t-2", "mt-0.5", "pt-[7px]", "text-[15px]", "leading-5");
    expect(totalRow()).not.toHaveClass("text-base");
  });
});
