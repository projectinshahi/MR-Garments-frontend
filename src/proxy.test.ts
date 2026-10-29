// @vitest-environment node
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SESSION_COOKIE, SESSION_ENDED_URL } from "@/config/navigation";

import { config, proxy } from "./proxy";

describe("proxy matcher", () => {
  const runsFor = (url: string, headers?: Record<string, string>) => unstable_doesMiddlewareMatch({ config, url, headers });

  it("runs for page loads and client navigations, not for router prefetches or the API", () => {
    expect(runsFor("/orders")).toBe(true);
    expect(runsFor("/orders", { rsc: "1", "next-router-state-tree": "%5B%5D" })).toBe(true);
    for (const kind of ["1", "2", "3"]) expect(runsFor("/orders", { rsc: "1", "next-router-prefetch": kind })).toBe(false);
    expect(runsFor("/api/v1/me")).toBe(false);
  });
});

const ended = () => new NextRequest("http://localhost:3000/orders", { headers: { cookie: `${SESSION_COOKIE}=dead` } });

describe("proxy with an ended session (ME-1 answers 401)", () => {
  afterEach(() => vi.unstubAllGlobals());

  // Router prefetches no longer reach the proxy (see the matcher test), but several requests still can. Keeping the
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
