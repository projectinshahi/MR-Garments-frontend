import type { JourneyStep } from "@/components/shared/timeline";
import type { OrderView } from "@/features/order-detail/data/queries";
import { formatShortDate } from "@/lib/formatters";
import { STAGES } from "@/types/domain";

/**
 * "Journey of this order": the six stages, with the dates ORD-4 records (order date, first receipt, first loading).
 * A received order (stage 6) shows every step checked, as in 06; otherwise reached stages are dots and the rest rings
 * (the shared Journey draws its line for those two marker sets).
 */
export function journeySteps(order: Pick<OrderView, "stage" | "orderDate" | "receipts" | "containers">): JourneyStep[] {
  const receipt = order.receipts?.[0];
  const container = order.containers?.find((c) => c.loadedOn);
  const lines: Record<number, string[]> = {
    1: [formatShortDate(order.orderDate)],
    2: receipt ? [formatShortDate(receipt.receivedOn), receipt.office] : [],
    3: container?.loadedOn ? [formatShortDate(container.loadedOn), `${container.number} · ${container.agent.name}`] : [],
  };
  return STAGES.map((name, index) => {
    const stage = index + 1;
    return {
      title: `${stage}. ${name}`,
      lines: lines[stage] ?? [],
      marker: order.stage === 6 ? "check" : stage <= order.stage ? "dot" : "ring",
    };
  });
}
