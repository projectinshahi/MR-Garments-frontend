import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Journey, Timeline } from "@/components/shared/timeline";

const route = [
  { title: "Guangzhou (Nansha)", lines: ["Loaded 9 Sep"], marker: "dot" as const },
  { title: "On the sea", lines: ["Sailed 12 Sep"], marker: "ring" as const },
];

describe("Journey", () => {
  // Bug fix: inside Journey's plain wrapper an inline span ignored size-3.5 and rendered 0 × 0 (no route dots).
  it("renders dot and ring markers as blocks so they keep their 14 px size", () => {
    const { container } = render(<Journey align="edges" steps={route} />);
    const markers = container.querySelectorAll("span.size-3\\.5");
    expect(markers).toHaveLength(2);
    markers.forEach((marker) => expect(marker).toHaveClass("block"));
  });

  it("keeps 15 px titles and 13 px lines by default, 14 px and 12.5 px when sm", () => {
    const { rerender } = render(<Journey steps={route} />);
    expect(screen.getByText("On the sea")).toHaveClass("text-[15px]");
    expect(screen.getByText("Sailed 12 Sep")).toHaveClass("text-[13px]");
    expect(screen.getByText("On the sea").closest("li")).toHaveClass("gap-1.5");
    rerender(<Journey steps={route} size="sm" />);
    expect(screen.getByText("On the sea")).toHaveClass("text-sm");
    expect(screen.getByText("Sailed 12 Sep")).toHaveClass("text-[12.5px]");
    expect(screen.getByText("On the sea").closest("li")).not.toHaveClass("gap-1.5");
  });
});

describe("Timeline", () => {
  const items = [
    { title: "Received in China", detail: "26 Aug · Wang Fang", marker: "dot" as const },
    { title: "Loaded", detail: "9 Sep", marker: "ring" as const },
  ];

  it("keeps 15 px titles and 16 px spacing by default, 14 px and 12 px when sm", () => {
    const { rerender } = render(<Timeline items={items} />);
    expect(screen.getByText("Loaded")).toHaveClass("text-[15px]", "leading-6");
    expect(screen.getByText("Received in China").closest("li")).toHaveClass("pb-4");
    expect(screen.getByText("9 Sep")).toHaveClass("text-[13px]");
    rerender(<Timeline items={items} size="sm" />);
    expect(screen.getByText("Loaded")).toHaveClass("text-sm", "leading-5");
    expect(screen.getByText("Received in China").closest("li")).toHaveClass("pb-3");
    expect(screen.getByText("9 Sep")).toHaveClass("text-[12.5px]");
  });
});
