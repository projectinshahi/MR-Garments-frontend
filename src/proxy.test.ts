// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SESSION_COOKIE, SESSION_ENDED_URL } from "@/config/navigation";

import { proxy } from "./proxy";

const ended = () => new NextRequest("http://localhost:3000/orders", { headers: { cookie: `${SESSION_COOKIE}=dead` } });

describe("proxy with an ended session (ME-1 answers 401)", () => {
  afterEach(() => vi.unstubAllGlobals());

  // Next hides the prefetch header from the proxy, so a background prefetch looks like a page load here. Keeping the
  // cookie means every one of them, and the page load after, still lands on sign-in with M4.
  it("sends every request to sign-in with M4 and keeps the cookie", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));
    for (let i = 0; i < 2; i++) {
      const response = await proxy(ended());
      expect(response.headers.get("location")).toBe(`http://localhost:3000${SESSION_ENDED_URL}`);
      expect(response.headers.get("set-cookie")).toBeNull();
    }
  });
});
