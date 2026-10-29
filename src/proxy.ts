import { type NextRequest, NextResponse, type ProxyConfig } from "next/server";

import { canOpen, isPublicPath, SESSION_COOKIE, SESSION_ENDED_URL } from "@/config/navigation";
import type { Me } from "@/lib/api/types";

// Batch 1 sign-in routing (B3, E6, E7, E9, U37.1). Runs before every page.
// - Signed out: public pages open; everything else goes to /login.
// - Session ended: /login?reason=session-ended (the sign-in page shows M4).
// - Signed in: /login goes to the user's landing page, and a page the role can't open redirects there too (P-b).
// The API still checks every request itself; this only decides where pages go.

const API_URL = process.env.API_URL ?? "http://localhost:4000";

async function currentUser(request: NextRequest): Promise<Me | null | "unreachable"> {
  try {
    const response = await fetch(`${API_URL}/api/v1/me`, { headers: { cookie: request.headers.get("cookie") ?? "" }, cache: "no-store" });
    if (response.status === 401) return null;
    return response.ok ? ((await response.json()) as Me) : "unreachable";
  } catch {
    return "unreachable";
  }
}

const redirectTo = (request: NextRequest, path: string) => NextResponse.redirect(new URL(path, request.url));

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = isPublicPath(pathname);

  if (!request.cookies.has(SESSION_COOKIE)) return isPublic ? NextResponse.next() : redirectTo(request, "/login");

  const me = await currentUser(request);
  // If the API can't be reached, let the page render; it shows the error page (E13).
  if (me === "unreachable") return NextResponse.next();
  // The dead cookie is kept (sign-in replaces it, sign-out clears it): clearing it here let a background prefetch use
  // it up, and the user's next page load then reached a plain /login without M4 saying why.
  if (me === null) return isPublic ? NextResponse.next() : redirectTo(request, SESSION_ENDED_URL);
  if (pathname === "/login") return redirectTo(request, me.landing);
  if (!canOpen(me, pathname)) return redirectTo(request, me.landing);
  return NextResponse.next();
}

export const config: ProxyConfig = {
  // Everything except the API forwarding, Next internals and files with an extension (images, icons), and router
  // prefetches. A prefetch only fetches a page's App Shell (static, no API data: uncached fetches never run in it), yet
  // each one cost a ME-1 call here, about one per visible link. The click's own request still comes through here.
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
      missing: [{ type: "header", key: "next-router-prefetch" }],
    },
  ],
};
