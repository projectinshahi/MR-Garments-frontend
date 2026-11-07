import Link from "next/link";

import { LinkPending } from "@/components/layout/navigation-progress";
import { cn } from "@/lib/utils";

const focusRing = "rounded-sm font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/** The order's detail page. The PO is encoded, so one with a slash (MR/2026/001) stays a single path segment. */
export const orderHref = (po: string) => `/orders/${encodeURIComponent(po)}`;

/**
 * A PO number. It opens the order's detail page (ORD-4) when `linked`, which callers set from
 * `canOpen(me, "/orders")`; otherwise it is plain text, so users without Orders access never reach a refused page.
 */
export function PoLink({ po, linked, className }: { po: string; linked: boolean; className?: string }) {
  if (!linked) return <span className={cn("font-bold", className)}>{po}</span>;
  return (
    <Link href={orderHref(po)} className={cn(focusRing, "hover:underline", className)}>
      {po}
      <LinkPending />
    </Link>
  );
}
