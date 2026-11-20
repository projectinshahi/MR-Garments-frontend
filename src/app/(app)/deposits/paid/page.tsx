import { redirect } from "next/navigation";

// Paid order deposits are the Deposit Required milestones now (D11).
export default function PaidDepositsPage() {
  redirect("/supplier-ledger/milestones");
}
