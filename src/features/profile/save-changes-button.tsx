"use client";

import { notInPrototype } from "@/components/shared/prototype";
import { Button } from "@/components/ui/button";

/** Header primary action. Saving has no reference design, so it is not in the prototype (D5). */
export function SaveChangesButton() {
  return (
    // 34 px tall like size="header", with the 16 px side padding measured in 51_17.2.
    <Button size="header" className="px-4" onClick={() => notInPrototype("Save changes")}>
      Save changes
    </Button>
  );
}
