import { Suspense } from "react";

import { LoadingState } from "@/components/shared/states";
import { SupplierHistoryFrame } from "@/features/supplier-history/supplier-frame";

// The supplier profile's history tabs (Supplier 360°): one header, live balances and tab bar; any supplier id, known only
// at request time, so params stay behind Suspense and the build prerenders just the shell.
export default function SupplierHistoryLayout({ children, params }: LayoutProps<"/suppliers/[id]">) {
  return (
    <Suspense fallback={<LoadingState />}>
      <SupplierHistoryFrame params={params}>{children}</SupplierHistoryFrame>
    </Suspense>
  );
}
