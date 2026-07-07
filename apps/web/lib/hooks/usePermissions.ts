import { useAuthStore } from '../auth/auth-store';

export const usePermissions = () => {
  const { user } = useAuthStore();
  const permissions = user?.permissions || [];

  return {
    canCreateBuilding: permissions.includes('building.create'),
    canReadBuilding: permissions.includes('building.read'),
    canUpdateBuilding: permissions.includes('building.update'),
    canDeleteBuilding: permissions.includes('building.delete'),
    
    canCreateFloor: permissions.includes('floor.create'),
    canReadFloor: permissions.includes('floor.read'),
    canUpdateFloor: permissions.includes('floor.update'),
    canDeleteFloor: permissions.includes('floor.delete'),
    
    canCreateRoom: permissions.includes('room.create'),
    canReadRoom: permissions.includes('room.read'),
    canUpdateRoom: permissions.includes('room.update'),
    canDeleteRoom: permissions.includes('room.delete'),

    hasPermission: (perm: string) => permissions.includes(perm),
  };
};
