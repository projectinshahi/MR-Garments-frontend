import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

describe("Button sizes", () => {
  it("keeps the 36 px default and adds the 34 px page-header size", () => {
    render(
      <>
        <Button>Default</Button>
        <Button size="header">+ New order</Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "Default" })).toHaveClass("h-9", "px-4");
    expect(screen.getByRole("button", { name: "+ New order" })).toHaveClass("h-[34px]", "px-3.5", "text-sm");
  });
});
