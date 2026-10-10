import { describe, expect, it } from "vitest";
import { getTenantContractProjection } from "../../components/tenants/TenantGrid.projection";

describe("TenantGrid bounded contract projection", () => {
  const activeRoom = { code: "A-101", building: { name: "Tòa A" } };
  const pendingRoom = { code: "B-202", building: { name: "Tòa B" } };

  it("prefers active room over pending contract and keeps pending visible separately", () => {
    const pending = { id: "draft-1", code: "HD-DRAFT", status: "DRAFT", room: pendingRoom };
    const active = { id: "active-1", status: "ACTIVE", room: activeRoom, debt: 700000 };
    const result = getTenantContractProjection({ occupancies: [] }, [pending, active]);

    expect(result.activeContract).toBe(active);
    expect(result.pendingContract).toBe(pending);
    expect(result.roomLabel).toBe("A-101");
    expect(result.buildingName).toBe("Tòa A");
  });

  it("uses open occupancy before a bounded pending room without promoting pending state", () => {
    const occupancyRoom = { code: "C-303", building: { name: "Tòa C" } };
    const pending = { id: "pending-1", code: "HD-PENDING", status: "PENDING_APPROVAL", room: pendingRoom };
    const result = getTenantContractProjection({ occupancies: [{ room: occupancyRoom }] }, [pending]);

    expect(result.activeContract).toBeNull();
    expect(result.pendingContract).toBe(pending);
    expect(result.roomLabel).toBe("C-303");
    expect(result.buildingName).toBe("Tòa C");
  });

  it("does not infer a current room from terminated contracts or legacy customer room fields", () => {
    const terminated = { id: "terminated-1", status: "TERMINATED", room: activeRoom };
    const result = getTenantContractProjection({ room: activeRoom, rooms: [activeRoom], occupancies: [] }, [terminated]);

    expect(result.activeContract).toBeNull();
    expect(result.pendingContract).toBeNull();
    expect(result.roomLabel).toBe("N/A");
    expect(result.buildingName).toBe("Chưa có tòa");
  });

  it.each(["DRAFT", "PENDING_APPROVAL", "APPROVED"])("displays the pending-only %s room without active rental fields", (status) => {
    const pending = { id: "pending-only", status, room: pendingRoom };
    const result = getTenantContractProjection({ occupancies: [] }, [pending]);

    expect(result.activeContract).toBeNull();
    expect(result.pendingContract).toBe(pending);
    expect(result.roomLabel).toBe("B-202");
    expect(result.buildingName).toBe("Tòa B");
  });
});
