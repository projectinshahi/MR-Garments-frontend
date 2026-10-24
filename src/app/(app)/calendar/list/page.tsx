import { getCalendar } from "@/features/calendar/data/queries";
import { ListView } from "@/features/calendar/list-view";

export default async function CalendarListPage() {
  return <ListView {...await getCalendar()} />;
}
