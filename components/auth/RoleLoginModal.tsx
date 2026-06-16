import React, { useState } from 'react';
import { loadData } from '../../services/storage';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '../ui';
import { OperatorUser, RoleSession } from '../../src/auth/permissions';
import { clearAccessSession } from '../../src/auth/simplePermissions';
import { hasConfiguredAdminAccessPin, verifyAdminAccessPassword } from '../../src/auth/accessPassword';

const nowSession = (session: Omit<RoleSession, 'loginAt'>): RoleSession => ({ ...session, loginAt: new Date().toISOString() });
const FAILED_ATTEMPT_COOLDOWN_MS = 1500;

export default function RoleLoginModal({ onLogin }: { onLogin: (session: RoleSession) => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nextAttemptAt, setNextAttemptAt] = useState(0);

  const submit = async () => {
    if (isSubmitting) return;
    const now = Date.now();
    if (now < nextAttemptAt) {
      setError('Please wait a moment before trying again.');
      return;
    }
    const rawPassword = password;
    const accessPin = rawPassword.trim();
    const freshData = loadData();
    const freshOperators = ((freshData.operatorUsers || []) as OperatorUser[]);
    setIsSubmitting(true);

    try {
      if (await verifyAdminAccessPassword(rawPassword, freshData.profile?.adminPin)) {
        onLogin(nowSession({ role: 'admin' }));
        return;
      }

      const matchingOperator = /^\d{6,8}$/.test(accessPin)
        ? freshOperators.find((operator) => String(operator.password || '').trim() === accessPin)
        : undefined;
      if (!matchingOperator || matchingOperator.active === false) {
        if (import.meta.env.DEV) {
          console.debug('[StockFlow access unlock] access password rejected', {
            hasConfiguredAdminPin: hasConfiguredAdminAccessPin(freshData.profile?.adminPin),
            operatorPinFormat: /^\d{6,8}$/.test(accessPin),
            matchedOperator: Boolean(matchingOperator),
            matchedOperatorActive: matchingOperator?.active !== false,
          });
        }
        setError('Access password did not match admin password or active operator PIN.');
        setNextAttemptAt(Date.now() + FAILED_ATTEMPT_COOLDOWN_MS);
        return;
      }

      onLogin(nowSession({ role: 'operator', operatorId: matchingOperator.id, operatorName: matchingOperator.name }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAccessSession = () => {
    clearAccessSession();
    setPassword('');
    setNextAttemptAt(0);
    setError('Access session was reset. Enter the current admin password or an active operator PIN.');
  };

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/80 p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl">
        <CardHeader>
          <CardTitle>Enter Access Password</CardTitle>
          <p className="text-sm text-muted-foreground">Enter the admin password or an active operator PIN to unlock this session.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Access Password</Label>
            <Input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
            />
            <p className="text-[11px] text-muted-foreground">Enter admin password or operator PIN.</p>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Button className="w-full" onClick={() => void submit()} disabled={isSubmitting}>{isSubmitting ? 'Checking…' : 'Unlock Access'}</Button>
          <button type="button" className="w-full text-center text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" onClick={resetAccessSession}>
            Reset access session
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
