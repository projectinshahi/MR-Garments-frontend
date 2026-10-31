"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DeleteOrderButton } from "@/features/orders/delete-order";
import { EditOrderDialog, type EditableOrder, type ItemOption } from "@/features/orders/edit-order-dialog";

/**
 * The order page's header actions: Delete and Edit order, as the server decided (D1, stage below 6 for Edit). Print
 * order stays hidden (D5: no Printable PO design). `?edit=1` (the orders list's Edit) opens the edit dialog on arrival;
 * reads useSearchParams, so it renders inside the order layout's <Suspense>.
 */
export function OrderDetailActions({
  order,
  supplier,
  items,
  canEdit,
  canDelete,
}: {
  order: EditableOrder;
  supplier: string;
  items: ItemOption[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const [editing, setEditing] = useState(false);
  // Only this order's own pages count: Activity keeps other visited orders mounted, hidden.
  const base = `/orders/${order.po}`;
  const here = pathname === base || pathname.startsWith(`${base}/`);
  const linked = here && params.get("edit") === "1";

  function closeEdit() {
    setEditing(false);
    // Only the URL changes (as Settings closes its dialogs), so a reload or Back doesn't open it again.
    if (linked) window.history.replaceState(null, "", pathname);
  }

  return (
    <>
      {canDelete ? <DeleteOrderButton po={order.po} supplier={supplier} /> : null}
      {canEdit ? (
        <>
          {/* On a phone the label shortens to "Edit", so the PO title isn't truncated; the name stays "Edit order". */}
          <Button aria-label="Edit order" onClick={() => setEditing(true)}>
            Edit<span className="max-sm:hidden"> order</span>
          </Button>
          <EditOrderDialog order={order} items={items} open={editing || linked} onClose={closeEdit} />
        </>
      ) : null}
    </>
  );
}
