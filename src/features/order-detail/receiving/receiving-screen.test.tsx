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
  it("keeps the actual received quantity and shows what came in above the order, never a negative short", () => {
    render(<ReceivingScreen order={order} receipts={[receipt("r1", "2026-11-01", 300), receipt("r2", "2026-11-05", 649)]} />);
    expect(screen.getByText("Ordered", { selector: "p" }).nextElementSibling).toHaveTextContent("360 m");
    expect(screen.getByText("Received in China", { selector: "p" }).nextElementSibling).toHaveTextContent("949 m");
    expect(screen.getByText("Over-received", { selector: "p" }).nextElementSibling).toHaveTextContent("589 m");
    expect(screen.queryByText("Remaining", { selector: "p" })).not.toBeInTheDocument();
    const row = screen.getByText("Cotton fabric", { selector: "td" }).closest("tr")!;
    expect(row).toHaveTextContent("360 m");
    expect(row).toHaveTextContent("949 m");
    expect(row).toHaveTextContent("Over-received 589");
    expect(row).not.toHaveTextContent(/-\s*\d/); // no negative quantity
  });

  it("shows what is still to receive when short, and 0 once complete", () => {
    const short = { ...order, received: 300, lines: [{ ...order.lines[0]!, received: 300 }] } as OrderView;
    const { unmount } = render(<ReceivingScreen order={short} receipts={[receipt("r1", "2026-11-01", 300)]} />);
    expect(screen.getByText("Remaining", { selector: "p" }).nextElementSibling).toHaveTextContent("60 m");
    expect(screen.getByText("Cotton fabric", { selector: "td" }).closest("tr")).toHaveTextContent(/60$/);
    unmount();
    const complete = { ...order, received: 360, lines: [{ ...order.lines[0]!, received: 360 }] } as OrderView;
    render(<ReceivingScreen order={complete} receipts={[receipt("r1", "2026-11-01", 360)]} />);
    expect(screen.getByText("Remaining", { selector: "p" }).nextElementSibling).toHaveTextContent("0 m");
    expect(screen.queryByText(/Over-received/)).not.toBeInTheDocument();
  });
});
