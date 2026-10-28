import { Suspense } from "react";

import { LoadingState } from "@/components/shared/states";
import { OrderDetailFrame } from "@/features/order-detail/shared/order-detail-frame";

// Any PO, known only at request time (ORD-4): params stay behind Suspense, so the build prerenders just the shell.
export default function OrderDetailLayout({ children, params }: LayoutProps<"/orders/[po]">) {
  return (
    <Suspense fallback={<LoadingState />}>
      <OrderDetailFrame params={params}>{children}</OrderDetailFrame>
    </Suspense>
  );
}
