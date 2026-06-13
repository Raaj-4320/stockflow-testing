import React, { useMemo, useState } from 'react';
import { loadData } from '../../services/storage';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select } from '../ui';
import { getEffectiveAdminPin, OperatorUser, RoleSession } from '../../src/auth/permissions';

const nowSession = (session: Omit<RoleSession, 'loginAt'>): RoleSession => ({ ...session, loginAt: new Date().toISOString() });

export default function RoleLoginModal({ onLogin }: { onLogin: (session: RoleSession) => void }) {
  const data = loadData();
  const operators = useMemo(() => ((data.operatorUsers || []) as OperatorUser[]).filter((operator) => operator.active !== false), [data.operatorUsers]);
  const [accessType, setAccessType] = useState<'admin' | 'operator' | null>(null);
  const [password, setPassword] = useState('');
  const [operatorId, setOperatorId] = useState(operators[0]?.id || '');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const pwd = password.trim();
    if (accessType === 'admin') {
      if (pwd !== getEffectiveAdminPin(data.profile?.adminPin)) return setError('Admin password is incorrect.');
      onLogin(nowSession({ role: 'admin' }));
      return;
    }
    if (accessType === 'operator') {
      const operator = operators.find((item) => item.id === operatorId);
      if (!operator) return setError('Select an active operator.');
      if (pwd !== String(operator.password || '')) return setError('Operator password is incorrect.');
      onLogin(nowSession({ role: 'operator', operatorId: operator.id, operatorName: operator.name }));
    }
  };

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/80 p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl">
        <CardHeader>
          <CardTitle>Select Access Type</CardTitle>
          <p className="text-sm text-muted-foreground">Choose Admin for full access or Operator for restricted counter access.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button variant={accessType === 'admin' ? 'default' : 'outline'} onClick={() => { setAccessType('admin'); setError(null); setPassword(''); }}>Admin</Button>
            <Button variant={accessType === 'operator' ? 'default' : 'outline'} onClick={() => { setAccessType('operator'); setError(null); setPassword(''); }}>Operator</Button>
          </div>
          {accessType === 'operator' && (
            <div className="space-y-1">
              <Label>Select Operator</Label>
              <Select value={operatorId} onChange={(e) => setOperatorId(e.target.value)}>
                {operators.length === 0 && <option value="">No active operators</option>}
                {operators.map((operator) => <option key={operator.id} value={operator.id}>{operator.name}</option>)}
              </Select>
              {operators.length === 0 && <p className="text-xs text-amber-700">Login as Admin and add operators in Settings.</p>}
            </div>
          )}
          {accessType && (
            <div className="space-y-1">
              <Label>{accessType === 'admin' ? 'Admin Password' : 'Operator Password'}</Label>
              <Input type="password" autoFocus value={password} onChange={(e) => { setPassword(e.target.value); setError(null); }} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
            </div>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Button className="w-full" disabled={!accessType || (accessType === 'operator' && !operatorId)} onClick={submit}>Continue</Button>
        </CardContent>
      </Card>
    </div>
  );
}
