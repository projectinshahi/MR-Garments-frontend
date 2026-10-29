import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import * as fixtures from "./data/fixtures";
import { StaffHomeScreen } from "./staff-home-screen";

const data = (canRecordReceipt: boolean) => ({
  canRecordReceipt,
  greeting: "Good afternoon, Chen Yu",
  waitingOrders: fixtures.waitingOrders,
  recentReceipts: fixtures.recentReceipts,
  allowedActions: fixtures.allowedActions,
  hiddenAreas: fixtures.hiddenAreas,
});

describe("StaffHomeScreen", () => {
  it("offers + Record a receipt only to staff who may record one (India and Warehouse staff were sent back)", () => {
    const { unmount } = render(<StaffHomeScreen data={data(true)} />);
    expect(screen.getByRole("link", { name: "+ Record a receipt" })).toHaveAttribute("href", "/receiving/new");
    unmount();
    render(<StaffHomeScreen data={data(false)} />);
    expect(screen.queryByRole("link", { name: "+ Record a receipt" })).toBeNull();
  });
});
