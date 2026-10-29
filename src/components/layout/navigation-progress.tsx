"use client";

import { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, useTransition } from "react";

// Client navigations keep the current page until the next one is ready (AppShell), so this bar is the sign that one is
// on its way. It reads React's own pending state (a Link's useLinkStatus, or a transition around router.push), never
// the URL, so it can't stay up after a navigation that ends where it started (a redirect back to the same page).

let pending = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/** Counts this navigation as pending while `isPending` is true. */
export function useReportPending(isPending: boolean) {
  useEffect(() => {
    if (!isPending) return;
    pending++;
    emit();
    return () => {
      pending--;
      emit();
    };
  }, [isPending]);
}

/** Inside a <Link>: reports its navigation to the bar. Renders nothing. */
export function LinkPending() {
  useReportPending(useLinkStatus().pending);
  return null;
}

/** router.push that the bar follows until the destination is on screen. */
export function useNavigate() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  useReportPending(isPending);
  return (href: string) => startTransition(() => router.push(href));
}

/**
 * A 2 px bar across the top of the window, over everything (no layout shift). It grows in only after 100 ms, so a fast
 * navigation shows nothing; it doesn't pulse when the user prefers reduced motion.
 */
export function NavigationProgress() {
  const show = useSyncExternalStore(subscribe, () => pending > 0, () => false);
  if (!show) return null;
  return (
    <div
      role="progressbar"
      aria-label="Loading page"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-primary transition-transform delay-100 duration-300 starting:scale-x-0 motion-safe:animate-pulse"
    />
  );
}
