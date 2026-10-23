"use client";

import { ErrorState } from "@/components/shared/states";

export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorState description="This page failed to load." onRetry={retry} />;
}
