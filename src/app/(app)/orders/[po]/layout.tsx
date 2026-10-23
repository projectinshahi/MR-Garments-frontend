import { OrderDetailFrame } from "@/features/order-detail/shared/order-detail-frame";
import { listOrderDetailPOs } from "@/features/order-detail/shared/queries";

// Orchestrator-owned frame for tabs a–i. Tab pages are owned by W1-order-detail-a and W1-order-detail-b.
export async function generateStaticParams() {
  return (await listOrderDetailPOs()).map((po) => ({ po }));
}

export default async function OrderDetailLayout({ children, params }: LayoutProps<"/orders/[po]">) {
  const { po } = await params;
  return <OrderDetailFrame po={po}>{children}</OrderDetailFrame>;
}
