const ACTIVE_CONTRACT_STATUSES = new Set(["ACTIVE", "EXPIRING"]);
const VISIBLE_PENDING_CONTRACT_STATUSES = new Set(["APPROVED", "PENDING_APPROVAL", "DRAFT"]);
const PENDING_STATUS_PRIORITY: Record<string, number> = { APPROVED: 0, PENDING_APPROVAL: 1, DRAFT: 2 };

export function getTenantContractProjection(customer: any, contracts: any[]) {
  const activeContract = contracts.find((contract: any) => ACTIVE_CONTRACT_STATUSES.has(String(contract?.status || "").toUpperCase())) || null;
  const pendingContract = contracts
    .filter((contract: any) => VISIBLE_PENDING_CONTRACT_STATUSES.has(String(contract?.status || "").toUpperCase()))
    .sort((left: any, right: any) => (PENDING_STATUS_PRIORITY[String(left?.status || "").toUpperCase()] ?? 99) - (PENDING_STATUS_PRIORITY[String(right?.status || "").toUpperCase()] ?? 99))[0] || null;
  const openOccupancy = Array.isArray(customer?.occupancies) ? customer.occupancies.find((occupancy: any) => !occupancy?.leftAt) : null;
  const room = activeContract?.room || openOccupancy?.room || pendingContract?.room || null;
  return {
    activeContract,
    pendingContract,
    roomLabel: room?.name || room?.code || room?.number || "N/A",
    buildingName: room?.building?.name || "Chưa có tòa",
  };
}
