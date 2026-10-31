import { hasAccess } from "@/config/navigation";
import type { Me } from "@/lib/api/types";

// D1 (docs/orders-users-contract.md): the capability decides, never the role name. Computed on the server from getMe()
// and passed to the client components as booleans.

/** Edit (ORD-5): ordersEdit >= Enter, as for placing an order. Delete (ORD-6): admin = Full. */
export function orderPermissions(me: Pick<Me, "permissions"> | null) {
  return { canEdit: !!me && hasAccess(me, "ordersEdit", "Enter"), canDelete: !!me && hasAccess(me, "admin", "Full") };
}

/** D2: nothing on an order can change once it reaches the warehouse (stage 6). */
export const isEditableStage = (stage: number) => stage < 6;
