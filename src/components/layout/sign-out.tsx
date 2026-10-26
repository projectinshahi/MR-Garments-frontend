"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { apiClient } from "@/lib/api/client";
import { MESSAGES } from "@/lib/feedback";

// AUTH-2 sign-out (K2): end the session, then load /login fresh (a full load, not router.push) so no signed-in page
// stays mounted in memory, replacing the history entry so Back doesn't return to it. A failed request shows M26 and
// leaves the user where they are.

function useSignOut() {
  const [pending, setPending] = useState(false);
  const signOut = async () => {
    setPending(true);
    try {
      await apiClient.post("/auth/logout");
      window.location.replace("/login");
    } catch {
      toast.error(MESSAGES.signOutFailed);
      setPending(false);
    }
  };
  return { pending, signOut };
}

/** "Sign out" in the sidebar user menu. */
export function SignOutMenuItem() {
  const { pending, signOut } = useSignOut();
  return (
    <DropdownMenuItem disabled={pending} onSelect={() => void signOut()}>
      Sign out
    </DropdownMenuItem>
  );
}

/** "Sign out" as a button, as drawn on My profile (51). */
export function SignOutButton({ className }: { className?: string }) {
  const { pending, signOut } = useSignOut();
  return (
    <Button type="button" variant="outline" className={className} disabled={pending} onClick={() => void signOut()}>
      Sign out
    </Button>
  );
}
