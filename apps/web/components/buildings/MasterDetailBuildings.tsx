"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import type { Building, Floor, Room } from "./building.types";
import { useBuildingsQuery } from "@/lib/queries/buildings.queries";
import { useCreateBuildingMutation, useUpdateBuildingMutation, useDeleteBuildingMutation } from "@/lib/mutations/buildings.mutations";
import { useCreateFloorMutation, useUpdateFloorMutation, useDeleteFloorMutation } from "@/lib/mutations/floors.mutations";
import { useCreateRoomMutation, useUpdateRoomMutation, useDeleteRoomMutation } from "@/lib/mutations/rooms.mutations";
import { Loader2, Save, Trash2 } from "lucide-react";

const RoomPremiumModal = dynamic(() => import("./RoomPremiumModal"), {
  ssr: false,
  loading: () => null,
});
import MobileBuildingsFlow from "./MobileBuildingsFlow";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { toast } from "sonner";
import { useQueryClient } from '@tanstack/react-query';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import BuildingCockpit from "./cockpit/BuildingCockpit";
import { normalizeBuildingCode } from "./cockpit/building-template-registry";
import { adaptBuildingForLK01_31, adaptBuildingGeneral } from "./workspace/lk01-31-data";

export type NodeType = "building" | "floor" | "room";

export interface SelectedNode {
  type: NodeType;
  buildingId: string;
  floorId?: string;
  roomId?: string;
}

function useBuildingsMobileBreakpoint() {
  const [isMobile, setIsMobile] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return isMobile;
}

export default function MasterDetailBuildings() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const isMobilePresentation = useBuildingsMobileBreakpoint();
  
  // API Queries & Mutations
  const { data: buildings = [], isLoading } = useBuildingsQuery();
  const mobileBuildings = React.useMemo(() => buildings.map((building: Building) => {
    const code = normalizeBuildingCode(building.code || building.name);
    if (code === "LK01-31") return adaptBuildingForLK01_31(building);
    if (code === "LK01-32") return adaptBuildingGeneral(building, "LK01-32", "LK01-32", "Khu đô thị An Phú, Phường Tân An, Buôn Ma Thuột");
    if (code === "LK08-24") return adaptBuildingGeneral(building, "LK08-24", "LK08-24", "Khu dân cư Him Lam, Quận 7, TP.HCM");
    if (code === "LK08-25") return adaptBuildingGeneral(building, "LK08-25", "LK08-25", "Khu dân cư Him Lam, Quận 7, TP.HCM");
    return building;
  }), [buildings]);
  const permissions = usePermissions();
  const createBuilding = useCreateBuildingMutation();
  const updateBuilding = useUpdateBuildingMutation();
  const deleteBuilding = useDeleteBuildingMutation();
  
  const createFloor = useCreateFloorMutation();
  const updateFloor = useUpdateFloorMutation();
  const deleteFloor = useDeleteFloorMutation();

  const createRoom = useCreateRoomMutation();
  const updateRoom = useUpdateRoomMutation();
  const deleteRoom = useDeleteRoomMutation();

  const [selectedNode, setSelectedNode] = useState<SelectedNode>({
    type: "building",
    buildingId: ""
  });

  // Default selection when buildings load
  React.useEffect(() => {
    if (buildings.length > 0 && !selectedNode.buildingId) {
      setSelectedNode({ type: "building", buildingId: buildings[0].id });
    }
  }, [buildings, selectedNode.buildingId]);



  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalRoomId, setModalRoomId] = useState<string | null>(null);
  const [modalInitialTab, setModalInitialTab] = useState<string>("overview");

  // CRUD states
  const [activeDialog, setActiveDialog] = useState<"addBuilding" | "editBuilding" | "addFloor" | "editFloor" | "addRoom" | null>(null);
  const [dialogTargetFloorId, setDialogTargetFloorId] = useState<string | null>(null);
  const [deleteConfirmState, setDeleteConfirmState] = useState<{ type: 'building' | 'floor' | null, id: string | null }>({ type: null, id: null });

  // Building form state
  const [bName, setBName] = useState("");
  const [bCode, setBCode] = useState("");
  const [bAddress, setBAddress] = useState("");
  const [bNotes, setBNotes] = useState("");
  const [bStatus, setBStatus] = useState<"active" | "inactive">("active");

  // Floor form state
  const [fNumber, setFNumber] = useState(1);
  const [fNotes, setFNotes] = useState("");

  // Room form state
  const [rName, setRName] = useState("");
  const [rCode, setRCode] = useState("");
  const [rPrice, setRPrice] = useState(5000000);
  const [rArea, setRArea] = useState(25);
  const [rCapacity, setRCapacity] = useState(2);
  const [rNotes, setRNotes] = useState("");

  // Handlers for room modal
  const openRoomModal = (roomId: string, initialTab: string = "overview") => {
    setModalRoomId(roomId);
    setModalInitialTab(initialTab);
    setIsModalOpen(true);
  };

  // Helper: Get active building/floor
  const activeBuilding = buildings.find((b: Building) => b.id === selectedNode.buildingId);

  // -------------------- BUILDINGS CRUD --------------------
  const handleOpenAddBuilding = () => {
    setBName("");
    setBCode("");
    setBAddress("");
    setBNotes("");
    setBStatus("active");
    setActiveDialog("addBuilding");
  };

  const handleOpenEditBuilding = (buildingCode: string) => {
    const normalizedCode = normalizeBuildingCode(buildingCode);
    const targetBuilding = buildings.find((building: Building) => (
      normalizeBuildingCode(building.code || building.name) === normalizedCode
    ));

    if (!targetBuilding) {
      toast.error(`Không tìm thấy tòa nhà ${buildingCode}`);
      return;
    }

    setSelectedNode({ type: "building", buildingId: targetBuilding.id });
    setBName(targetBuilding.name);
    setBCode(targetBuilding.code || "");
    setBAddress(targetBuilding.address);
    setBNotes(targetBuilding.notes || "");
    setBStatus(targetBuilding.status);
    setActiveDialog("editBuilding");
  };

  const handleSaveBuilding = () => {
    if (!bName || !bAddress) return;
    const code = bCode || bName.replace(/\s+/g, '-').toUpperCase();
    if (activeDialog === "addBuilding") {
      createBuilding.mutate({
        name: bName,
        code,
        address: bAddress,
        notes: bNotes,
        status: bStatus,
      }, {
        onSuccess: (data) => {
          setSelectedNode({ type: "building", buildingId: data.id });
          setActiveDialog(null);
        }
      });
    } else if (activeDialog === "editBuilding" && activeBuilding) {
      updateBuilding.mutate({
        id: activeBuilding.id,
        data: { name: bName, code, address: bAddress, notes: bNotes, status: bStatus }
      }, {
        onSuccess: () => setActiveDialog(null)
      });
    }
  };

  const handleDeleteBuilding = (id: string) => {
    setDeleteConfirmState({ type: 'building', id });
  };

  // -------------------- FLOORS CRUD --------------------
  const handleOpenAddFloor = () => {
    if (!activeBuilding) return;
    const nextFloorNum = activeBuilding.floors.length + 1;
    setFNumber(nextFloorNum);
    setFNotes("");
    setActiveDialog("addFloor");
  };

  const handleOpenEditFloor = (floorId: string) => {
    if (!activeBuilding) return;
    const floor = activeBuilding.floors.find((f: Floor) => f.id === floorId);
    if (!floor) return;
    setFNumber(floor.number);
    setFNotes(floor.notes || "");
    setDialogTargetFloorId(floorId);
    setActiveDialog("editFloor");
  };

  const handleSaveFloor = () => {
    if (!activeBuilding) return;

    if (activeDialog === "editFloor" && dialogTargetFloorId) {
      updateFloor.mutate({
        id: dialogTargetFloorId,
        data: { name: `Tầng ${fNumber}`, level: fNumber, usageNote: fNotes }
      }, {
        onSuccess: () => setActiveDialog(null)
      });
    } else {
      createFloor.mutate({
        buildingId: activeBuilding.id,
        name: `Tầng ${fNumber}`,
        level: fNumber,
        usageNote: fNotes
      }, {
        onSuccess: (data) => {
          setSelectedNode({ type: "building", buildingId: activeBuilding.id });
          const params = new URLSearchParams(searchParams.toString());
          params.set("floor", data.id);
          params.delete("room");
          router.push(`${pathname}?${params.toString()}`);
          setActiveDialog(null);
        }
      });
    }
  };

  const handleDeleteFloor = (floorId: string) => {
    if (!activeBuilding) return;
    setDeleteConfirmState({ type: 'floor', id: floorId });
  };

  // -------------------- ROOMS CRUD --------------------
  const handleOpenAddRoom = (floorId: string) => {
    setDialogTargetFloorId(floorId);
    setRName("");
    setRCode("");
    setRPrice(5000000);
    setRArea(25);
    setRCapacity(2);
    setRNotes("");
    setActiveDialog("addRoom");
  };

  const handleOpenAddRoomQuick = () => {
    if (!activeBuilding || activeBuilding.floors.length === 0) {
      alert("Vui lòng thêm tầng trước khi thêm phòng nhanh.");
      return;
    }
    handleOpenAddRoom(activeBuilding.floors[0].id);
  };

  const handleSaveRoom = () => {
    if (!activeBuilding || !dialogTargetFloorId || !rName || !rCode) return;
    
    createRoom.mutate({
      buildingId: activeBuilding.id,
      floorId: dialogTargetFloorId,
      name: rName,
      code: rCode,
      monthlyPrice: rPrice,
      area: rArea,
      capacity: rCapacity
    }, {
      onSuccess: (data) => {
        setSelectedNode({ type: "building", buildingId: activeBuilding.id });
        const params = new URLSearchParams(searchParams.toString());
        params.set("floor", dialogTargetFloorId);
        params.set("room", data.id);
        router.push(`${pathname}?${params.toString()}`);
        setActiveDialog(null);
      }
    });
  };

  const handleDeleteRoom = (roomId: string) => {
    if (!activeBuilding) return;
    if (confirm("Bạn có chắc chắn muốn xóa phòng này?")) {
      deleteRoom.mutate(roomId, {
        onSuccess: () => {
          setSelectedNode({ type: "building", buildingId: activeBuilding.id });
          const currentFloor = activeBuilding.floors.find((f: Floor) => f.rooms.some((r: Room) => r.id === roomId));
          const params = new URLSearchParams(searchParams.toString());
          if (currentFloor) {
            params.set("floor", currentFloor.id);
          } else {
            params.delete("floor");
          }
          params.delete("room");
          router.push(`${pathname}?${params.toString()}`);
          toast.success("Xóa phòng thành công");
          queryClient.invalidateQueries({ queryKey: ['buildings'] });
        }
      });
    }
  };

  // Sync Room Updates from Detail Drawer
  const handleUpdateRoom = (roomId: string, updatedRoomFields: Partial<Room>) => {
    return updateRoom.mutateAsync({ id: roomId, data: updatedRoomFields }).then(() => undefined);
  };

  if (isLoading || isMobilePresentation === null) {
    return (
      <div className="flex flex-col lg:flex-row h-full w-full relative items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#6366f1] animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-full w-full flex-col">
      {isMobilePresentation ? (
        <div className="mobile-page mobile-buildings-stable">
          <MobileBuildingsFlow buildings={mobileBuildings} onOpenRoomModal={openRoomModal} />
        </div>
      ) : (
        <BuildingCockpit
          buildings={buildings}
          onEditBuilding={handleOpenEditBuilding}
          onAddBuilding={handleOpenAddBuilding}
          onOpenRoomModal={openRoomModal}
        />
      )}

      {isModalOpen && modalRoomId && (
        <RoomPremiumModal 
          roomId={modalRoomId} 
          buildings={buildings}
          onClose={() => setIsModalOpen(false)} 
          onUpdateRoom={handleUpdateRoom}
          initialTab={modalInitialTab}
        />
      )}

      {/* -------------------- CRUD DIALOGS MODALS -------------------- */}
      {activeDialog && (
        <Modal 
          isOpen={!!activeDialog} 
          onClose={() => setActiveDialog(null)}
          title={
            activeDialog === "addBuilding" ? "Thêm tòa nhà mới" :
            activeDialog === "editBuilding" ? "Chỉnh sửa tòa nhà" :
            activeDialog === "addFloor" ? "Thêm tầng mới" :
            activeDialog === "editFloor" ? "Chỉnh sửa tầng" :
            "Thêm phòng mới"
          }
          footer={
            <div className="flex items-center justify-end gap-3 w-full">
              {activeDialog === "editBuilding" && permissions.canDeleteBuilding && (
                <Button 
                  variant="outline"
                  data-testid="delete-building-button"
                  onClick={() => {
                    handleDeleteBuilding(activeBuilding!.id);
                    setActiveDialog(null);
                  }}
                  className="text-danger border-danger/20 hover:bg-danger/10 mr-auto"
                >
                  <Trash2 size={16} className="mr-2" /> Xóa
                </Button>
              )}
              <Button variant="outline" onClick={() => setActiveDialog(null)}>
                Hủy bỏ
              </Button>
              <Button 
                data-testid="save-button"
                onClick={() => {
                  if (activeDialog === "addBuilding" || activeDialog === "editBuilding") handleSaveBuilding();
                  else if (activeDialog === "addFloor" || activeDialog === "editFloor") handleSaveFloor();
                  else if (activeDialog === "addRoom") handleSaveRoom();
                }}
                disabled={createBuilding.isPending || updateBuilding.isPending || createFloor.isPending || updateFloor.isPending || createRoom.isPending}
              >
                {(createBuilding.isPending || updateBuilding.isPending || createFloor.isPending || updateFloor.isPending || createRoom.isPending) ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />} 
                Lưu thông tin
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-4 py-2">
            {/* Building Form */}
            {(activeDialog === "addBuilding" || activeDialog === "editBuilding") && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted uppercase">Tên tòa nhà</label>
                  <Input 
                    data-testid="bname-input"
                    placeholder="VD: LK01.31 - Riverside House" 
                    value={bName} 
                    onChange={(e) => setBName(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted uppercase">Mã tòa nhà</label>
                  <Input 
                    data-testid="bcode-input"
                    placeholder="VD: BD-001" 
                    value={bCode} 
                    onChange={(e) => setBCode(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted uppercase">Địa chỉ chi tiết</label>
                  <Input 
                    data-testid="baddress-input"
                    placeholder="VD: 01 Đường Đào Trí, Quận 7, TP.HCM" 
                    value={bAddress} 
                    onChange={(e) => setBAddress(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted uppercase">Ghi chú vận hành</label>
                  <textarea 
                    placeholder="Ghi chú về bảo vệ, quy định tòa nhà..." 
                    value={bNotes} 
                    onChange={(e) => setBNotes(e.target.value)}
                    className="flex min-h-[80px] w-full rounded-xl border border-border bg-transparent px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted uppercase">Trạng thái vận hành</label>
                  <Select 
                    value={bStatus} 
                    onChange={(e) => setBStatus(e.target.value as "active" | "inactive")}
                    options={[
                      { label: "Đang hoạt động", value: "active" },
                      { label: "Tạm ngưng", value: "inactive" }
                    ]}
                  />
                </div>
              </div>
            )}

            {/* Floor Form */}
            {(activeDialog === "addFloor" || activeDialog === "editFloor") && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted uppercase">Tên Tầng / Số tầng</label>
                  <Input 
                    data-testid="floor-name-input"
                    type="number" 
                    value={fNumber} 
                    onChange={(e) => setFNumber(Number(e.target.value))}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted uppercase">Ghi chú / Mô tả tầng</label>
                  <Input 
                    placeholder="Mô tả đặc điểm căn hộ dịch vụ ở tầng này..." 
                    value={fNotes} 
                    onChange={(e) => setFNotes(e.target.value)}
                  />
                </div>
              </div>
            )}

            {activeDialog === "addRoom" && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-muted uppercase">Tên phòng</label>
                    <Input 
                      data-testid="room-name-input"
                      placeholder="VD: Phòng 101" 
                      value={rName} 
                      onChange={(e) => setRName(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-muted uppercase">Mã phòng</label>
                    <Input 
                      data-testid="room-code-input"
                      placeholder="VD: P101" 
                      value={rCode} 
                      onChange={(e) => setRCode(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-muted uppercase">Diện tích (m²)</label>
                    <Input 
                      type="number" 
                      value={rArea} 
                      onChange={(e) => setRArea(Number(e.target.value))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-muted uppercase">Sức chứa</label>
                    <Input 
                      data-testid="room-capacity-input"
                      type="number" 
                      value={rCapacity} 
                      onChange={(e) => setRCapacity(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted uppercase">Ghi chú</label>
                  <Input 
                    placeholder="Ghi chú về phòng..." 
                    value={rNotes} 
                    onChange={(e) => setRNotes(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      <Modal
        isOpen={deleteConfirmState.type !== null}
        onClose={() => setDeleteConfirmState({ type: null, id: null })}
        title={`Xác nhận xóa ${deleteConfirmState.type === 'building' ? 'tòa nhà' : 'tầng'}`}
        footer={
          <div className="flex gap-3 justify-end w-full">
            <Button variant="outline" onClick={() => setDeleteConfirmState({ type: null, id: null })}>
              Hủy
            </Button>
            <Button
              onClick={() => {
                if (deleteConfirmState.type === 'building') {
                  deleteBuilding.mutate(deleteConfirmState.id!, {
                    onSuccess: () => {
                      setSelectedNode({ type: "building", buildingId: "" });
                      setDeleteConfirmState({ type: null, id: null });
                    }
                  });
                } else if (deleteConfirmState.type === 'floor') {
                  deleteFloor.mutate(deleteConfirmState.id!, {
                    onSuccess: () => {
                      setSelectedNode({ type: "building", buildingId: activeBuilding?.id || "" });
                      setDeleteConfirmState({ type: null, id: null });
                    }
                  });
                }
              }}
              className="bg-rose-500 text-white hover:bg-rose-600"
              disabled={deleteBuilding.isPending || deleteFloor.isPending}
            >
              {deleteBuilding.isPending || deleteFloor.isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : <Trash2 size={16} className="mr-2" />}
              Xóa
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3 py-2">
          <p className="text-sm text-text font-medium">
            Bạn có chắc chắn muốn xóa {deleteConfirmState.type === 'building' ? "tòa nhà này cùng tất cả tầng và phòng" : "tầng này cùng toàn bộ các phòng bên trong"} không?
          </p>
          <p className="text-xs text-muted">
            Hành động này không thể hoàn tác. Toàn bộ dữ liệu liên quan sẽ bị xóa khỏi hệ thống.
          </p>
        </div>
      </Modal>
    </div>
  );
}

// Wrapper to wire events from building dashboard inside detail panel
function BuildingViewWrapper({
  building,
  onSelectNode,
  onEditBuilding,
  onAddFloor,
  onAddRoomQuick
}: {
  building: Building;
  onSelectNode: (node: SelectedNode) => void;
  onEditBuilding: () => void;
  onAddFloor: () => void;
  onAddRoomQuick: () => void;
}) {
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__onEditBuilding = onEditBuilding;
      (window as any).__onAddFloor = onAddFloor;
      (window as any).__onAddRoomQuick = onAddRoomQuick;
    }
  }, [onEditBuilding, onAddFloor, onAddRoomQuick]);
  return null;
}
