import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { getEffectiveAdminPin } from './permissions';

const isDev = () => Boolean(import.meta.env?.DEV);

const debugAccessPassword = (message: string, details?: Record<string, unknown>) => {
  if (!isDev()) return;
  console.debug('[StockFlow access unlock]', message, details || {});
};

export const hasConfiguredAdminAccessPin = (adminPin?: string): boolean => String(adminPin || '').trim().length > 0;

export const verifyAdminAccessPassword = async (password: string, adminPin?: string): Promise<boolean> => {
  const rawPassword = String(password || '');
  const configuredAdminPin = String(adminPin || '').trim();

  if (configuredAdminPin) {
    const matched = rawPassword.trim() === configuredAdminPin;
    debugAccessPassword('checked configured admin access PIN', { matched });
    return matched;
  }

  const currentUser = auth?.currentUser;
  if (currentUser?.email) {
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, rawPassword);
      await reauthenticateWithCredential(currentUser, credential);
      debugAccessPassword('verified current Firebase credential for admin unlock', { matched: true });
      return true;
    } catch (error) {
      debugAccessPassword('current Firebase credential did not unlock admin access', {
        code: typeof error === 'object' && error && 'code' in error ? (error as { code?: string }).code : undefined,
      });
      return false;
    }
  }

  const matchedFallback = rawPassword.trim() === getEffectiveAdminPin(adminPin);
  debugAccessPassword('checked legacy fallback admin PIN because Firebase user is unavailable', { matched: matchedFallback });
  return matchedFallback;
};
