import { LoadingState } from "@/components/shared/states";

// Suspense boundary for the staff home, as the (app) group's loading.tsx gives every management page. Without it,
// TanStack Table's development-only Date.now() timing inside DataTable is reported as blocking the prerender.
export default function Loading() {
  return <LoadingState />;
}
