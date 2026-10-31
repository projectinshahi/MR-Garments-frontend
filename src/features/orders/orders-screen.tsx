import Link from "next/link";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

import type { OrdersListData } from "./data/queries";
import { OrdersList } from "./orders-list";

/**
 * Orders list (05_3_Orders_list.jpeg): header with "+ New order", filter row, and the paginated orders table.
 * "+ New order" and the rows' Edit show only to users who may place orders (ordersEdit >= Enter); Delete only with
 * admin Full (D1).
 */
export function OrdersScreen({ data, canEdit, canDelete }: { data: OrdersListData; canEdit: boolean; canDelete: boolean }) {
  return (
    <>
      <PageHeader
        title="Orders"
        actions={
          canEdit ? (
            <Button asChild size="header">
              <Link href="/orders/new">+ New order</Link>
            </Button>
          ) : undefined
        }
      />
      <PageContainer>
        <OrdersList {...data} canEdit={canEdit} canDelete={canDelete} />
      </PageContainer>
    </>
  );
}
