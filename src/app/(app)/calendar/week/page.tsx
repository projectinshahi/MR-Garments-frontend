import { getCalendar } from "@/features/calendar/data/queries";
import { toParams } from "@/features/calendar/params";
import { WeekView } from "@/features/calendar/week-view";

export default async function CalendarWeekPage({ searchParams }: PageProps<"/calendar/week">) {
  const [data, search] = await Promise.all([getCalendar(), searchParams]);
  return <WeekView {...data} params={toParams(search)} />;
}
