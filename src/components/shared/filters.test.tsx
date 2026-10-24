import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FilterChips, FilterSelect, SearchInput } from "@/components/shared/filters";

const suppliers = [
  { value: "all", label: "All suppliers" },
  { value: "foshan", label: "Foshan Fabrics" },
];

describe("FilterSelect size", () => {
  it("keeps 15 px text and the ▾ character by default", () => {
    render(<FilterSelect label="Supplier" value="all" options={suppliers} onValueChange={() => {}} />);
    const trigger = screen.getByRole("button", { name: "Supplier: All suppliers" });
    expect(trigger).toHaveClass("h-10", "px-[15px]", "text-[15px]", "text-foreground");
    expect(trigger).toHaveTextContent("All suppliers ▾");
  });

  it("uses 14 px slate text and a drawn triangle when sm", () => {
    render(<FilterSelect label="Supplier" value="all" options={suppliers} onValueChange={() => {}} size="sm" />);
    const trigger = screen.getByRole("button", { name: "Supplier: All suppliers" });
    expect(trigger).toHaveClass("h-10", "pl-[15px]", "pr-3.5", "text-sm", "text-label");
    expect(trigger).not.toHaveTextContent("▾");
    expect(trigger.querySelector("svg[aria-hidden]")).not.toBeNull();
  });
});

describe("FilterChips size", () => {
  const chips = [
    { value: "all", label: "All (16)" },
    { value: "late", label: "Late (3)", tone: "danger" as const },
    { value: "track", label: "On track (10)" },
  ];

  it("keeps 33 px chips with 14 px text by default, and 32 px chips with 13 px slate text when sm", () => {
    const { rerender } = render(<FilterChips label="Status" options={chips} value="all" onValueChange={() => {}} />);
    expect(screen.getByRole("button", { name: "On track (10)" })).toHaveClass("h-[33px]", "px-3", "text-sm", "text-foreground");
    rerender(<FilterChips label="Status" options={chips} value="all" onValueChange={() => {}} size="sm" />);
    expect(screen.getByRole("button", { name: "On track (10)" })).toHaveClass("h-8", "px-3.5", "text-[13px]", "text-label");
    expect(screen.getByRole("button", { name: "Late (3)" })).toHaveClass("text-danger");
    expect(screen.getByRole("button", { name: "All (16)" })).toHaveClass("bg-navy", "text-white");
  });
});

describe("SearchInput", () => {
  it("is 40 px with 15 px text by default and reports typing", async () => {
    const onValueChange = vi.fn();
    render(<SearchInput label="Search orders" value="" onValueChange={onValueChange} />);
    const input = screen.getByRole("searchbox", { name: "Search orders" });
    expect(input).toHaveClass("text-[15px]");
    expect(input.parentElement).toHaveClass("h-10");
    await userEvent.type(input, "P");
    expect(onValueChange).toHaveBeenCalledWith("P");
  });

  it("is 38 px with 13.5 px text when sm (dashboard header)", () => {
    render(<SearchInput label="Search" value="" onValueChange={() => {}} size="sm" />);
    const input = screen.getByRole("searchbox", { name: "Search" });
    expect(input).toHaveClass("text-[13.5px]");
    expect(input).not.toHaveClass("text-[15px]");
    expect(input.parentElement).toHaveClass("h-[38px]");
  });
});
