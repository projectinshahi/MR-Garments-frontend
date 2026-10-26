import { cookies } from "next/headers";

import { toApiError } from "./errors";

// Server-side API calls for Server Components. Forwards the browser's cookies to the API. Reading cookies makes the
// caller dynamic: render it inside a <Suspense> boundary (route loading.tsx counts). Coordinator-owned.

export const API_URL = process.env.API_URL ?? "http://localhost:4000";

export async function apiGet<T>(path: string): Promise<T> {
  const cookieHeader = (await cookies()).toString();
  const response = await fetch(`${API_URL}/api/v1${path}`, { headers: { cookie: cookieHeader }, cache: "no-store" });
  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as T;
}
