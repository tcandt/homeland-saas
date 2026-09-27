import AppShell from "@/components/layout/AppShell";
import FinanceTransactionsWorkspace, {
  type FinanceTransactionView,
} from "@/components/finance/FinanceTransactionsWorkspace";

const validViews = new Set<FinanceTransactionView>([
  "unified",
  "bank",
  "reconciliation",
]);

export default async function FinanceTransactionsPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string }>;
}) {
  const params = await searchParams;
  const requestedView = params?.view as FinanceTransactionView | undefined;
  const initialView =
    requestedView && validViews.has(requestedView) ? requestedView : "unified";

  return (
    <AppShell>
      <FinanceTransactionsWorkspace initialView={initialView} />
    </AppShell>
  );
}
