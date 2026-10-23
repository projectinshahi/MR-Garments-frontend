"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { cn } from "@/lib/utils";

export type RouteTab = { href: string; label: string; /** Letter or number chip: "a", "1". */ chip: string };

/**
 * 46 px tab bar under the header (order detail a–i, calendar a–c, settings 1–7, users 1–3).
 * Each tab is a route; the active tab is the exact pathname match.
 */
export function RouteTabs({ tabs, label }: { tabs: RouteTab[]; label: string }) {
  return (
    <nav aria-label={label} className="flex h-(--tabs-height) shrink-0 items-stretch gap-1 overflow-x-auto border-b bg-card px-4 md:px-(--page-padding)">
      <Suspense fallback={<Tabs tabs={tabs} pathname={null} />}>
        <ActiveTabs tabs={tabs} />
      </Suspense>
    </nav>
  );
}

function ActiveTabs({ tabs }: { tabs: RouteTab[] }) {
  return <Tabs tabs={tabs} pathname={usePathname()} />;
}

function Tabs({ tabs, pathname }: { tabs: RouteTab[]; pathname: string | null }) {
  return tabs.map((tab) => {
    const active = pathname === tab.href;
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
        <span
          aria-hidden
          className={cn(
            "flex size-[18px] items-center justify-center rounded-[5px] text-[11px] font-bold",
            active ? "bg-primary text-white" : "bg-chip-muted text-muted-foreground",
          )}
        >
          {tab.chip}
        </span>
        {tab.label}
        {active ? <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-primary" /> : null}
      </Link>
    );
  });
}
