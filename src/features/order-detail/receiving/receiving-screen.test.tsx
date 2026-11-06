import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { OrderReceipt, OrderView } from "@/features/order-detail/data/queries";

import { ReceivingScreen } from "./receiving-screen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/features/order-detail/shared/order-detail-frame", () => ({ OrderContextStrip: () => null }));

// Ordered 360 m, received 949 m over two receipts (2026-11-06: more than ordered is allowed).
const order = {
  po: "PO-2060",
  quantity: 360,
  received: 949,
  unit: "m",
  lines: [{ id: "l1", position: 0, item: { id: "i1", name: "Cotton fabric" }, unit: "m", quantity: 360, rateCny: 3, valueCny: 1080, received: 949, loaded: 0 }],
} as OrderView;
const receipt = (id: string, receivedOn: string, quantity: number): OrderReceipt => ({
  id,
  receivedOn,
  office: "Guangzhou office",
  bundles: 10,
  deliveryNote: "",
  shortRemark: "",
  receivedBy: "Wang Fang",
  lines: [{ orderLineId: "l1", item: "Cotton fabric", unit: "m", quantity }],
});

describe("ReceivingScreen", () => {
  it("keeps the actual received quantity and shows Short as 0, never negative", () => {
    render(<ReceivingScreen order={order} receipts={[receipt("r1", "2026-11-01", 300), receipt("r2", "2026-11-05", 649)]} />);
    expect(screen.getByText("Received in China", { selector: "p" }).nextElementSibling).toHaveTextContent("949 m");
    expect(screen.getByText("Short", { selector: "p" }).nextElementSibling).toHaveTextContent("0");
    const row = screen.getByText("Cotton fabric", { selector: "td" }).closest("tr")!;
    expect(row).toHaveTextContent("360 m");
    expect(row).toHaveTextContent("949 m");
    expect(row).not.toHaveTextContent("-");
  });
});
