import { SALES_LEAD_STATUSES, type SalesLeadStatus } from "../api/sales.api";

export type SalesLeadListFilters = {
  search?: string;
  status?: SalesLeadStatus;
  sort?: "createdAt" | "updatedAt" | "name";
  order?: "asc" | "desc";
};

const sortableFields = new Set<SalesLeadListFilters["sort"]>([
  "createdAt",
  "updatedAt",
  "name",
]);

export function toSalesLeadListFilters(params: URLSearchParams): SalesLeadListFilters {
  const search = params.get("search")?.trim();
  const rawStatus = params.get("status")?.trim().toUpperCase();
  const rawSort = params.get("sort")?.trim();
  const rawOrder = params.get("order")?.trim();

  return {
    ...(search ? { search } : {}),
    ...(rawStatus && SALES_LEAD_STATUSES.includes(rawStatus as SalesLeadStatus)
      ? { status: rawStatus as SalesLeadStatus }
      : {}),
    ...(rawSort && sortableFields.has(rawSort as SalesLeadListFilters["sort"])
      ? { sort: rawSort as SalesLeadListFilters["sort"] }
      : {}),
    ...(rawOrder === "asc" || rawOrder === "desc" ? { order: rawOrder } : {}),
  };
}
