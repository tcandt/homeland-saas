import { redirect } from "next/navigation";

export default function LegacyFinanceReconciliationPage() {
  redirect("/finance/transactions?view=reconciliation");
}
