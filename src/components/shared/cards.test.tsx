import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Callout, CardLink, KpiCard, KpiRow, SectionCard, TodayPill } from "@/components/shared/cards";

// Size options are opt-in: each default must stay as the other screens were measured.
describe("SectionCard titleGap", () => {
  it("keeps 16 px under the title by default and removes it with titleGap='none'", () => {
    const { rerender } = render(<SectionCard title="Payments due">body</SectionCard>);
    const titleRow = () => screen.getByRole("heading", { name: "Payments due" }).parentElement;
    expect(titleRow()).toHaveClass("mb-4");
    rerender(<SectionCard title="Payments due" titleGap="none">body</SectionCard>);
    expect(titleRow()).not.toHaveClass("mb-4");
  });
});

describe("SectionCard bottomGap", () => {
  it("keeps 20 px bottom padding by default and 6 px when tight", () => {
    const { rerender } = render(<SectionCard title="Cost breakdown">table</SectionCard>);
    const card = () => screen.getByRole("heading", { name: "Cost breakdown" }).closest("section");
    expect(card()).toHaveClass("pt-4", "pb-5");
    rerender(<SectionCard title="Cost breakdown" bottomGap="tight">table</SectionCard>);
    expect(card()).toHaveClass("pt-4", "pb-1.5");
    expect(card()).not.toHaveClass("pb-5");
  });
});

describe("Callout size", () => {
  it("keeps 15 px text by default and uses 13.5 px with tighter padding when sm", () => {
    render(
      <>
        <Callout>Default note</Callout>
        <Callout size="sm" tone="warning">
          Small note
        </Callout>
      </>,
    );
    expect(screen.getByText("Default note")).toHaveClass("px-4", "py-3", "text-[15px]", "leading-5");
    expect(screen.getByText("Small note")).toHaveClass("px-3.5", "py-2.5", "text-[13.5px]", "leading-5", "border");
  });
});

describe("CardLink size", () => {
  it("is 15 px by default and 13 px when sm", () => {
    render(
      <>
        <CardLink href="/orders">Default</CardLink>
        <CardLink href="/orders" size="sm">Small</CardLink>
      </>,
    );
    expect(screen.getByRole("link", { name: "Default" })).toHaveClass("text-[15px]");
    expect(screen.getByRole("link", { name: "Small" })).toHaveClass("text-[13px]");
    expect(screen.getByRole("link", { name: "Small" })).not.toHaveClass("text-[15px]");
  });
});

describe("KpiCard size and KpiRow gap", () => {
  it("keeps the default card and 18 px gap, and sets the 104 px card and 16 px gap when sm", () => {
    render(
      <>
        <KpiRow data-testid="default-row">
          <KpiCard label="Default" value="50" sub="across 6 stages" />
        </KpiRow>
        <KpiRow gap="sm" data-testid="sm-row">
          <KpiCard label="Small" value="8" sub="from 5 suppliers" size="sm" />
        </KpiRow>
      </>,
    );
    expect(screen.getByTestId("default-row")).toHaveClass("gap-(--page-gap)");
    expect(screen.getByTestId("sm-row")).toHaveClass("gap-4");
    expect(screen.getByText("Default").parentElement).toHaveClass("pt-4", "pb-3");
    expect(screen.getByText("Small").parentElement).toHaveClass("pt-[15px]", "pb-[10.5px]");
    expect(screen.getByText("8")).toHaveClass("mt-[3px]");
    expect(screen.getByText("50")).toHaveClass("mt-1", "text-[30px]");
  });

  it("sets the 91.5 px card with a 28 px value when xs", () => {
    render(<KpiCard label="Order value" value="¥80,000" sub="2,500 pcs × ¥32.00" size="xs" />);
    expect(screen.getByText("Order value").parentElement).toHaveClass("px-5", "pt-[15px]", "pb-[2.5px]");
    expect(screen.getByText("¥80,000")).toHaveClass("mt-1", "text-[28px]", "leading-8");
  });
});

describe("TodayPill size", () => {
  it("shows MOCK_TODAY at 14 px by default and 13.5 px when sm", () => {
    const { rerender } = render(<TodayPill />);
    expect(screen.getByText("Today, 30 Sep 2026")).toHaveClass("text-sm");
    rerender(<TodayPill size="sm" />);
    expect(screen.getByText("Today, 30 Sep 2026")).toHaveClass("text-[13.5px]");
  });
});
