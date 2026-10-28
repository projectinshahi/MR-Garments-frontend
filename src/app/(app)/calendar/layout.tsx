import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import type { RouteTab } from "@/components/layout/route-tabs";
import { TodayPill } from "@/components/shared/cards";
import { CalendarTabs, ParamSelect } from "@/features/calendar/controls";
import { getCalendar } from "@/features/calendar/data/queries";
import { supplierOptions } from "@/features/calendar/deliveries";

export const metadata: Metadata = { title: "Delivery Calendar" };

// D6: every calendar view shows the Month, Week and List tabs, although the Month reference (18) has none. The tabs
// and the Supplier select keep the URL filters (?supplier=, ?range=); see features/calendar/params.ts.
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
            <ParamSelect param="supplier" label="Supplier" options={supplierOptions(deliveries)} className="h-[38px]" />
            <TodayPill size="sm" today={today} />
          </>
        }
      />
      <CalendarTabs tabs={TABS} />
      {children}
    </>
  );
}
