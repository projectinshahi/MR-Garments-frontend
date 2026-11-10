import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { canOpen } from "@/config/navigation";
import { getSupplierPaymentDetail } from "@/features/reports/data/queries";
import { SupplierDetailScreen } from "@/features/reports/supplier-detail-screen";
import { getMe } from "@/lib/session";

// The list's edit dialog (settings-dialog.tsx `editHref`, a client module, so spelt out here on the server).
const editHref = (id: string) => `/suppliers?dialog=edit&id=${encodeURIComponent(id)}`;

export const metadata: Metadata = { title: "Supplier" };

/**
 * Suppliers › one supplier (the View action): the profile, the money summary and the orders, payments and products
 * lists of the supplier detail (RPT-5D), with the way back to the Suppliers list and Edit opening the list's dialog.
 * An unknown supplier renders the not-found page.
 */
export default async function SupplierPage({ params, searchParams }: PageProps<"/suppliers/[id]">) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const [page, me] = await Promise.all([getSupplierPaymentDetail(id, search), getMe()]);
  return (
    <SupplierDetailScreen
      page={page}
      linkPos={!!me && canOpen(me, "/orders")}
      parent={{ label: "Suppliers", href: "/suppliers" }}
      base={`/suppliers/${id}`}
      actions={
        <Button asChild variant="outline" size="header">
          <Link href={editHref(id)}>Edit supplier</Link>
        </Button>
      }
    />
  );
}
