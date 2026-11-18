import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MobileNav } from "@/components/layout/app-sidebar";
import { AuthLayout } from "@/components/layout/auth-layout";
import { PageHeader } from "@/components/layout/page-header";
import { RouteTabs } from "@/components/layout/route-tabs";
import type { Me } from "@/lib/api/types";

describe("PageHeader breadcrumb", () => {
  it("spaces the parent, the / and the title 4 px apart, as measured in 06, 15, 23, 29 and 33", () => {
    render(<PageHeader title="New order" parent={{ label: "Orders", href: "/orders" }} />);
    expect(screen.getByRole("heading", { level: 1, name: "New order" }).parentElement).toHaveClass("gap-1");
    expect(screen.getByRole("link", { name: "Orders" })).toHaveAttribute("href", "/orders");
  });
});

describe("AuthLayout card", () => {
  it("is 440 px wide with 40 px padding from sm up, as in 01-03", () => {
    render(
      <AuthLayout>
        <h1>Sign in</h1>
      </AuthLayout>,
    );
    expect(screen.getByRole("heading", { name: "Sign in" }).parentElement).toHaveClass("max-w-[440px]", "sm:p-10");
  });
});

// The navigation itself (once, through the bar's router.push) needs the App Router: e2e/navigation.spec.ts covers it.
vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: vi.fn() }) }));

describe("MobileNav", () => {
  it("closes the sheet when a page is picked, so the page isn't left behind the menu", async () => {
    const user = userEvent.setup();
    const sections = [{ items: [{ title: "Landed Cost", href: "/landed-cost" }] }];
    const viewer = { shell: "management" as const, permissions: {} as Me["permissions"] };
    render(<MobileNav user={{ name: "Suresh Menon", initials: "SM", detail: "Full access", sections, viewer }} />);
    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("link", { name: "Landed Cost" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("RouteTabs", () => {
  it("scrolls only the tab bar, so the current tab is in view on a narrow screen", () => {
    // A 390 px bar whose current tab ("/", from the mocked pathname) sits at 400-520 px, past its right edge.
    const rect = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const [left, right] = this.tagName === "NAV" ? [0, 390] : this.getAttribute("aria-current") === "page" ? [400, 520] : [0, 0];
      return { left, right, top: 0, bottom: 46, width: right - left, height: 46, x: left, y: 0, toJSON: () => ({}) } as DOMRect;
    });
    const scroll = vi.fn();
    const original = HTMLElement.prototype.scrollBy;
    HTMLElement.prototype.scrollBy = scroll;
    const tabs = [
      { href: "/deposits", label: "All deposits", chip: "a" },
      { href: "/", label: "Supplier advance", chip: "e" },
    ];
    render(<RouteTabs tabs={tabs} label="Deposits views" />);
    expect(screen.getByRole("link", { name: /Supplier advance/ })).toHaveAttribute("aria-current", "page");
    expect(scroll).toHaveBeenCalledWith({ left: 130 });
    rect.mockRestore();
    HTMLElement.prototype.scrollBy = original;
  });
});
