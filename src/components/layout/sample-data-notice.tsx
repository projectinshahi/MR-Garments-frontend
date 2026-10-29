"use client";

import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export const SAMPLE_DATA_LABEL = "Sample Data — Not Live";

// Screens that still show sample (fixture) data, so nobody takes their figures for real records. Verified 2026-10-28:
// each route's queries read fixtures, not the API. Remove a route here when its screen goes live.
const SAMPLE_DATA_ROUTES = [
  /^\/home(\/|$)/, // Staff home
  /^\/forgot-password(\/|$)/, // Sends nothing yet, and the email is prefilled with a sample address
];

export const isSampleDataPath = (pathname: string) => SAMPLE_DATA_ROUTES.some((route) => route.test(pathname));

/** "Sample Data — Not Live" above a screen that still shows sample data; nothing on live screens. */
export function SampleDataNotice({ className }: { className?: string }) {
  const pathname = usePathname();
  if (!isSampleDataPath(pathname)) return null;
  return (
    <div role="note" className={cn("bg-warning-soft px-(--page-padding) py-2 text-[13px] leading-4 font-bold text-warning", className)}>
      {SAMPLE_DATA_LABEL}
    </div>
  );
}
