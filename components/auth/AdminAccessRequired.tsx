import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui';

export function AdminAccessRequired({ label = 'This page' }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="max-w-md text-center">
        <CardHeader><CardTitle>Admin access required</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{label} is hidden for staff access.</p>
        </CardContent>
      </Card>
    </div>
  );
}
