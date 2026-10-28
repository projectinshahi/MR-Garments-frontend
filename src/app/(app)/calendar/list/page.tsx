import { getCalendar } from "@/features/calendar/data/queries";
import { ListView } from "@/features/calendar/list-view";
import { filterDeliveries, readFilters, toParams } from "@/features/calendar/params";

export default async function CalendarListPage({ searchParams }: PageProps<"/calendar/list">) {
  const [{ today, deliveries, linkOrders }, search] = await Promise.all([getCalendar(), searchParams]);
  const { supplier, range } = readFilters(toParams(search), deliveries);
  return (
    <ListView
      deliveries={filterDeliveries(deliveries, today, supplier, range)}
      filtered={supplier !== "all" || range !== "all"}
      linkOrders={linkOrders}
    />
  );
}
