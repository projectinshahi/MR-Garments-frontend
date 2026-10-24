import { getCalendar } from "@/features/calendar/data/queries";
import { WeekView } from "@/features/calendar/week-view";

export default async function CalendarWeekPage() {
  return <WeekView {...await getCalendar()} />;
}
