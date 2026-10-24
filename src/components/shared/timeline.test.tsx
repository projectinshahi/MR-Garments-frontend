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

  it("draws xs progress steps with 22 px markers, a halo on the current step and lighter pending steps", () => {
    const progress = [
      { title: "Arrived at port", detail: "28 Sep", marker: "check" as const },
      { title: "Duty paid", detail: "Waiting", marker: "current" as const, number: 4 },
      { title: "Cleared from port", marker: "pending" as const, number: 5 },
    ];
    const { rerender } = render(<Timeline items={progress} size="sm" />);
    expect(screen.getByText("4")).toHaveClass("size-6");
    expect(screen.getByText("Cleared from port")).toHaveClass("text-muted-foreground");
    rerender(<Timeline items={progress} size="xs" />);
    expect(screen.getByText("4")).toHaveClass("size-[22px]", "border-primary", "ring-3", "ring-info-soft");
    expect(screen.getByText("5")).toHaveClass("size-[22px]", "border-input", "text-placeholder");
    expect(screen.getByText("Cleared from port")).toHaveClass("text-sm", "text-placeholder");
    expect(screen.getByText("Waiting")).toHaveClass("text-[12.5px]", "leading-[15px]");
    expect(screen.getByText("Duty paid").closest("li")).toHaveClass("gap-2", "pb-3");
    // Markers start 2 px below the title line, so a step without detail is 24 + 12 = 36 px, as in 25 and 27.
    expect(screen.getByText("5").parentElement).toHaveClass("w-[22px]", "pt-0.5");
  });
});
