import Link from "next/link";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

import type { OrdersListData } from "./data/queries";
import { OrdersList } from "./orders-list";

/** Orders list (05_3_Orders_list.jpeg): header with "+ New order", filter row, and the paginated orders table. */
export function OrdersScreen({ data }: { data: OrdersListData }) {
  return (
    <>
      <PageHeader
        title="Orders"
        actions={
          <Button asChild size="header">
            <Link href="/orders/new">+ New order</Link>
          </Button>
        }
      />
      <PageContainer>
        <OrdersList {...data} />
      </PageContainer>
    </>
  );
}
