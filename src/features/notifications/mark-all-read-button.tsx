"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { handleApiError } from "@/lib/feedback";

import { markAllRead } from "./notifications-client";

/** Header action: NTF-4, then the page and the bell show the new state. */
export function MarkAllReadButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await markAllRead();
            router.refresh();
          } catch (error) {
            handleApiError(error);
          }
        })
      }
    >
      Mark all as read
    </Button>
  );
}
