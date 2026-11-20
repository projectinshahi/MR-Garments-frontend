import { redirect } from "next/navigation";

// The unified supplier ledger (D14) replaced the Deposits pages; old links keep working.
export default function DepositsPage() {
  redirect("/supplier-ledger");
}
