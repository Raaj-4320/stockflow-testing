import React, { useEffect, useMemo, useState } from 'react';
import { auth } from '../../services/firebase';
import { loadData, updateStoreProfile } from '../../services/storage';
import { sendStaffOtp, verifyStaffOtp } from '../../services/staffOtp';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '../ui';
import { OperatorUser, RoleSession } from '../../src/auth/permissions';
import { clearAccessSession } from '../../src/auth/simplePermissions';
import { getAdminAccessDiagnostics, isAccessDebugEnabled, verifyAdminAccessPassword, verifyCurrentFirebasePassword } from '../../src/auth/accessPassword';

const nowSession = (session: Omit<RoleSession, 'loginAt'>): RoleSession => ({ ...session, loginAt: new Date().toISOString() });
const FAILED_ATTEMPT_COOLDOWN_MS = 1500;
const DEV_ACCESS_BYPASS_ENABLED = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEV_ACCESS_BYPASS === 'true';
const SIMPLE_ACCESS_MODE_ENABLED = String((import.meta as any).env?.VITE_SIMPLE_ACCESS_MODE || 'true').toLowerCase() !== 'false';
const AUTH_DEBUG_LOGS_ENABLED = String((import.meta as any).env?.VITE_DEBUG_AUTH_LOGS || 'false').toLowerCase() === 'true';
const DEFAULT_OTP_EXPIRY_SECONDS = 120;

const logAuthDebug = (event: string, payload: Record<string, unknown>) => {
  if (!AUTH_DEBUG_LOGS_ENABLED) return;
  console.log(event, payload);
};

const getOtpExpiryDeadline = (payload?: { expiresInSeconds?: number; expiresAt?: string; }) => {
  const expiresAtMs = payload?.expiresAt ? new Date(payload.expiresAt).getTime() : NaN;
  if (Number.isFinite(expiresAtMs)) return expiresAtMs;
  const expiresInSeconds = Number(payload?.expiresInSeconds);
  if (Number.isFinite(expiresInSeconds) && expiresInSeconds > 0) {
    return Date.now() + (expiresInSeconds * 1000);
  }
  return Date.now() + (DEFAULT_OTP_EXPIRY_SECONDS * 1000);
};

const formatCountdown = (remainingMs: number) => {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export default function RoleLoginModal({ onLogin }: { onLogin: (session: RoleSession) => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nextAttemptAt, setNextAttemptAt] = useState(0);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryFirebasePassword, setRecoveryFirebasePassword] = useState('');
  const [recoveryNewPin, setRecoveryNewPin] = useState('');
  const [recoveryConfirmPin, setRecoveryConfirmPin] = useState('');
  const [isRecovering, setIsRecovering] = useState(false);
  const [otpFlow, setOtpFlow] = useState<'choice' | 'verify'>('choice');
  const [pendingOtpRole, setPendingOtpRole] = useState<'admin' | 'staff' | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpNotice, setOtpNotice] = useState<string | null>(null);
  const [isOtpSubmitting, setIsOtpSubmitting] = useState(false);
  const [otpExpiresAtMs, setOtpExpiresAtMs] = useState<number | null>(null);
  const [otpRemainingMs, setOtpRemainingMs] = useState(DEFAULT_OTP_EXPIRY_SECONDS * 1000);
  const [otpExpired, setOtpExpired] = useState(false);

  const currentData = loadData();
  const activeOperators = useMemo(
    () => (((currentData.operatorUsers || []) as OperatorUser[]).filter((operator) => operator.active !== false)),
    [currentData.operatorUsers]
  );
  const accessDiagnostics = getAdminAccessDiagnostics(currentData.profile?.adminPin);
  const accessHelpText = accessDiagnostics.adminPinConfigured
    ? 'Enter ERP admin PIN or active operator PIN.'
    : 'Enter Firebase password or active operator PIN.';

  useEffect(() => {
    if (!otpExpiresAtMs) return;
    const tick = () => {
      const remaining = Math.max(0, otpExpiresAtMs - Date.now());
      setOtpRemainingMs(remaining);
      if (remaining <= 0) {
        setOtpExpired(true);
        setError((current) => current || 'OTP expired. Request a new OTP.');
      }
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [otpExpiresAtMs]);

  const enterAdmin = () => {
    setError(null);
    onLogin(nowSession({ role: 'admin' }));
  };

  const enterOperator = (operator: OperatorUser) => {
    setError(null);
    onLogin(nowSession({ role: 'operator', operatorId: operator.id, operatorName: operator.name }));
  };

  const finishStaffEntry = () => {
    const freshData = loadData();
    const firstActiveOperator = ((freshData.operatorUsers || []) as OperatorUser[]).find((operator) => operator.active !== false);
    if (firstActiveOperator) {
      enterOperator(firstActiveOperator);
      return;
    }
    setError(null);
    onLogin(nowSession({ role: 'operator', operatorId: 'staff-session', operatorName: 'Staff' }));
  };

  const beginOtpFlow = async (role: 'admin' | 'staff') => {
    if (isOtpSubmitting) return;
    setPendingOtpRole(role);
    setIsOtpSubmitting(true);
    setError(null);
    setOtpNotice(null);
    try {
      const email = String(auth?.currentUser?.email || '').trim();
      if (!email) {
        throw new Error('Unable to send verification code.');
      }
      const otpResponse = await sendStaffOtp(email);
      setOtpCode('');
      setPendingOtpRole(role);
      setOtpFlow('verify');
      setOtpExpired(false);
      setOtpExpiresAtMs(getOtpExpiryDeadline(otpResponse));
      setOtpRemainingMs(Math.max(0, getOtpExpiryDeadline(otpResponse) - Date.now()));
      setOtpNotice(`Verification code sent to ${email}.`);
    } catch (setupError) {
      setPendingOtpRole(null);
      setError(setupError instanceof Error ? setupError.message : 'Unable to send verification code.');
    } finally {
      setIsOtpSubmitting(false);
    }
  };

  const finishOtpEntry = () => {
    if (pendingOtpRole === 'admin') {
      enterAdmin();
      return;
    }
    finishStaffEntry();
  };

  const backToRoleChoice = () => {
    setOtpFlow('choice');
    setPendingOtpRole(null);
    setOtpCode('');
    setOtpNotice(null);
    setOtpExpiresAtMs(null);
    setOtpRemainingMs(DEFAULT_OTP_EXPIRY_SECONDS * 1000);
    setOtpExpired(false);
    setError(null);
  };

  const submitOtp = async () => {
    if (isOtpSubmitting) return;
    const email = String(auth?.currentUser?.email || '').trim();
    if (!email) {
      setError('Unable to send verification code.');
      return;
    }
    const code = otpCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setError('Code must be 6 digits.');
      return;
    }
    if (otpExpired || (otpExpiresAtMs !== null && otpExpiresAtMs <= Date.now())) {
      setOtpExpired(true);
      setError('OTP expired. Request a new OTP.');
      return;
    }
    logAuthDebug('otp.verify.start', {
      role: pendingOtpRole,
      hasEmail: Boolean(email),
      codeLength: code.length,
    });
    setIsOtpSubmitting(true);
    setError(null);
    try {
      const verificationResult = await verifyStaffOtp(email, code);
      const verified = verificationResult?.ok === true || verificationResult?.success === true;
      if (!verified) {
        logAuthDebug('otp.verify.failed', {
          role: pendingOtpRole,
          hasEmail: Boolean(email),
          responseOk: verificationResult?.ok === true,
          responseSuccess: verificationResult?.success === true,
        });
        setError('Invalid OTP');
        return;
      }
      logAuthDebug('otp.verify.success', {
        role: pendingOtpRole,
        hasEmail: Boolean(email),
      });
      finishOtpEntry();
    } catch (otpError) {
      const message = otpError instanceof Error ? otpError.message : 'OTP verification failed. Try again.';
      const isExpiredOtp = /otp_expired|expired/i.test(message);
      const isInvalidOtp = /otp_mismatch|invalid|unauthorized|401|400/i.test(message);
      logAuthDebug(
        isInvalidOtp || isExpiredOtp ? 'otp.verify.failed' : 'otp.verify.network_error',
        { role: pendingOtpRole, hasEmail: Boolean(email), message },
      );
      if (isExpiredOtp) {
        setOtpExpired(true);
        setError('OTP expired. Request a new OTP.');
        return;
      }
      setError(isInvalidOtp ? 'Invalid OTP' : 'OTP verification failed. Try again.');
    } finally {
      setIsOtpSubmitting(false);
    }
  };

  const resendOtp = async () => {
    if (isOtpSubmitting) return;
    const email = String(auth?.currentUser?.email || '').trim();
    if (!email) {
      setError('Unable to send verification code.');
      return;
    }
    setIsOtpSubmitting(true);
    setError(null);
    setOtpNotice(null);
    try {
      const otpResponse = await sendStaffOtp(email);
      const nextExpiryDeadline = getOtpExpiryDeadline(otpResponse);
      setOtpCode('');
      setOtpExpired(false);
      setOtpExpiresAtMs(nextExpiryDeadline);
      setOtpRemainingMs(Math.max(0, nextExpiryDeadline - Date.now()));
      setOtpNotice(`Verification code sent to ${email}.`);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Unable to send verification code.');
    } finally {
      setIsOtpSubmitting(false);
    }
  };

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
        enterAdmin();
        return;
      }

      const matchingOperator = /^\d{6,8}$/.test(accessPin)
        ? freshOperators.find((operator) => String(operator.password || '').trim() === accessPin)
        : undefined;
      if (!matchingOperator || matchingOperator.active === false) {
        if (isAccessDebugEnabled()) {
          const diagnostics = getAdminAccessDiagnostics(freshData.profile?.adminPin);
          console.debug('[StockFlow access unlock] access password rejected', {
            ...diagnostics,
            operatorLookupRan: /^\d{6,8}$/.test(accessPin),
            operatorPinFormat: /^\d{6,8}$/.test(accessPin),
            matchedOperator: Boolean(matchingOperator),
            matchedOperatorActive: matchingOperator?.active !== false,
          });
        }
        setError('Access password did not match admin password or active operator PIN.');
        setNextAttemptAt(Date.now() + FAILED_ATTEMPT_COOLDOWN_MS);
        return;
      }

      enterOperator(matchingOperator);
    } finally {
      setIsSubmitting(false);
    }
  };

  const enterDevAdmin = () => {
    if (!DEV_ACCESS_BYPASS_ENABLED) return;
    enterAdmin();
  };

  const enterDevOperator = () => {
    if (!DEV_ACCESS_BYPASS_ENABLED) return;
    const freshData = loadData();
    const firstActiveOperator = ((freshData.operatorUsers || []) as OperatorUser[]).find((operator) => operator.active !== false);
    enterOperator(firstActiveOperator || { id: 'dev-operator', name: 'Dev Operator', password: '', active: true });
  };

  const resetAccessSession = () => {
    clearAccessSession();
    setPassword('');
    setNextAttemptAt(0);
    setError('Access session was reset. Enter the current admin password or an active operator PIN.');
  };

  const recoverAdminPin = async (mode: 'clear' | 'reset') => {
    if (isRecovering) return;
    setIsRecovering(true);
    try {
      const firebasePassword = recoveryFirebasePassword;
      if (!(await verifyCurrentFirebasePassword(firebasePassword))) {
        setError('Firebase password could not be verified. ERP admin PIN was not changed.');
        return;
      }
      if (mode === 'reset') {
        const nextPin = recoveryNewPin.trim();
        if (!/^\d{4,6}$/.test(nextPin)) {
          setError('New ERP admin PIN must be numeric only and 4 to 6 digits.');
          return;
        }
        if (nextPin !== recoveryConfirmPin.trim()) {
          setError('New ERP admin PIN and confirm PIN do not match.');
          return;
        }
        const freshData = loadData();
        await updateStoreProfile({ ...freshData.profile, adminPin: nextPin });
        setPassword('');
        setRecoveryFirebasePassword('');
        setRecoveryNewPin('');
        setRecoveryConfirmPin('');
        setShowRecovery(false);
        setError('ERP admin PIN was reset. Enter the new ERP admin PIN to unlock access.');
        return;
      }
      const freshData = loadData();
      await updateStoreProfile({ ...freshData.profile, adminPin: '' });
      setPassword('');
      setRecoveryFirebasePassword('');
      setRecoveryNewPin('');
      setRecoveryConfirmPin('');
      setShowRecovery(false);
      setError('ERP admin PIN was cleared. Enter the current Firebase password to unlock access.');
    } finally {
      setIsRecovering(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-900/15 p-4 backdrop-blur-md">
      <Card className="w-full max-w-md border-0 shadow-2xl">
        <CardHeader>
          <CardTitle>{SIMPLE_ACCESS_MODE_ENABLED ? 'Select Access Role' : 'Enter Access Password'}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {SIMPLE_ACCESS_MODE_ENABLED
              ? 'Choose Admin or select an active operator to enter the ERP.'
              : accessHelpText}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {SIMPLE_ACCESS_MODE_ENABLED ? (
            <>
              {otpFlow === 'choice' && (
                <>
                  <Button className="w-full" onClick={() => void beginOtpFlow('admin')} disabled={isOtpSubmitting}>
                    {isOtpSubmitting && pendingOtpRole === 'admin' ? 'Sending code...' : 'Enter as Admin'}
                  </Button>
                  <Button type="button" variant="outline" className="w-full" onClick={() => void beginOtpFlow('staff')} disabled={isOtpSubmitting}>
                    {isOtpSubmitting && pendingOtpRole === 'staff' ? 'Sending code...' : 'Enter as Staff'}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Staff mode hides admin-only areas like reports, settings, cashbook, purchases, freight, and restricted edit/delete actions.
                  </p>
                </>
              )}
              {otpFlow === 'verify' && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-slate-900">{pendingOtpRole === 'admin' ? 'Verify Admin Email' : 'Verify Staff Email'}</div>
                    <p className="text-xs text-muted-foreground">Enter the 6-digit code sent to your email.</p>
                    <p className={`text-xs ${otpExpired ? 'text-red-600' : 'text-slate-500'}`}>
                      {otpExpired ? 'OTP expired. Request a new OTP.' : `OTP expires in ${formatCountdown(otpRemainingMs)}`}
                    </p>
                  </div>
                  {otpNotice && <p className="text-xs text-emerald-700">{otpNotice}</p>}
                  <div className="space-y-1">
                    <Label>Email OTP</Label>
                    <Input
                      autoFocus
                      inputMode="numeric"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => { setOtpCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6)); setError(null); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') void submitOtp(); }}
                      placeholder="123456"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={backToRoleChoice} disabled={isOtpSubmitting}>Back</Button>
                    <Button type="button" className="flex-1" onClick={() => void submitOtp()} disabled={isOtpSubmitting || otpExpired}>
                      {isOtpSubmitting ? 'Verifying...' : 'Verify'}
                    </Button>
                  </div>
                  <Button type="button" variant="ghost" className="w-full" onClick={() => void resendOtp()} disabled={isOtpSubmitting}>
                    {isOtpSubmitting ? 'Sending code...' : 'Resend Code'}
                  </Button>
                </div>
              )}
              {error && <p className="text-xs text-red-600">{error}</p>}
            </>
          ) : (
            <>
              <div className="space-y-1">
                <Label>Access Password</Label>
                <Input
                  type="password"
                  autoFocus
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
                />
                <p className="text-[11px] text-muted-foreground">{accessHelpText} ERP admin PIN is separate from the Firebase login password when configured.</p>
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <Button className="w-full" onClick={() => void submit()} disabled={isSubmitting}>{isSubmitting ? 'Checking...' : 'Unlock Access'}</Button>
              {DEV_ACCESS_BYPASS_ENABLED && (
                <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold uppercase tracking-wide text-amber-900">DEV ONLY</p>
                    <p className="text-xs font-semibold text-amber-800">Authentication bypass enabled.</p>
                    <p className="text-[11px] text-amber-700">Do not deploy with this enabled.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Button type="button" variant="outline" size="sm" className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100" onClick={enterDevAdmin}>
                      Enter as Admin
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100" onClick={enterDevOperator}>
                      Enter as Operator
                    </Button>
                  </div>
                </div>
              )}
              {accessDiagnostics.adminPinConfigured && (
                <button type="button" className="w-full text-center text-xs font-semibold text-blue-700 underline-offset-4 hover:underline" onClick={() => { setShowRecovery((open) => !open); setError(null); }}>
                  Forgot ERP admin PIN?
                </button>
              )}
              {showRecovery && accessDiagnostics.adminPinConfigured && (
                <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                  <p className="text-xs text-slate-600">Verify the signed-in Firebase password to reset or clear the separate ERP admin access PIN.</p>
                  <div className="space-y-1">
                    <Label>Firebase Password</Label>
                    <Input type="password" value={recoveryFirebasePassword} onChange={(e) => setRecoveryFirebasePassword(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>New ERP PIN</Label>
                      <Input type="password" inputMode="numeric" maxLength={6} value={recoveryNewPin} onChange={(e) => setRecoveryNewPin(e.target.value.replace(/[^\d]/g, '').slice(0, 6))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Confirm PIN</Label>
                      <Input type="password" inputMode="numeric" maxLength={6} value={recoveryConfirmPin} onChange={(e) => setRecoveryConfirmPin(e.target.value.replace(/[^\d]/g, '').slice(0, 6))} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => void recoverAdminPin('reset')} disabled={isRecovering}>{isRecovering ? 'Verifying...' : 'Reset ERP PIN'}</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => void recoverAdminPin('clear')} disabled={isRecovering}>Clear ERP PIN</Button>
                  </div>
                </div>
              )}
              <button type="button" className="w-full text-center text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" onClick={resetAccessSession}>
                Reset access session
              </button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
