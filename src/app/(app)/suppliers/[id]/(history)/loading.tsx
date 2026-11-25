import { HistorySkeleton } from "@/features/supplier-history/history-skeleton";

/** A history tab loading: the header and tab bar stay, the tab's table shows its shape until the data arrives. */
export default function Loading() {
  return <HistorySkeleton />;
}
