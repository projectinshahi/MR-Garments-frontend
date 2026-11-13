"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { ReportDownload } from "@/features/reports/report-actions";
import { describeFilters, type ReportFile, summarySection } from "@/features/reports/report-files";

import type { Delivery } from "./deliveries";
import { filterDeliveries, RANGE_OPTIONS, readFilters } from "./params";

// Delivery Calendar report download (backend docs/report-downloads.md): the deliveries still expected (CAL-1: orders
// at stages 1-2), due date first, for the URL's supplier and the List view's date range, as every calendar view
// filters them.

export function calendarFile(deliveries: Delivery[], filters: string, today: string): ReportFile {
  const count = (status: Delivery["status"]) => deliveries.filter((d) => d.status === status).length;
  return {
    title: "Delivery calendar",
    filename: `delivery-calendar-${today}`,
    filters,
    notes: ["Orders still to arrive in China (stages 1 and 2); item and quantity are the order's main line."],
    sections: [
      summarySection([
        ["Deliveries", deliveries.length],
        ["Late", count("late")],
        ["Due within 7 days", count("due-soon")],
        ["On track", count("on-track")],
      ]),
      {
        sheet: "Deliveries",
        title: "Deliveries",
        columns: [{ header: "Due date", date: true }, { header: "PO" }, { header: "Supplier" }, { header: "Item" }, { header: "Quantity" }, { header: "Unit" }, { header: "Status" }],
        rows: deliveries.map((d) => [d.due, d.po, d.supplier, d.item, d.quantity, d.unit, d.statusLabel]),
      },
    ],
  };
}

function Bound({ deliveries, today }: { deliveries: Delivery[]; today: string }) {
  const params = useSearchParams();
  const { supplier, range } = readFilters(params, deliveries);
  return (
    <ReportDownload
      file={() =>
        calendarFile(
          filterDeliveries(deliveries, today, supplier, range),
          describeFilters([supplier !== "all" && `Supplier: ${supplier}`, range !== "all" && `Date range: ${RANGE_OPTIONS.find((o) => o.value === range)?.label}`]),
          today,
        )
      }
    />
  );
}

/** The header's download; the URL filters are read inside Suspense, as the calendar's selects do. */
export function CalendarDownload(props: { deliveries: Delivery[]; today: string }) {
  return (
    <Suspense fallback={<ReportDownload file={() => calendarFile(props.deliveries, "No filters", props.today)} />}>
      <Bound {...props} />
    </Suspense>
  );
}
