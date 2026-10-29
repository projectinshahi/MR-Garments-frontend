import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isSampleDataPath, SAMPLE_DATA_LABEL, SampleDataNotice } from "./sample-data-notice";

const nav = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

// Every page whose queries read fixtures (verified 2026-10-28), and every page that reads the API.
const ID = "7d9a8a7e-0000-4000-8000-000000000000";
const SAMPLE = [
  "/home",
  "/forgot-password",
];
const LIVE = [
  "/",
  "/notifications",
  "/profile",
  "/orders",
  "/orders/new",
  "/orders/PO-2050",
  ...["items", "payments", "receiving", "containers"].map((tab) => `/orders/PO-2050/${tab}`),
  `/containers/${ID}`,
  "/clearing",
  `/clearing/${ID}`,
  "/transport",
  `/transport/${ID}`,
  "/warehouse",
  `/warehouse/receive/${ID}`,
  "/landed-cost",
  "/reports",
  "/reports/order-status",
  "/reports/ordered-vs-received",
  "/reports/payments-per-supplier",
  "/reports/landed-cost-by-month",
  "/reports/containers-timeline",
  "/reports/deliveries-per-day",
  "/payments",
  "/calendar",
  "/calendar/week",
  "/calendar/list",
  "/receiving",
  "/receiving/new",
  "/containers",
  "/containers/new",
  "/users",
  "/users/edit",
  "/users/roles",
  "/settings/suppliers",
  "/settings/items",
  "/login",
  "/change-password",
  "/set-password",
];

describe("Sample Data — Not Live notice", () => {
  beforeEach(() => {
    nav.pathname = "/";
  });

  it.each(SAMPLE)("labels sample-data screen %s", (path) => {
    expect(isSampleDataPath(path)).toBe(true);
  });

  it.each(LIVE)("leaves live screen %s unlabelled", (path) => {
    expect(isSampleDataPath(path)).toBe(false);
  });

  it("shows the label as a note on a sample-data screen", () => {
    nav.pathname = "/home";
    render(<SampleDataNotice />);
    expect(screen.getByRole("note")).toHaveTextContent(SAMPLE_DATA_LABEL);
    expect(SAMPLE_DATA_LABEL).toBe("Sample Data — Not Live");
  });

  it("renders nothing on a live screen", () => {
    nav.pathname = "/orders";
    const { container } = render(<SampleDataNotice />);
    expect(container).toBeEmptyDOMElement();
  });
});
