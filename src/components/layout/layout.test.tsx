import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MobileNav } from "@/components/layout/app-sidebar";
import { AuthLayout } from "@/components/layout/auth-layout";
import { PageHeader } from "@/components/layout/page-header";

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

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

describe("MobileNav", () => {
  it("closes the sheet when a page is picked, so the page isn't left behind the menu", async () => {
    const user = userEvent.setup();
    const sections = [{ items: [{ title: "Landed Cost", href: "/landed-cost" }] }];
    render(<MobileNav user={{ name: "Suresh Menon", initials: "SM", detail: "Full access", sections }} />);
    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("link", { name: "Landed Cost" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
