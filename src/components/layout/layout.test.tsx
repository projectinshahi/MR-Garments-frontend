import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
