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
    { orderLineId: "l1", orderId: "o1", po: "PO-2035", item: "Men's jackets", unit: "pcs" as const, received: 1160, loaded: 0 },
    { orderLineId: "l2", orderId: "o2", po: "PO-2031", item: "Kids t-shirts", unit: "pcs" as const, received: 6000, loaded: 2000 },
  ],
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
      terms: "FOB",
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
});
