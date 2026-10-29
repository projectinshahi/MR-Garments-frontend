import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NavigationProgress, useNavigate, useReportPending } from "./navigation-progress";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function Reporter({ pending }: { pending: boolean }) {
  useReportPending(pending);
  return null;
}

const bar = () => screen.queryByRole("progressbar", { name: "Loading page" });

describe("NavigationProgress", () => {
  it("shows while any navigation is pending, and goes when the last one ends", () => {
    const { rerender } = render(
      <>
        <NavigationProgress />
        <Reporter pending={false} />
        <Reporter pending={false} />
      </>,
    );
    expect(bar()).toBeNull();
    rerender(
      <>
        <NavigationProgress />
        <Reporter pending />
        <Reporter pending />
      </>,
    );
    expect(bar()).toBeInTheDocument();
    rerender(
      <>
        <NavigationProgress />
        <Reporter pending={false} />
        <Reporter pending />
      </>,
    );
    expect(bar()).toBeInTheDocument();
    rerender(
      <>
        <NavigationProgress />
        <Reporter pending={false} />
        <Reporter pending={false} />
      </>,
    );
    expect(bar()).toBeNull();
  });

  it("drops a pending navigation whose reporter unmounts (a page hidden by Activity)", () => {
    const { rerender } = render(
      <>
        <NavigationProgress />
        <Reporter pending />
      </>,
    );
    expect(bar()).toBeInTheDocument();
    rerender(<NavigationProgress />);
    expect(bar()).toBeNull();
  });
});

describe("useNavigate", () => {
  it("pushes the page once", () => {
    function Row() {
      const navigate = useNavigate();
      return <button onClick={() => navigate("/orders/PO-2050")}>PO-2050</button>;
    }
    render(<Row />);
    screen.getByRole("button", { name: "PO-2050" }).click();
    expect(push.mock.calls).toEqual([["/orders/PO-2050"]]);
  });
});
