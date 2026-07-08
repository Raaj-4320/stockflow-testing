import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { RoleSession } from './permissions';
import { clearAccessSession, getCurrentAccessSession, setAccessSession } from './simplePermissions';
import AdminPasswordConfirmModal from '../../components/auth/AdminPasswordConfirmModal';
import { loadData } from '../../services/storage';
import { verifyAdminAccessPassword } from './accessPassword';
import { getCurrentUser } from '../../services/auth';

type RoleSessionContextValue = {
  session: RoleSession | null;
  setSession: (session: RoleSession | null) => void;
  logoutRole: () => void;
  requestAdminOverride: (message?: string) => Promise<boolean>;
};

const RoleSessionContext = createContext<RoleSessionContextValue | null>(null);

const getStoredRoleSession = (): RoleSession | null => {
  const session = getCurrentAccessSession();
  if (!session) return null;
  return {
    role: session.role,
    operatorId: session.operatorId,
    operatorName: session.operatorName,
    loginAt: new Date().toISOString(),
  };
};

export const RoleSessionProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSessionState] = useState<RoleSession | null>(getStoredRoleSession());
  const pendingResolveRef = useRef<((approved: boolean) => void) | null>(null);
  const [overrideMessage, setOverrideMessage] = useState<string | null>(null);

  const setSession = useCallback((next: RoleSession | null) => {
    if (!next) {
      clearAccessSession();
      setSessionState(null);
      return;
    }
    setAccessSession({
      role: next.role,
      operatorId: next.operatorId,
      operatorName: next.operatorName,
      userEmail: getCurrentUser(),
    });
    setSessionState(next);
  }, []);

  const logoutRole = useCallback(() => setSession(null), [setSession]);

  const closeOverride = useCallback((approved: boolean) => {
    const resolve = pendingResolveRef.current;
    pendingResolveRef.current = null;
    setOverrideMessage(null);
    resolve?.(approved);
  }, []);

  const requestAdminOverride = useCallback((message = 'Admin password required.') => {
    if (session?.role === 'admin') return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      pendingResolveRef.current = resolve;
      setOverrideMessage(message);
    });
  }, [session]);

  const verifyOverridePassword = useCallback(async (password: string) => {
    const data = loadData();
    return verifyAdminAccessPassword(password, data.profile?.adminPin);
  }, []);

  const value = useMemo(() => ({ session, setSession, logoutRole, requestAdminOverride }), [session, setSession, logoutRole, requestAdminOverride]);

  return (
    <RoleSessionContext.Provider value={value}>
      {children}
      {overrideMessage && (
        <AdminPasswordConfirmModal
          message={overrideMessage}
          verifyPassword={verifyOverridePassword}
          onConfirm={() => closeOverride(true)}
          onCancel={() => closeOverride(false)}
        />
      )}
    </RoleSessionContext.Provider>
  );
};

export const useRoleSession = () => {
  const ctx = useContext(RoleSessionContext);
  if (!ctx) throw new Error('useRoleSession must be used inside RoleSessionProvider');
  return ctx;
};
