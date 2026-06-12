import React from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '../ui';
import { PermissionKey, can } from '../../src/auth/permissions';
import { useRoleSession } from '../../src/auth/roleSession';

export function PermissionGuard({ permission, children, fallback }: { permission: PermissionKey; children: React.ReactNode; fallback?: React.ReactNode }) {
  const { session } = useRoleSession();
  if (can(session, permission)) return <>{children}</>;
  return <>{fallback || null}</>;
}

export function RestrictedPage({ permission, label }: { permission: PermissionKey; label: string }) {
  const { requestAdminOverride } = useRoleSession();
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="max-w-md text-center">
        <CardHeader><CardTitle>Admin access required</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{label} is hidden for operator accounts.</p>
          <Button onClick={() => void requestAdminOverride(`Admin password required to access ${label}.`)}>Admin password required</Button>
        </CardContent>
      </Card>
    </div>
  );
}
