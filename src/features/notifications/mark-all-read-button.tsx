"use client";

import { notInPrototype } from "@/components/shared/prototype";
import { Button } from "@/components/ui/button";

/** Header action. Marking as read has no reference design, so it is not in the prototype (D5). */
export function MarkAllReadButton() {
  return (
    <Button variant="outline" onClick={() => notInPrototype("Mark all as read")}>
      Mark all as read
    </Button>
  );
}
