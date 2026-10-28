import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CalendarTabs, ParamSelect } from "./controls";

const mocks = vi.hoisted(() => ({ search: "", push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/calendar",
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(mocks.search),
}));

const suppliers = [
  { value: "all", label: "All suppliers" },
  { value: "Foshan Fabrics", label: "Foshan Fabrics" },
  { value: "Yiwu Trims Ltd.", label: "Yiwu Trims Ltd." },
];

beforeEach(() => mocks.push.mockReset());

describe("ParamSelect", () => {
  it("shows the supplier in the URL and switches it, keeping the month", async () => {
    mocks.search = "month=2026-12&supplier=Foshan+Fabrics";
    render(<ParamSelect param="supplier" label="Supplier" options={suppliers} />);
    await userEvent.click(screen.getByRole("button", { name: "Supplier: Foshan Fabrics" }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Yiwu Trims Ltd." }));
    expect(mocks.push).toHaveBeenCalledWith("/calendar?month=2026-12&supplier=Yiwu+Trims+Ltd.");
  });

  it("shows All for an unknown supplier and removes the parameter when All is picked", async () => {
    mocks.search = "supplier=Gone+Co.";
    render(<ParamSelect param="supplier" label="Supplier" options={suppliers} />);
    await userEvent.click(screen.getByRole("button", { name: "Supplier: All suppliers" }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: "All suppliers" }));
    expect(mocks.push).toHaveBeenCalledWith("/calendar");
  });
});

describe("CalendarTabs", () => {
  const tabs = [
    { href: "/calendar", label: "Month", chip: "a" },
    { href: "/calendar/list", label: "List", chip: "c" },
  ];

  it("carries the supplier and range filters to every tab, but not the month", () => {
    mocks.search = "month=2026-12&supplier=Foshan+Fabrics&range=next-7";
    render(<CalendarTabs tabs={tabs} />);
    expect(screen.getByRole("link", { name: /List/ })).toHaveAttribute("href", "/calendar/list?supplier=Foshan+Fabrics&range=next-7");
    expect(screen.getByRole("link", { name: /Month/ })).toHaveAttribute("href", "/calendar?supplier=Foshan+Fabrics&range=next-7");
  });

  it("links to the plain views without filters", () => {
    mocks.search = "month=2026-12";
    render(<CalendarTabs tabs={tabs} />);
    expect(screen.getByRole("link", { name: /List/ })).toHaveAttribute("href", "/calendar/list");
    expect(screen.getByRole("link", { name: /Month/ })).toHaveAttribute("aria-current", "page");
  });
});
