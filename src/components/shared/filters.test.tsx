import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SearchInput } from "@/components/shared/filters";

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
