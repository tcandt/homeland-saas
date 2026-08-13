import { useAuthStore } from '../auth/auth-store';

export const usePermissions = () => {
  const { user } = useAuthStore();
  const isSystemAdmin = Boolean(user?.roles?.includes('ADMIN'));
  const permissions = user?.permissions || [];
  const hasPermission = (perm: string) => isSystemAdmin || permissions.includes(perm);
  const hasPermissionOrLegacy = (perm: string, legacyPerm: string) => hasPermission(perm) || hasPermission(legacyPerm);

  return {
    isSystemAdmin,
    canCreateBuilding: hasPermission('building.create'),
    canReadBuilding: hasPermission('building.read'),
    canUpdateBuilding: hasPermission('building.update'),
    canDeleteBuilding: hasPermission('building.delete'),
    
    canCreateFloor: hasPermission('floor.create'),
    canReadFloor: hasPermission('floor.read'),
    canUpdateFloor: hasPermission('floor.update'),
    canDeleteFloor: hasPermission('floor.delete'),
    
    canCreateRoom: hasPermission('room.create'),
    canReadRoom: hasPermission('room.read'),
    canUpdateRoom: hasPermission('room.update'),
    canDeleteRoom: hasPermission('room.delete'),

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
