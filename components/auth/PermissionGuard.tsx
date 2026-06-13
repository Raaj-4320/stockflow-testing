import React from 'react';
import { SimplePermission, can } from '../../src/auth/simplePermissions';
import { AdminAccessRequired } from './AdminAccessRequired';

export function PermissionGuard({ permission, children, fallback }: { permission: SimplePermission; children: React.ReactNode; fallback?: React.ReactNode }) {
  if (can(permission)) return <>{children}</>;
  return <>{fallback || null}</>;
}

export function RestrictedPage({ label }: { permission: SimplePermission; label: string }) {
  return <AdminAccessRequired label={label} />;
}
