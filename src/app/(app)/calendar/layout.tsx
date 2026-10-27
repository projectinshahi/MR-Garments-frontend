import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { RouteTabs, type RouteTab } from "@/components/layout/route-tabs";
import { TodayPill } from "@/components/shared/cards";
import { PrototypeSelect } from "@/features/calendar/controls";
import { getCalendar } from "@/features/calendar/data/queries";
import { supplierOptions } from "@/features/calendar/deliveries";

export const metadata: Metadata = { title: "Delivery Calendar" };

// D6: every calendar view shows the Month, Week and List tabs, although the Month reference (18) has none.
const TABS: RouteTab[] = [
  { href: "/calendar", label: "Month", chip: "a" },
  { href: "/calendar/week", label: "Week", chip: "b" },
  { href: "/calendar/list", label: "List", chip: "c" },
];

export default async function CalendarLayout({ children }: LayoutProps<"/calendar">) {
  const { deliveries, today } = await getCalendar();
  return (
    <>
      <PageHeader
        title="Delivery Calendar"
        actions={
          <>
            <PrototypeSelect label="Supplier" options={supplierOptions(deliveries)} action="Filter by supplier" className="h-[38px]" />
            <TodayPill size="sm" today={today} />
          </>
        }
      />
      <RouteTabs tabs={TABS} label="Calendar views" />
      {children}
    </>
  );
}
