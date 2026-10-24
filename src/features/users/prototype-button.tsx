"use client";

import { notInPrototype } from "@/components/shared/prototype";
import { Button } from "@/components/ui/button";

/** A button from the reference whose action has no design (D5). */
export function PrototypeButton({ action, ...props }: React.ComponentProps<typeof Button> & { action: string }) {
  return <Button type="button" onClick={() => notInPrototype(action)} {...props} />;
}
