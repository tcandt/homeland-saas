"use client";

import React, { useState } from "react";
import BuildingExplorerTree from "./BuildingExplorerTree";
import BuildingDetailPanel from "./BuildingDetailPanel";
import { Building, Floor, Room, Tenant, SharedTenant } from "./mockData";
import { useBuildingsQuery } from "@/lib/queries/buildings.queries";
import { useCreateBuildingMutation, useUpdateBuildingMutation, useDeleteBuildingMutation } from "@/lib/mutations/buildings.mutations";
import { useCreateFloorMutation, useUpdateFloorMutation, useDeleteFloorMutation } from "@/lib/mutations/floors.mutations";
import { useCreateRoomMutation, useUpdateRoomMutation, useDeleteRoomMutation } from "@/lib/mutations/rooms.mutations";
import { Loader2 } from "lucide-react";
import RoomPremiumModal from "./RoomPremiumModal";
import MobileBuildingsFlow from "./MobileBuildingsFlow";
import { Plus, X, Save, Trash2, Edit } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { toast } from "sonner";
import { useQueryClient } from '@tanstack/react-query';
import { usePermissions } from '@/lib/hooks/usePermissions';

export type NodeType = "building" | "floor" | "room";

export interface SelectedNode {
  type: NodeType;
  buildingId: string;
  floorId?: string;
  roomId?: string;
}

export default function MasterDetailBuildings() {
  // API Queries & Mutations
  const { data: buildings = [], isLoading } = useBuildingsQuery();
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

  const handleOpenEditBuilding = () => {
    if (!activeBuilding) return;
    setBName(activeBuilding.name);
    setBCode(activeBuilding.code || "");
    setBAddress(activeBuilding.address);
    setBNotes(activeBuilding.notes || "");
    setBStatus(activeBuilding.status);
    setActiveDialog("editBuilding");
  };

  const handleSaveBuilding = () => {
    if (!bName || !bAddress || !bCode) return;
    if (activeDialog === "addBuilding") {
      createBuilding.mutate({
        name: bName,
        code: bCode,
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
        data: { name: bName, code: bCode, address: bAddress, notes: bNotes, status: bStatus }
      }, {
        onSuccess: () => setActiveDialog(null)
      });
    }
  };

  const handleDeleteBuilding = (id: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa tòa nhà này cùng tất cả tầng và phòng?")) {
      deleteBuilding.mutate(id, {
        onSuccess: () => {
          // Fallback to first available building handled by useEffect
          setSelectedNode({ type: "building", buildingId: "" });
        }
      });
    }
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
          setSelectedNode({ type: "floor", buildingId: activeBuilding.id, floorId: data.id });
          setActiveDialog(null);
        }
      });
    }
  };

  const handleDeleteFloor = (floorId: string) => {
    if (!activeBuilding) return;
    if (confirm("Bạn có chắc chắn muốn xóa tầng này cùng toàn bộ các phòng bên trong?")) {
      deleteFloor.mutate(floorId, {
        onSuccess: () => setSelectedNode({ type: "building", buildingId: activeBuilding.id })
      });
    }
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
      capacity: rCapacity
    }, {
      onSuccess: (data) => {
        setSelectedNode({ 
          type: "room", 
          buildingId: activeBuilding.id, 
          floorId: dialogTargetFloorId, 
          roomId: data.id 
        });
        setActiveDialog(null);
      }
    });
  };

  const handleDeleteRoom = (roomId: string) => {
    if (!activeBuilding) return;
    if (confirm("Bạn có chắc chắn muốn xóa phòng này?")) {
      deleteRoom.mutate(roomId, {
        onSuccess: () => {
          const currentFloor = activeBuilding.floors.find((f: Floor) => f.rooms.some((r: Room) => r.id === roomId));
          if (currentFloor) {
            setSelectedNode({ type: "floor", buildingId: activeBuilding.id, floorId: currentFloor.id });
          } else {
            setSelectedNode({ type: "building", buildingId: activeBuilding.id });
          }
        }
      });
    }
  };

  // Sync Room Updates from Detail Drawer
  const handleUpdateRoom = (roomId: string, updatedRoomFields: Partial<Room>) => {
    updateRoom.mutate({ id: roomId, data: updatedRoomFields });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col lg:flex-row h-full w-full relative items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#6366f1] animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-full w-full relative">
      
      {/* -------------------- MOBILE VIEW -------------------- */}
      <div className="flex lg:hidden flex-col w-full">
        <MobileBuildingsFlow buildings={buildings} onOpenRoomModal={openRoomModal} />
      </div>

      {/* -------------------- DESKTOP VIEW -------------------- */}
      <div className="hidden lg:flex flex-row h-full gap-6 w-full relative">
        {/* Left Panel: Explorer Tree */}
      <div className="w-full lg:w-[280px] xl:w-[320px] shrink-0 h-auto lg:h-full flex flex-col bg-card/40 backdrop-blur-md border border-border/60 rounded-[16px] overflow-hidden shadow-sm">
        <div className="hidden lg:flex items-center justify-between p-4 border-b border-border/50 bg-black/[0.02] dark:bg-white/[0.02]">
          <h2 className="font-bold text-[12px] text-text uppercase tracking-widest">Danh mục tài sản</h2>
          {permissions.canCreateBuilding && (
            <button 
              data-testid="add-building-button"
              onClick={handleOpenAddBuilding}
              className="text-[#6366f1] hover:text-[#4f46e5] text-[11px] font-black uppercase tracking-wider flex items-center gap-0.5"
            >
              <Plus className="w-3 h-3" /> Thêm Tòa Nhà
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-hide p-3 max-h-[250px] lg:max-h-none">
          <BuildingExplorerTree 
            buildings={buildings} 
            selectedNode={selectedNode} 
            onSelectNode={setSelectedNode} 
          />
        </div>
      </div>

      {/* Right Panel: Detail Panel Dashboard & Grids */}
      <div className="flex-1 min-w-0 h-full flex flex-col bg-card border border-border/60 rounded-[20px] overflow-hidden shadow-sm relative mt-4 lg:mt-0">
        <BuildingDetailPanel 
          buildings={buildings}
          selectedNode={selectedNode}
          onSelectNode={setSelectedNode}
          onOpenRoomModal={openRoomModal}
          onEditBuilding={handleOpenEditBuilding}
          onAddFloor={handleOpenAddFloor}
          onAddRoomQuick={handleOpenAddRoomQuick}
          onAddRoom={handleOpenAddRoom}
          onEditRoom={(roomId) => openRoomModal(roomId, "overview")}
          onDeleteRoom={handleDeleteRoom}
          onAddTenant={(roomId) => openRoomModal(roomId, "rental_flow")}
          onCreateInvoice={(roomId) => openRoomModal(roomId, "finances")}
          onViewContract={(roomId) => openRoomModal(roomId, "rental_flow")}
          onUploadRoomImages={(roomId) => openRoomModal(roomId, "images")}
          onEditFloor={handleOpenEditFloor}
          onDeleteFloor={handleDeleteFloor}
        />
      </div>
      </div>

      {/* Custom Portalled components for dialog triggers */}
      <div className="hidden">
        {/* Helper to hook callbacks inside BuildingDetailPanel */}
        <BuildingViewWrapper 
          building={activeBuilding!}
          onSelectNode={setSelectedNode}
          onEditBuilding={handleOpenEditBuilding}
          onAddFloor={handleOpenAddFloor}
          onAddRoomQuick={handleOpenAddRoomQuick}
        />
      </div>

      {/* Room detail drawers */}
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
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-muted uppercase">Giá thuê</label>
                    <Input 
                      data-testid="room-price-input"
                      type="number" 
                      value={rPrice} 
                      onChange={(e) => setRPrice(Number(e.target.value))}
                    />
                  </div>
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
