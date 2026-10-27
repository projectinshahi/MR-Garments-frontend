"use client";

import { ErrorState } from "@/components/shared/states";

// Errors the route-group boundaries can't catch: a boundary never catches its own layout, so when the API is
// unreachable the (app) shell's GET /api/v1/me lands here. Same page as (app)/error.tsx (E13, M25), without the shell.
export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="flex min-h-svh">
      <ErrorState description="This page failed to load." onRetry={retry} />
    </main>
  );
}
