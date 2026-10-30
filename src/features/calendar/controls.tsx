"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { useNavigate } from "@/components/layout/navigation-progress";
import { RouteTabs, type RouteTab } from "@/components/layout/route-tabs";
import { FilterSelect, type FilterOption } from "@/components/shared/filters";

import { filterQuery, hrefWith, optionParam } from "./params";

type ParamSelectProps = { param: string; label: string; options: FilterOption[]; size?: "default" | "sm"; className?: string };

/**
 * A filter dropdown kept in the URL (`?<param>=`, "all" removes it). The other parameters stay. It shows the old choice
 * until the new view is loaded, so the progress bar follows the navigation.
 */
export function ParamSelect({ param, ...select }: ParamSelectProps) {
  return (
    <Suspense fallback={<FilterSelect {...select} value="all" onValueChange={() => {}} />}>
      <BoundSelect param={param} {...select} />
    </Suspense>
  );
}

function BoundSelect({ param, options, ...select }: ParamSelectProps) {
  const navigate = useNavigate();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <FilterSelect
      {...select}
      options={options}
      value={optionParam(params, param, options)}
      onValueChange={(value) => navigate(hrefWith(pathname, params, param, value === "all" ? null : value))}
    />
  );
}

/** The Month, Week and List tabs, carrying the supplier and date-range filters to the other views. */
export function CalendarTabs({ tabs }: { tabs: RouteTab[] }) {
  return (
    <Suspense fallback={<RouteTabs tabs={tabs} label="Calendar views" />}>
      <FilteredTabs tabs={tabs} />
    </Suspense>
  );
}

function FilteredTabs({ tabs }: { tabs: RouteTab[] }) {
  const query = filterQuery(useSearchParams());
  return <RouteTabs label="Calendar views" tabs={query ? tabs.map((tab) => ({ ...tab, href: `${tab.href}?${query}` })) : tabs} />;
}
