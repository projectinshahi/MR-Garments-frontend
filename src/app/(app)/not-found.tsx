import Link from "next/link";

import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { canOpen } from "@/config/navigation";
import { getMe } from "@/lib/session";

// notFound() from any page in the app (an unknown PO or container) renders here, inside the shell. Users who can't
// open Orders (staff) go back to their own landing page instead, which the proxy would send them to anyway.
export default async function NotFound() {
  const me = await getMe();
  const orders = !me || canOpen(me, "/orders");
  return (
    <EmptyState
      title="Not found"
      description="This record doesn't exist, or its link is wrong."
      action={
        <Button asChild variant="outline">
          {orders ? <Link href="/orders">Go to Orders</Link> : <Link href={me.landing}>Go to your home page</Link>}
        </Button>
      }
    />
  );
}
