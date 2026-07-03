export function usePermissions() {
  return {
    permissions: [],
    hasPermission: (permission: string) => true,
    hasAnyPermission: (permissions: string[]) => true,
    hasAllPermissions: (permissions: string[]) => true,
  };
}
