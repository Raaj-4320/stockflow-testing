import { StoreProfile } from '../types';
import { getCurrentAccessSession } from '../src/auth/simplePermissions';

type InvoicePrintPreferenceFields = Pick<
  StoreProfile,
  'invoiceFormat'
  | 'thermalPaperWidth'
  | 'thermalStyle'
  | 'thermalDensity'
  | 'thermalFontScale'
  | 'thermalPaddingX'
  | 'thermalPaddingY'
>;

const PRINT_PREFS_KEY_PREFIX = 'stockflow.invoice-print-preferences';

const normalizePreferenceFields = (input?: Partial<InvoicePrintPreferenceFields> | null): InvoicePrintPreferenceFields => ({
  invoiceFormat: input?.invoiceFormat === 'thermal' ? 'thermal' : 'standard',
  thermalPaperWidth: input?.thermalPaperWidth === '58mm' ? '58mm' : '80mm',
  thermalStyle: input?.thermalStyle === 'classic' || input?.thermalStyle === 'boxed' || input?.thermalStyle === 'minimal' ? input.thermalStyle : 'grocery',
  thermalDensity: input?.thermalDensity === 'balanced' || input?.thermalDensity === 'comfortable' ? input.thermalDensity : 'compact',
  thermalFontScale: Number.isFinite(Number(input?.thermalFontScale)) ? Number(input?.thermalFontScale) : 1,
  thermalPaddingX: Number.isFinite(Number(input?.thermalPaddingX)) ? Number(input?.thermalPaddingX) : 2,
  thermalPaddingY: Number.isFinite(Number(input?.thermalPaddingY)) ? Number(input?.thermalPaddingY) : 1.5,
});

const getPreferenceStorageKey = () => {
  const session = getCurrentAccessSession();
  if (session?.role === 'operator') {
    const scope = String(session.operatorId || session.userEmail || 'operator').trim() || 'operator';
    return `${PRINT_PREFS_KEY_PREFIX}.operator.${scope}`;
  }
  const scope = String(session?.userEmail || 'admin').trim().toLowerCase() || 'admin';
  return `${PRINT_PREFS_KEY_PREFIX}.admin.${scope}`;
};

const canUseLocalStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export const getStoredInvoicePrintPreferences = (): InvoicePrintPreferenceFields | null => {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(getPreferenceStorageKey());
    if (!raw) return null;
    return normalizePreferenceFields(JSON.parse(raw) as Partial<InvoicePrintPreferenceFields>);
  } catch {
    return null;
  }
};

export const saveInvoicePrintPreferences = (input: Partial<InvoicePrintPreferenceFields>) => {
  if (!canUseLocalStorage()) return normalizePreferenceFields(input);
  const normalized = normalizePreferenceFields(input);
  try {
    window.localStorage.setItem(getPreferenceStorageKey(), JSON.stringify(normalized));
    window.dispatchEvent(new Event('local-storage-update'));
  } catch {
    // ignore storage errors and still return normalized values
  }
  return normalized;
};

export const resolveInvoicePrintProfile = (profile?: Partial<StoreProfile> | null): StoreProfile => {
  const stored = getStoredInvoicePrintPreferences();
  return {
    ...(profile || {}),
    ...normalizePreferenceFields({
      invoiceFormat: stored?.invoiceFormat ?? profile?.invoiceFormat,
      thermalPaperWidth: stored?.thermalPaperWidth ?? profile?.thermalPaperWidth,
      thermalStyle: stored?.thermalStyle ?? profile?.thermalStyle,
      thermalDensity: stored?.thermalDensity ?? profile?.thermalDensity,
      thermalFontScale: stored?.thermalFontScale ?? profile?.thermalFontScale,
      thermalPaddingX: stored?.thermalPaddingX ?? profile?.thermalPaddingX,
      thermalPaddingY: stored?.thermalPaddingY ?? profile?.thermalPaddingY,
    }),
  } as StoreProfile;
};

export const getNormalizedInvoicePrintPreferences = normalizePreferenceFields;
