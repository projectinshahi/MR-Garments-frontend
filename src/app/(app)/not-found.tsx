import Link from "next/link";

import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";

// notFound() from any page in the app (an unknown PO or container) renders here, inside the shell.
export default function NotFound() {
  return (
    <EmptyState
      title="Not found"
      description="This record doesn't exist, or its link is wrong."
      action={
        <Button asChild variant="outline">
          <Link href="/orders">Go to Orders</Link>
        </Button>
      }
    />
  );
}
