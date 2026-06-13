export type AppRole = 'admin' | 'operator';

export type SimplePermission =
  | 'inventoryBuyPrice'
  | 'analytics'
  | 'reports'
  | 'cashbook'
  | 'purchases'
  | 'freight'
  | 'settings'
  | 'transactionEdit'
  | 'transactionDelete'
  | 'cashWithdrawal';

const STORAGE_KEY = 'currentRole';

const operatorPermissions: Record<SimplePermission, boolean> = {
  inventoryBuyPrice: false,
  analytics: false,
  reports: false,
  cashbook: false,
  purchases: false,
  freight: false,
  settings: false,
  transactionEdit: false,
  transactionDelete: false,
  cashWithdrawal: false,
};

export const getCurrentRole = (): AppRole => {
  if (typeof window === 'undefined') return 'admin';
  try {
    const role = window.localStorage.getItem(STORAGE_KEY);
    return role === 'operator' || role === 'admin' ? role : 'admin';
  } catch {
    return 'admin';
  }
};

export const isAdmin = (): boolean => getCurrentRole() === 'admin';

export const setCurrentRole = (role: AppRole): AppRole => {
  if (typeof window === 'undefined') return role;
  window.localStorage.setItem(STORAGE_KEY, role);
  window.dispatchEvent(new CustomEvent('stockflow-role-change', { detail: { role } }));
  console.info(`[StockFlow] Role switched to ${role}. Reloading to apply UI permissions.`);
  window.setTimeout(() => window.location.reload(), 50);
  return role;
};

export const installRoleTestHelpers = () => {
  if (typeof window === 'undefined') return;
  const target = window as typeof window & { setRole?: (role: AppRole) => AppRole; getRole?: () => AppRole };
  target.setRole = (role: AppRole) => {
    if (role !== 'admin' && role !== 'operator') {
      throw new Error('Role must be "admin" or "operator".');
    }
    return setCurrentRole(role);
  };
  target.getRole = () => getCurrentRole();
};

export const can = (permission: SimplePermission): boolean => {
  const role = getCurrentRole();
  if (role === 'admin') return true;
  return operatorPermissions[permission] === true;
};
