import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CardLink, KpiCard, KpiRow, SectionCard, TodayPill } from "@/components/shared/cards";

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
    expect(screen.getByText("50")).toHaveClass("mt-1");
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
