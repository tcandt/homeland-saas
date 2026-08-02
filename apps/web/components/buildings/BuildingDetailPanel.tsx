"use client";

import React from "react";
import type { Building } from "./building.types";
import { SelectedNode } from "./MasterDetailBuildings";
import BuildingView from "./views/BuildingView";
import FloorView from "./views/FloorView";
import RoomView from "./views/RoomView";
import { Map, AlertTriangle, Layers, Edit, Trash2 } from "lucide-react";
import { Button } from "../ui/Button";
import { getRoomDisplayName } from "./building-labels";

interface Props {
  buildings: Building[];
  selectedNode: SelectedNode;
  onSelectNode: (node: SelectedNode) => void;
  onOpenRoomModal: (roomId: string, initialTab?: string) => void;
  onEditBuilding: () => void;
  onAddFloor: () => void;
  onAddRoomQuick: () => void;
  onAddRoom: (floorId: string) => void;
  onEditRoom: (roomId: string) => void;
  onDeleteRoom: (roomId: string) => void;
  onAddTenant: (roomId: string) => void;
  onCreateInvoice: (roomId: string) => void;
  onViewContract: (roomId: string) => void;
  onUploadRoomImages: (roomId: string) => void;
  onEditFloor: (floorId: string) => void;
  onDeleteFloor: (floorId: string) => void;
}

export default function BuildingDetailPanel({
  buildings,
  selectedNode,
  onSelectNode,
  onOpenRoomModal,
  onEditBuilding,
  onAddFloor,
  onAddRoomQuick,
  onAddRoom,
  onEditRoom,
  onDeleteRoom,
  onAddTenant,
  onCreateInvoice,
  onViewContract,
  onUploadRoomImages,
  onEditFloor,
  onDeleteFloor
}: Props) {
  const building = buildings.find(b => b.id === selectedNode.buildingId);
  if (!building) return <div className="p-8 text-center text-muted">Building not found</div>;

  const renderHeader = () => {
    if (selectedNode.type === "building") {
      return null; // Header is now rendered inside BuildingView
    }
    if (selectedNode.type === "floor") {
      const floor = building.floors.find(f => f.id === selectedNode.floorId);
      return (
        <div className="flex flex-col border-b border-border/50 p-6 bg-black/[0.01] dark:bg-white/[0.01]">
          <div className="flex items-center gap-2 text-[11px] font-bold text-muted mb-2 uppercase tracking-widest cursor-pointer" onClick={() => onSelectNode({ type: "building", buildingId: building.id })}>
             <span className="hover:text-text transition-colors">{building.name}</span> /
          </div>
          <h2 className="font-black text-[22px] text-text flex items-center gap-3">
             <div className="w-[36px] h-[36px] rounded-[10px] bg-[#6366f1]/10 text-[#6366f1] flex items-center justify-center"><Layers size={18} /></div>
             Sơ đồ Tầng {floor?.number}
          </h2>
        </div>
      );
    }
    if (selectedNode.type === "room") {
      const floor = building.floors.find(f => f.id === selectedNode.floorId);
      const room = floor?.rooms.find(r => r.id === selectedNode.roomId);
      return (
        <div className="flex flex-col border-b border-border/50 p-6 bg-black/[0.01] dark:bg-white/[0.01] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-[#6366f1]/5 rounded-full blur-[40px] -z-10" />
          <div className="flex items-center gap-2 text-[11px] font-bold text-muted mb-2 uppercase tracking-widest cursor-pointer">
             <span className="hover:text-text transition-colors" onClick={() => onSelectNode({ type: "building", buildingId: building.id })}>{building.name}</span> / 
             <span className="hover:text-text transition-colors ml-1" onClick={() => onSelectNode({ type: "floor", buildingId: building.id, floorId: floor?.id })}>Tầng {floor?.number}</span> /
          </div>
          <div className="flex items-center justify-between">
            <h2 className="font-black text-[28px] text-text tracking-tighter">Phòng P.{getRoomDisplayName(room)}</h2>
            <Button 
              onClick={() => room && onOpenRoomModal(room.id)}
              className="shadow-[0_4px_14px_0_rgb(99,102,241,0.39)] hover:shadow-lg"
            >
              Quản lý chi tiết phòng
            </Button>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col w-full h-full">
      {renderHeader()}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-6 md:p-8 relative">
        {selectedNode.type === "building" && (
          <BuildingView 
            building={building} 
            buildings={buildings}
            onSelectNode={onSelectNode}
            onEditBuilding={onEditBuilding}
            onAddFloor={onAddFloor}
            onAddRoomQuick={onAddRoomQuick}
            onOpenRoomModal={onOpenRoomModal}
            onEditFloor={onEditFloor}
            onDeleteFloor={onDeleteFloor}
            onAddRoom={onAddRoom}
            onDeleteRoom={onDeleteRoom}
          />
        )}
        {selectedNode.type === "floor" && (
          <FloorView 
            building={building} 
            floorId={selectedNode.floorId!} 
            onSelectNode={onSelectNode} 
            onOpenRoomModal={onOpenRoomModal}
            onAddRoom={onAddRoom}
            onEditRoom={onEditRoom}
            onDeleteRoom={onDeleteRoom}
            onAddTenant={onAddTenant}
            onCreateInvoice={onCreateInvoice}
            onViewContract={onViewContract}
            onUploadRoomImages={onUploadRoomImages}
            onEditFloor={onEditFloor}
            onDeleteFloor={onDeleteFloor}
          />
        )}
        {selectedNode.type === "room" && (
          <RoomView 
            building={building} 
            floorId={selectedNode.floorId!} 
            roomId={selectedNode.roomId!} 
            onOpenRoomModal={onOpenRoomModal} 
          />
        )}
      </div>
    </div>
  );
}
