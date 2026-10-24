import { getCalendar } from "@/features/calendar/data/queries";
import { MonthView } from "@/features/calendar/month-view";

export default async function CalendarMonthPage() {
  return <MonthView {...await getCalendar()} />;
}
