import { formatShortDate } from "@/lib/formatters";

/** Due cell label: "26 Sep · late" for late orders, "1 Oct" otherwise (39_14_Staff_home.jpeg). */
export function dueLabel({ due, late }: { due: string; late: boolean }) {
  const date = formatShortDate(due);
  return late ? `${date} · late` : date;
}

/** Banner sub-line: "5 orders are waiting for you to record what was received in China." */
export function waitingSummary(count: number) {
  const subject = count === 1 ? "1 order is" : `${count} orders are`;
  return `${subject} waiting for you to record what was received in China.`;
}
