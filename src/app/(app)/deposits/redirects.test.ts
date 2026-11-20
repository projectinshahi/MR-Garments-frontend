import { describe, expect, it, vi } from "vitest";

import SupplierAdvanceDetailPage from "./advance/[supplierId]/page";
import SupplierAdvancePage from "./advance/page";
import DepositsPage from "./page";
import PaidDepositsPage from "./paid/page";
import PendingDepositsPage from "./pending/page";
import SupplierStatementPage from "./suppliers/[supplierId]/page";
import DepositSuppliersPage from "./suppliers/page";

// The unified supplier ledger (D14) replaced the Deposits pages: every old address redirects, so old links keep working.
const redirect = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ redirect }));

type Props<T> = { params: Promise<T>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const props = <T,>(params: T, search: Record<string, string> = {}) => ({ params: Promise.resolve(params), searchParams: Promise.resolve(search) }) as Props<T> as never;

describe("old /deposits addresses", () => {
  it("send the lists to the supplier ledger and the order deposits to the milestones", async () => {
    DepositsPage();
    DepositSuppliersPage();
    await SupplierAdvancePage(props({}));
    PendingDepositsPage();
    PaidDepositsPage();
    expect(redirect.mock.calls.map((call) => call[0])).toEqual(["/supplier-ledger", "/supplier-ledger", "/supplier-ledger", "/supplier-ledger/milestones", "/supplier-ledger/milestones"]);
  });

  it("send a supplier's advance or statement page to its ledger (and the older ?supplier= address too)", async () => {
    redirect.mockClear();
    await SupplierAdvanceDetailPage(props({ supplierId: "s1" }));
    await SupplierStatementPage(props({ supplierId: "s2" }));
    await SupplierAdvancePage(props({}, { supplier: "s3" }));
    expect(redirect.mock.calls.map((call) => call[0])).toEqual(["/supplier-ledger/s1", "/supplier-ledger/s2", "/supplier-ledger/s3"]);
  });
});
