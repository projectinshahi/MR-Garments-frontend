import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NativeSelect } from "@/components/shared/form";
import { Input } from "@/components/ui/input";

// The size options are opt-in: the defaults stay as the Wave 1 screens were measured.
describe("Input size", () => {
  it("keeps 15 px text and 14 px padding by default, 14 px text and 12 px padding when sm", () => {
    render(
      <>
        <Input aria-label="Default field" />
        <Input aria-label="Small field" size="sm" />
      </>,
    );
    expect(screen.getByRole("textbox", { name: "Default field" })).toHaveClass("h-[42px]", "px-3.5", "text-[15px]");
    expect(screen.getByRole("textbox", { name: "Small field" })).toHaveClass("h-[42px]", "px-3", "text-sm");
    expect(screen.getByRole("textbox", { name: "Small field" })).not.toHaveClass("text-[15px]");
  });

  it("lets a caller class win over the size, as for dashed empty dates", () => {
    render(<Input aria-label="Duty paid on" size="sm" className="border-dashed" />);
    expect(screen.getByRole("textbox", { name: "Duty paid on" })).toHaveClass("border-dashed", "text-sm");
  });
});

describe("NativeSelect size", () => {
  it("keeps 15 px text by default, 14 px text with 12 px padding and a smaller ▼ when sm", () => {
    render(
      <>
        <NativeSelect aria-label="Default select">
          <option>Foshan Fabrics</option>
        </NativeSelect>
        <NativeSelect aria-label="Small select" size="sm">
          <option>Foshan Fabrics</option>
        </NativeSelect>
      </>,
    );
    const small = screen.getByRole("combobox", { name: "Small select" });
    expect(screen.getByRole("combobox", { name: "Default select" })).toHaveClass("pl-3.5", "text-[15px]");
    expect(small).toHaveClass("pl-3", "text-sm");
    expect(small.nextElementSibling).toHaveClass("right-[13px]", "text-[10px]");
  });
});
