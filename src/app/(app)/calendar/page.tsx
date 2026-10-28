import { getCalendar } from "@/features/calendar/data/queries";
import { MonthView } from "@/features/calendar/month-view";
import { toParams } from "@/features/calendar/params";

export default async function CalendarMonthPage({ searchParams }: PageProps<"/calendar">) {
  const [data, search] = await Promise.all([getCalendar(), searchParams]);
  return <MonthView {...data} params={toParams(search)} />;
}
