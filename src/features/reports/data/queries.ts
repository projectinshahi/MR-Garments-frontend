import { listSuppliers } from "@/lib/data/master";

import * as fixtures from "./fixtures";

export type {
  ContainerState,
  LateOrder,
  MonthCost,
  RecentDownload,
  ReceivedLine,
  ReportCard,
  SupplierPayment,
  TimelineContainer,
} from "./fixtures";

// Async and copied so a real API can replace the fixtures without changing the screens.
const copy = <T>(value: T): Promise<T> => Promise.resolve(structuredClone(value));

export type ReportsHubData = Awaited<ReturnType<typeof getReportsHub>>;

/** Reports hub: report cards, recent downloads, and the period and supplier filter options. */
export async function getReportsHub() {
  const suppliers = await listSuppliers();
  return copy({
    cards: fixtures.reportCards,
    recent: fixtures.recentDownloads,
    periods: fixtures.reportPeriods,
    suppliers: suppliers.map((s) => s.name),
  });
}

export type OrderStatusReport = typeof fixtures.orderStatus;
export const getOrderStatusReport = () => copy(fixtures.orderStatus);

export type DeliveriesPerDayReport = typeof fixtures.deliveriesPerDay;
export const getDeliveriesPerDayReport = () => copy(fixtures.deliveriesPerDay);

export const getOrderedVsReceivedReport = () => copy(fixtures.orderedVsReceived);

export type ContainersTimelineReport = typeof fixtures.containersTimeline;
export const getContainersTimelineReport = () => copy(fixtures.containersTimeline);

export type PaymentsPerSupplierReport = typeof fixtures.paymentsPerSupplier;
export const getPaymentsPerSupplierReport = () => copy(fixtures.paymentsPerSupplier);

export type LandedCostByMonthReport = typeof fixtures.landedCostByMonth;
export const getLandedCostByMonthReport = () => copy(fixtures.landedCostByMonth);
