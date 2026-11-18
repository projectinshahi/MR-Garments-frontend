"use client";

import Link from "next/link";

import { LinkPending } from "@/components/layout/navigation-progress";
import { usePathname } from "next/navigation";
import { type RefObject, Suspense, useEffect, useRef } from "react";

import { cn, decodePath } from "@/lib/utils";

export type RouteTab = { href: string; label: string; /** Letter or number chip: "a", "1"; none on the Suppliers tabs. */ chip?: string };

/**
 * 46 px tab bar under the header (order detail a–i, calendar a–c, settings 1–7, users 1–3).
 * Each tab is a route; the active tab is the exact pathname match (a query string in the href, such as kept
 * filters, is ignored).
 */
export function RouteTabs({ tabs, label }: { tabs: RouteTab[]; label: string }) {
  const bar = useRef<HTMLElement>(null);
  return (
    <nav ref={bar} aria-label={label} className="flex h-(--tabs-height) shrink-0 items-stretch gap-1 overflow-x-auto border-b bg-card px-4 md:px-(--page-padding)">
      <Suspense fallback={<Tabs tabs={tabs} pathname={null} />}>
        <ActiveTabs tabs={tabs} bar={bar} />
      </Suspense>
    </nav>
  );
}

function ActiveTabs({ tabs, bar }: { tabs: RouteTab[]; bar: RefObject<HTMLElement | null> }) {
  const pathname = usePathname();
  // On a narrow screen the bar scrolls sideways: bring the current tab into view (Deposits opens on its last tab).
  // Only the bar scrolls, never the page.
  useEffect(() => {
    const nav = bar.current;
    const tab = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !tab) return;
    const outer = nav.getBoundingClientRect();
    const inner = tab.getBoundingClientRect();
    if (inner.right > outer.right) nav.scrollBy({ left: inner.right - outer.right });
    else if (inner.left < outer.left) nav.scrollBy({ left: inner.left - outer.left });
  }, [pathname, bar]);
  return <Tabs tabs={tabs} pathname={pathname} />;
}

function Tabs({ tabs, pathname }: { tabs: RouteTab[]; pathname: string | null }) {
  return tabs.map((tab) => {
    // Compared decoded: an order's tabs carry its PO encoded (MR%2F2026%2F001), the pathname may or may not.
    const active = pathname !== null && decodePath(pathname) === decodePath(tab.href.split("?")[0] ?? tab.href);
    return (
      <Link
        key={tab.href}
        href={tab.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex shrink-0 items-center gap-2 px-3.5 text-sm whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          active ? "font-bold text-primary" : "text-muted-foreground hover:text-foreground",
        )}
      >
        {tab.chip ? (
          <span
            aria-hidden
            className={cn(
              "flex size-[18px] items-center justify-center rounded-[5px] text-[11px] font-bold",
              active ? "bg-primary text-white" : "bg-chip-muted text-muted-foreground",
            )}
          >
            {tab.chip}
          </span>
        ) : null}
        {tab.label}
        {active ? <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-primary" /> : null}
        <LinkPending />
      </Link>
    );
  });
}
