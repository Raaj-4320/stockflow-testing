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

const ROLE_KEY = 'currentRole';
export const OPERATOR_ID_KEY = 'currentOperatorId';
export const OPERATOR_NAME_KEY = 'currentOperatorName';
export const ACCESS_UNLOCKED_KEY = 'accessUnlocked';
export const ACCESS_USER_EMAIL_KEY = 'accessUserEmail';

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

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const readStorage = (key: string): string => {
  if (!canUseStorage()) return '';
  try {
    return window.localStorage.getItem(key) || '';
  } catch {
    return '';
  }
};

const writeStorage = (key: string, value: string) => {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore storage failures and keep the session in memory-only callers
  }
};

const removeStorage = (key: string) => {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore storage failures
  }
};

const emitAccessUpdate = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('local-storage-update'));
};

export const getCurrentRole = (): AppRole => readStorage(ROLE_KEY) === 'operator' ? 'operator' : 'admin';

export const getCurrentOperatorId = (): string => readStorage(OPERATOR_ID_KEY);

export const getCurrentOperatorName = (): string => readStorage(OPERATOR_NAME_KEY);

export const isAccessUnlocked = (): boolean => readStorage(ACCESS_UNLOCKED_KEY) === '1';

export const isAccessUnlockedForUser = (email?: string | null): boolean => {
  if (!isAccessUnlocked()) return false;
  const currentEmail = String(email || '').trim().toLowerCase();
  const sessionEmail = readStorage(ACCESS_USER_EMAIL_KEY).trim().toLowerCase();
  return !!currentEmail && currentEmail === sessionEmail;
};

export const isAdmin = (): boolean => getCurrentRole() === 'admin';

export const setCurrentRole = (role: AppRole): AppRole => {
  writeStorage(ROLE_KEY, role);
  emitAccessUpdate();
  return role;
};

export const getCurrentAccessSession = (): { role: AppRole; operatorId?: string; operatorName?: string; userEmail?: string | null } | null => {
  if (!isAccessUnlocked()) return null;
  const role = getCurrentRole();
  const operatorId = getCurrentOperatorId();
  const operatorName = getCurrentOperatorName();
  const userEmail = readStorage(ACCESS_USER_EMAIL_KEY) || null;
  return {
    role,
    operatorId: operatorId || undefined,
    operatorName: operatorName || undefined,
    userEmail,
  };
};

export const setAccessSession = (session: { role: AppRole; operatorId?: string; operatorName?: string; userEmail?: string | null }) => {
  writeStorage(ACCESS_UNLOCKED_KEY, '1');
  writeStorage(ROLE_KEY, session.role);
  writeStorage(OPERATOR_ID_KEY, session.operatorId || '');
  writeStorage(OPERATOR_NAME_KEY, session.operatorName || '');
  writeStorage(ACCESS_USER_EMAIL_KEY, String(session.userEmail || '').trim().toLowerCase());
  emitAccessUpdate();
};

export const lockAccess = () => {
  removeStorage(ACCESS_UNLOCKED_KEY);
  removeStorage(ROLE_KEY);
  removeStorage(OPERATOR_ID_KEY);
  removeStorage(OPERATOR_NAME_KEY);
  emitAccessUpdate();
};

export const clearAccessSession = () => {
  lockAccess();
  removeStorage(ACCESS_USER_EMAIL_KEY);
  emitAccessUpdate();
};

export const installRoleTestHelpers = () => {
  if (typeof window === 'undefined') return;
  (window as any).__stockflowAccess = {
    getCurrentRole,
    setCurrentRole,
    setAccessSession,
    clearAccessSession,
    can,
  };
};

export const can = (permission: SimplePermission): boolean => {
  if (isAdmin()) return true;
  return operatorPermissions[permission] === true;
};
