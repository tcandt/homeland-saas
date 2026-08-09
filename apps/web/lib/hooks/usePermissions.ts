import { useAuthStore } from '../auth/auth-store';

export const usePermissions = () => {
  const { user } = useAuthStore();
  const permissions = user?.permissions || [];
  const hasPermission = (perm: string) => permissions.includes(perm);
  const hasPermissionOrLegacy = (perm: string, legacyPerm: string) => hasPermission(perm) || hasPermission(legacyPerm);

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

    canReadFinance: hasPermission('finance.read'),
    canCreateExpense: hasPermission('finance.create'),
    canApproveExpense: hasPermissionOrLegacy('finance.approve', 'finance.update'),
    canPayExpense: hasPermissionOrLegacy('finance.pay', 'finance.update'),
    canSettleExpense: hasPermissionOrLegacy('finance.settle', 'finance.update'),
    canExportFinance: hasPermissionOrLegacy('finance.export', 'finance.read'),
    canReadOwnerProfit: hasPermissionOrLegacy('finance.ownerProfit.read', 'finance.read'),
    canReadExpenseAttachment: hasPermissionOrLegacy('finance.attachment.read', 'finance.read'),

    hasPermission,
  };
};
