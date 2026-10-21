import { describe, expect, it } from "vitest";
import { parseContractBirthDate, resolveContractBirthDate, resolvePreviewBirthDate } from "./contract-birth-date";

describe("parseContractBirthDate", () => {
  it("preserves ISO calendar fields without applying the source timezone", () => {
    expect(parseContractBirthDate("2000-02-29T23:30:00-07:00")).toEqual({
      day: "29", month: "02", year: "2000", display: "29/02/2000",
    });
    expect(parseContractBirthDate("1999-01-02")).toMatchObject({ display: "02/01/1999" });
  });

  it("accepts strict dd/mm/yyyy input", () => {
    expect(parseContractBirthDate("2/1/1999")).toEqual({
      day: "02", month: "01", year: "1999", display: "02/01/1999",
    });
  });

  it.each(["29/02/2025", "31/04/2000", "2999-01-01", "not-a-date", ""])("rejects impossible or future DOB %s", (value) => {
    expect(parseContractBirthDate(value)).toBeNull();
  });
});

describe("resolveContractBirthDate", () => {
  const primary = { id: "customer-1", birthDate: "2000-02-29" };

  it("uses the valid current primary customer DOB before its snapshot", () => {
    expect(resolveContractBirthDate({
      customerId: "customer-1",
      customer: primary,
      customerSnapshot: { id: "customer-1", birthDate: "1999-01-01" },
    })).toMatchObject({ display: "29/02/2000" });
  });

  it("uses a snapshot only when the current primary DOB is missing and identity matches", () => {
    expect(resolveContractBirthDate({
      customerId: "customer-1",
      customer: { id: "customer-1", birthDate: "" },
      customerSnapshot: { id: "customer-1", birthDate: "02/01/1999" },
    })).toMatchObject({ display: "02/01/1999" });
  });

  it("fails closed for a nonblank invalid current DOB instead of falling back", () => {
    expect(resolveContractBirthDate({
      customerId: "customer-1",
      customer: { id: "customer-1", birthDate: "31/04/2000" },
      customerSnapshot: { id: "customer-1", birthDate: "2000-02-29" },
    })).toBeNull();
  });

  it("rejects a snapshot belonging to another customer", () => {
    expect(resolveContractBirthDate({
      customerId: "customer-1",
      customer: { id: "customer-1", birthDate: "" },
      customerSnapshot: { id: "customer-2", birthDate: "2000-02-29" },
    })).toBeNull();
  });

  it("accepts a snapshot only when it matches the local primary customer id", () => {
    expect(resolveContractBirthDate({
      customer: { id: "customer-1", birthDate: "" },
      customerSnapshot: { id: "customer-1", birthDate: "2000-02-29" },
    })).toMatchObject({ display: "29/02/2000" });
    expect(resolveContractBirthDate({
      customerId: "customer-1",
      customer: { id: "merged-representative", birthDate: "2000-02-29" },
      customerSnapshot: { id: "customer-1", birthDate: "1999-01-01" },
    })).toBeNull();
  });
});

describe("resolvePreviewBirthDate", () => {
  it("ignores placeholder ngaySinh and uses the valid primary DOB", () => {
    expect(resolvePreviewBirthDate({
      ngaySinh: "..........................",
      customerId: "customer-1",
      customer: { id: "customer-1", birthDate: "2000-02-29" },
      customerSnapshot: { id: "customer-1", birthDate: "1999-01-01" },
    })).toMatchObject({ display: "29/02/2000" });
  });

  it("normalizes local dd/mm input without a dayjs month/day swap", () => {
    expect(resolvePreviewBirthDate({ ngaySinh: "2/1/1999" })).toMatchObject({
      display: "02/01/1999",
    });
  });
});
