import { getLinkedRental } from "./booking-conversion";

type ContractKpiRow = {
  status?: string | null;
  endDate?: string | Date | null;
  debt?: number | string | null;
  code?: string;
  purpose?: string;
  bookingConversion?: any;
  termsSnapshot?: any;
};

export function getOperationsContractKpiSummary(
  contracts: ContractKpiRow[],
  now = new Date(),
) {
  const total = contracts.length;
  const active = contracts.filter((contract) => contract.status === "ACTIVE").length;
  const expiring = contracts.filter((contract) => {
    if (contract.status === "EXPIRING") return true;
    if (!contract.endDate || contract.status !== "ACTIVE") return false;

    const daysLeft = (new Date(contract.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return daysLeft >= 0 && daysLeft <= 30;
  }).length;
  const pending = contracts.filter((contract) =>
    !getLinkedRental(contract) && ["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(contract.status || ""),
  ).length;
  const debt = contracts.filter(
    (contract) => Number(contract.debt || 0) > 0 && contract.status !== "TERMINATED",
  ).length;

  return { total, active, expiring, pending, debt };
}
