import { AppShell } from "@/components/layout/app-shell";

// Role-specific exception to D6: the staff sidebar (reference 39). Batch 1: its items come from the user's grants (N-b).
export default function StaffLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
