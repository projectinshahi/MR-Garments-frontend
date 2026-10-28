import { cookies } from "next/headers";
import { cache } from "react";

import { SESSION_COOKIE } from "@/config/navigation";

import { API_URL } from "./api/server";
import type { Me } from "./api/types";

/**
 * The signed-in user from ME-1, or null when signed out or the session ended. Reads cookies, so callers render
 * inside a <Suspense> boundary. Cached per request: every component asking during one render shares one call.
 * Coordinator-owned.
 */
export const getMe = cache(async (): Promise<Me | null> => {
  const jar = await cookies();
  if (!jar.has(SESSION_COOKIE)) return null;
  const response = await fetch(`${API_URL}/api/v1/me`, { headers: { cookie: jar.toString() }, cache: "no-store" });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`GET /api/v1/me failed with ${response.status}`);
  return (await response.json()) as Me;
});
