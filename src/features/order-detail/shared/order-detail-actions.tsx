"use client";

import { notInPrototype } from "@/components/shared/prototype";
import { Button } from "@/components/ui/button";

// D5: neither action has a reference design (the Printable PO reference is missing).
export function OrderDetailActions() {
  return (
    <>
      <Button variant="outline" onClick={() => notInPrototype("Print order")}>
        Print order
      </Button>
      <Button onClick={() => notInPrototype("Edit order")}>Edit order</Button>
    </>
  );
}
