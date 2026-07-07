"use client";

import React, { useState } from "react";
import { ChevronRight, ChevronDown, Building2, Layers, DoorOpen } from "lucide-react";
import { Building, Floor, Room } from "./mockData";
import { SelectedNode } from "./MasterDetailBuildings";

interface Props {
  buildings: Building[];
  selectedNode: SelectedNode;
  onSelectNode: (node: SelectedNode) => void;
}

export default function BuildingExplorerTree({ buildings, selectedNode, onSelectNode }: Props) {
  if (buildings.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted italic" data-testid="empty-buildings-state">
        Chưa có tòa nhà nào
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {buildings.map(building => (
        <BuildingNode 
          key={building.id} 
          building={building} 
          selectedNode={selectedNode} 
          onSelectNode={onSelectNode} 
        />
      ))}
    </div>
  );
}

function BuildingNode({ building, selectedNode, onSelectNode }: { building: Building, selectedNode: SelectedNode, onSelectNode: (node: SelectedNode) => void }) {
  const isSelected = selectedNode.type === "building" && selectedNode.buildingId === building.id;
  // Auto-expand if a child is selected
  const isActiveHierarchy = selectedNode.buildingId === building.id;
  const [isExpanded, setIsExpanded] = useState(isActiveHierarchy);

  return (
    <div className="flex flex-col">
      <div 
        data-testid={`building-node-${building.id}`}
        className={`flex items-center gap-2 px-2 py-2 rounded-[8px] cursor-pointer transition-colors ${isSelected ? 'bg-[#6366f1]/10 text-[#6366f1]' : 'hover:bg-black/5 dark:hover:bg-white/5 text-text'}`}
        onClick={() => {
          onSelectNode({ type: "building", buildingId: building.id });
          setIsExpanded(true);
        }}
      >
        <button 
          className="w-[20px] h-[20px] flex items-center justify-center text-muted hover:bg-black/10 dark:hover:bg-white/10 rounded"
          onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <Building2 size={16} className={isSelected ? 'text-[#6366f1]' : 'text-muted'} />
        <span className={`text-[13px] font-bold truncate ${isSelected ? '' : ''}`}>{building.name}</span>
      </div>

      {isExpanded && (
        <div className="flex flex-col ml-[22px] border-l border-border/60 pl-2 mt-1 gap-1 animate-in fade-in slide-in-from-top-1 duration-200">
          {building.floors.map(floor => (
            <FloorNode 
              key={floor.id} 
              buildingId={building.id} 
              floor={floor} 
              selectedNode={selectedNode} 
              onSelectNode={onSelectNode} 
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FloorNode({ buildingId, floor, selectedNode, onSelectNode }: { buildingId: string, floor: Floor, selectedNode: SelectedNode, onSelectNode: (node: SelectedNode) => void }) {
  const isSelected = selectedNode.type === "floor" && selectedNode.floorId === floor.id;
  const isActiveHierarchy = selectedNode.floorId === floor.id || (selectedNode.roomId && floor.rooms.some(r => r.id === selectedNode.roomId));
  const [isExpanded, setIsExpanded] = useState(isActiveHierarchy);

  return (
    <div className="flex flex-col">
      <div 
        data-testid={`floor-node-${floor.id}`}
        className={`flex items-center gap-2 px-2 py-1.5 rounded-[6px] cursor-pointer transition-colors ${isSelected ? 'bg-[#6366f1]/10 text-[#6366f1]' : 'hover:bg-black/5 dark:hover:bg-white/5 text-text'}`}
        onClick={() => {
          onSelectNode({ type: "floor", buildingId, floorId: floor.id });
          setIsExpanded(true);
        }}
      >
        <button 
          className="w-[18px] h-[18px] flex items-center justify-center text-muted hover:bg-black/10 dark:hover:bg-white/10 rounded"
          onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
        >
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        <Layers size={14} className={isSelected ? 'text-[#6366f1]' : 'text-muted'} />
        <span className="text-[12px] font-semibold">Tầng {floor.number}</span>
        <span className="ml-auto text-[10px] font-bold text-muted bg-black/5 dark:bg-white/5 px-1.5 rounded">{floor.rooms.length}</span>
      </div>

      {isExpanded && (
        <div className="flex flex-col ml-[20px] border-l border-border/60 pl-2 mt-1 gap-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
          {floor.rooms.map(room => (
            <RoomNode 
              key={room.id} 
              buildingId={buildingId} 
              floorId={floor.id} 
              room={room} 
              selectedNode={selectedNode} 
              onSelectNode={onSelectNode} 
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RoomNode({ buildingId, floorId, room, selectedNode, onSelectNode }: { buildingId: string, floorId: string, room: Room, selectedNode: SelectedNode, onSelectNode: (node: SelectedNode) => void }) {
  const isSelected = selectedNode.type === "room" && selectedNode.roomId === room.id;
  
  const getStatusColor = (status: string) => {
    switch(status) {
      case "occupied": return "bg-[#10b981]";
      case "vacant": return "bg-[#ef4444]";
      case "expiring_soon": return "bg-[#f59e0b]";
      case "maintenance": return "bg-[#3b82f6]";
      default: return "bg-muted";
    }
  };

  return (
    <div 
      data-testid={`room-node-${room.id}`}
      className={`flex items-center gap-2 px-2 py-1.5 rounded-[6px] cursor-pointer transition-colors ${isSelected ? 'bg-[#6366f1]/10 text-[#6366f1]' : 'hover:bg-black/5 dark:hover:bg-white/5 text-text'}`}
      onClick={() => onSelectNode({ type: "room", buildingId, floorId, roomId: room.id })}
    >
      <div className="w-[18px] flex items-center justify-center">
        <div className={`w-2 h-2 rounded-full ${getStatusColor(room.status)} shadow-sm`} />
      </div>
      <DoorOpen size={13} className={isSelected ? 'text-[#6366f1]' : 'text-muted'} />
      <span className="text-[12px] font-medium">P.{room.name}</span>
    </div>
  );
}
