import type { Metadata } from "next";
import Link from "next/link";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { getRecordReceipt } from "@/features/receiving/data/queries";
import { RecordReceiptScreen } from "@/features/receiving/record-receipt-screen";
import { MESSAGES } from "@/lib/feedback";

export const metadata: Metadata = { title: "Record receipt" };

export default async function RecordReceiptPage() {
  const data = await getRecordReceipt();
  // Receiving below Enter (for example View only): REC-2 would refuse, so say so instead of the error page.
  if (!data) {
    return (
      <>
        <PageHeader title="Record receipt" parent={{ label: "Receiving (China)", href: "/receiving" }} />
        <PageContainer>
          <EmptyState
            title={MESSAGES.noAccess}
            action={
              <Button asChild variant="outline">
                <Link href="/receiving">Back to Receiving</Link>
              </Button>
            }
          />
        </PageContainer>
      </>
    );
  }
  // The form takes its defaults once, and this page stays mounted between visits (Activity). Remount it when the REC-2
  // choices change (a saved receipt, an office or order added elsewhere): otherwise an office added after an empty
  // first visit shows in the list while the form still holds "" and refuses to save ("Choose an office.").
  const choices = [data.receipts.length, ...data.options.offices.map((o) => o.id), ...data.options.orders.map((o) => o.orderId)].join();
  return <RecordReceiptScreen key={choices} data={data} />;
}
