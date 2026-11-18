import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";

import { LoadContainerScreen } from "./load-container-screen";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }), usePathname: () => "/containers/new" }));
const post = vi.fn();
vi.mock("@/lib/api/client", () => ({ apiClient: { post: (...args: unknown[]) => post(...args) } }));
const success = vi.fn();
vi.mock("@/lib/feedback", async (original) => ({ ...(await original<typeof import("@/lib/feedback")>()), notifySuccess: (m: string) => success(m) }));

const data = {
  today: "2026-09-27",
  agents: [
    { id: "a1", name: "Sino Freight" },
    { id: "a2", name: "Dragon Cargo" },
  ],
  lines: [
    { orderLineId: "l1", orderId: "o1", po: "PO-2035", terms: "FOB" as const, item: "Men's jackets", unit: "pcs" as const, received: 1160, loaded: 0 },
    { orderLineId: "l2", orderId: "o2", po: "PO-2031", terms: "CNF" as const, item: "Kids t-shirts", unit: "pcs" as const, received: 6000, loaded: 2000 },
  ] as { orderLineId: string; orderId: string; po: string; terms: "FOB" | "CNF" | null; item: string; unit: "pcs"; received: number; loaded: number }[],
};

beforeEach(() => vi.clearAllMocks());

async function fill() {
  const user = userEvent.setup();
  render(<LoadContainerScreen {...data} />);
  await user.type(screen.getByRole("textbox", { name: "Container number" }), "FCIU 5527310");
  await user.selectOptions(screen.getByRole("combobox", { name: "Shipping agent" }), "Sino Freight");
  await user.type(screen.getByLabelText("Expected arrival in India (ETA)"), "2026-10-24");
  await user.type(screen.getByRole("textbox", { name: "Port of loading" }), "Nansha, Guangzhou");
  await user.type(screen.getByRole("textbox", { name: "Bundles, PO-2031 Kids t-shirts" }), "40");
  return user;
}

describe("LoadContainerScreen", () => {
  it("blocks loading more than received minus already loaded", async () => {
    const user = await fill();
    expect(screen.getByLabelText("Loaded on")).toHaveValue("2026-09-27");
    await user.type(screen.getByRole("textbox", { name: "Quantity, PO-2031 Kids t-shirts" }), "4001");
    await user.click(screen.getByRole("button", { name: "Save container" }));
    expect(await screen.findByText("Only 4,000 pcs left to load.")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("posts exactly the CON-3 body, toasts and goes to the list", async () => {
    post.mockResolvedValue({ container: { id: "c1" } });
    const user = await fill();
    await user.type(screen.getByRole("textbox", { name: "Quantity, PO-2031 Kids t-shirts" }), "4000");
    expect(screen.getByText("PO-2031 · Kids t-shirts")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save container" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/containers"));
    expect(post).toHaveBeenCalledWith("/containers", {
      number: "FCIU 5527310",
      shippingAgentId: "a1",
      // PO-2031's container terms (the order loaded), not chosen on this form.
      terms: "CNF",
      portOfLoading: "Nansha, Guangzhou",
      portOfArrival: "",
      loadedOn: "2026-09-27",
      sailedOn: null,
      eta: "2026-10-24",
      lines: [{ orderLineId: "l2", bundles: 40, quantity: 4000 }],
    });
    expect(success).toHaveBeenCalledWith("Container saved");
    expect(refresh).toHaveBeenCalled();
  });

  it("shows a 409 under the container number and stays", async () => {
    const taken = "A container with this number already exists.";
    post.mockRejectedValue(new ApiError(409, "container_exists", taken, { number: taken }));
    const user = await fill();
    await user.type(screen.getByRole("textbox", { name: "Quantity, PO-2035 Men's jackets" }), "1160");
    await user.click(screen.getByRole("button", { name: "Save container" }));
    expect(await screen.findByText(taken)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Container number" })).toHaveFocus();
    expect(push).not.toHaveBeenCalled();
  });

  describe("container terms from the orders (backend docs/order-container-terms.md)", () => {
    const terms = () => screen.getByRole("textbox", { name: "Container terms" });

    it("offers no terms to choose: shows each line's order terms and fills the container's from the orders loaded", async () => {
      const user = await fill();
      expect(screen.queryByRole("combobox", { name: "Container terms" })).toBeNull();
      expect(terms()).toHaveAttribute("readonly");
      expect(terms()).toHaveValue("");
      expect(screen.getByText("Taken from the orders you load.")).toBeVisible();
      expect(screen.getByRole("row", { name: /PO-2035FOB/ })).toBeVisible();
      await user.type(screen.getByRole("textbox", { name: "Quantity, PO-2031 Kids t-shirts" }), "100");
      expect(terms()).toHaveValue("CNF");
      expect(screen.getByText("From PO-2031.")).toBeVisible();
    });

    it("refuses orders with different terms in one container before the API", async () => {
      const user = await fill();
      await user.type(screen.getByRole("textbox", { name: "Quantity, PO-2035 Men's jackets" }), "100");
      await user.type(screen.getByRole("textbox", { name: "Quantity, PO-2031 Kids t-shirts" }), "100");
      expect(terms()).toHaveValue("Different terms");
      await user.click(screen.getByRole("button", { name: "Save container" }));
      expect(await screen.findByText("PO-2035 is FOB and PO-2031 is CNF: one container holds orders with the same container terms.")).toBeVisible();
      expect(post).not.toHaveBeenCalled();
    });

    it("asks for an order's terms on Edit order when it has none, linking to it", async () => {
      const user = userEvent.setup();
      render(<LoadContainerScreen {...data} lines={[{ ...data.lines[0]!, terms: null, po: "PO-2040" }]} />);
      expect(screen.getByRole("row", { name: /PO-2040Terms not set/ })).toBeVisible();
      await user.type(screen.getByRole("textbox", { name: "Quantity, PO-2040 Men's jackets" }), "10");
      expect(screen.getByRole("link", { name: "Edit PO-2040" })).toHaveAttribute("href", "/orders/PO-2040?edit=1");
      await user.click(screen.getByRole("button", { name: "Save container" }));
      expect(await screen.findByText("Set the container terms on PO-2040 (Edit order) before loading it.")).toBeVisible();
      expect(post).not.toHaveBeenCalled();
    });

    it("shows the API's terms refusal under the lines", async () => {
      const differ = "These orders are FOB, so the container is FOB.";
      post.mockRejectedValue(new ApiError(422, "validation_failed", "Some fields need attention.", { terms: differ }));
      const user = await fill();
      await user.type(screen.getByRole("textbox", { name: "Quantity, PO-2035 Men's jackets" }), "100");
      await user.click(screen.getByRole("button", { name: "Save container" }));
      expect(await screen.findByText(differ)).toBeVisible();
    });
  });
});
