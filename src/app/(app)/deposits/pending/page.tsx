import { redirect } from "next/navigation";

// Pending order deposits are the Deposit Required milestones now (D11).
export default function PendingDepositsPage() {
  redirect("/supplier-ledger/milestones");
}
