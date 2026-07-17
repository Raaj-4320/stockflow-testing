import {
  TelegramCollectionActivityItem,
  TelegramCollectionFrequencyUnit,
  TelegramCollectionRepeatMode,
  TelegramLiveCollection,
  TelegramSchedulerProduct,
} from '../types';

let hasLoggedTelegramServerUrl = false;
const TELEGRAM_DEBUG_LOGS_ENABLED = String((import.meta as any).env?.VITE_DEBUG_TELEGRAM_LOGS || 'false').toLowerCase() === 'true';

const logTelegramDebug = (event: string, payload: Record<string, unknown>) => {
  if (!TELEGRAM_DEBUG_LOGS_ENABLED) return;
  console.log(event, payload);
};

const getTelegramServerUrl = () => {
  if (!hasLoggedTelegramServerUrl) {
    logTelegramDebug('telegram.server_url', {
      telegramServerUrl: import.meta.env.VITE_TELEGRAM_SERVER_URL,
      hasTelegramServerUrl: Boolean(import.meta.env.VITE_TELEGRAM_SERVER_URL),
    });
    hasLoggedTelegramServerUrl = true;
  }
  const value = String(import.meta.env.VITE_TELEGRAM_SERVER_URL || '').trim().replace(/\/$/, '');
  if (!value) {
    throw new Error('Telegram server URL is not configured. Set VITE_TELEGRAM_SERVER_URL and try again.');
  }
  return value;
};

const getTelegramHeaders = () => {
  const apiKey = String((import.meta as any)?.env?.VITE_TELEGRAM_API_KEY || '').trim();
  return {
    'Content-Type': 'application/json',
    ...(apiKey ? { 'x-stockflow-telegram-key': apiKey } : {}),
  };
};

const safeJson = async (response: Response) => {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
};

const getTelegramErrorMessage = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : String(error || '');
  const normalized = message.toLowerCase();
  if (normalized.includes('failed to fetch') || normalized.includes('networkerror') || normalized.includes('network request failed')) {
    return 'Backend not reachable';
  }
  if (normalized.includes('401') || normalized.includes('403') || normalized.includes('unauthorized') || normalized.includes('forbidden') || normalized.includes('telegram auth')) {
    return 'Telegram auth failed';
  }
  return message || fallback;
};

const readResponseData = async <T>(response: Response, fallback: string): Promise<T> => {
  const data = await safeJson(response);
  if (!response.ok) {
    throw new Error(data?.message || data?.error || fallback);
  }
  return data as T;
};

const toNonNegativeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const safeText = (value: unknown, fallback = '') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

const normalizeLiveCollection = (entry: any): TelegramLiveCollection => ({
  id: safeText(entry?.id || entry?._id || entry?.collectionId || entry?.name || `telegram-live-${Date.now()}`),
  collectionId: safeText(entry?.collectionId || entry?.id) || undefined,
  name: safeText(entry?.name || entry?.collectionName, 'Unnamed collection'),
  channelId: safeText(entry?.channelId || entry?.channel, ''),
  category: safeText(entry?.category, 'all'),
  status: safeText(entry?.status, 'unknown'),
  productsCount: toNonNegativeNumber(entry?.productsCount ?? entry?.productCount ?? entry?.products?.length),
  currentCursor: toNonNegativeNumber(entry?.currentCursor ?? entry?.cursor),
  sentCount: toNonNegativeNumber(entry?.sentCount ?? entry?.postedCount ?? entry?.successCount),
  failedCount: toNonNegativeNumber(entry?.failedCount ?? entry?.failureCount),
  lastPostedProduct: safeText(entry?.lastPostedProduct || entry?.lastPostedProductName) || undefined,
  lastPostedAt: safeText(entry?.lastPostedAt) || undefined,
  nextPostAt: safeText(entry?.nextPostAt || entry?.nextRunAt) || undefined,
  frequencyValue: toNonNegativeNumber(entry?.frequencyValue ?? entry?.frequency?.value, 1),
  frequencyUnit: safeText(entry?.frequencyUnit || entry?.frequency?.unit, 'minutes') as TelegramCollectionFrequencyUnit | string,
  repeatMode: safeText(entry?.repeatMode, 'loop') as TelegramCollectionRepeatMode | string,
  maxFailuresBeforePause: toNonNegativeNumber(entry?.maxFailuresBeforePause, 3),
});

const normalizeActivityItem = (entry: any): TelegramCollectionActivityItem => ({
  id: safeText(entry?.id || entry?._id || `${entry?.collectionId || 'activity'}-${entry?.postedAt || entry?.createdAt || Date.now()}`),
  collectionId: safeText(entry?.collectionId) || undefined,
  collectionName: safeText(entry?.collectionName || entry?.name) || undefined,
  status: safeText(entry?.status) || undefined,
  productId: safeText(entry?.productId) || undefined,
  productName: safeText(entry?.productName || entry?.lastPostedProductName) || undefined,
  error: safeText(entry?.error || entry?.message) || undefined,
  postedAt: safeText(entry?.postedAt) || undefined,
  createdAt: safeText(entry?.createdAt) || undefined,
  updatedAt: safeText(entry?.updatedAt) || undefined,
});

const requestTelegram = async <T>(path: string, options?: RequestInit, fallback = 'Telegram request failed.') => {
  try {
    const response = await fetch(`${getTelegramServerUrl()}${path}`, {
      ...options,
      headers: {
        ...getTelegramHeaders(),
        ...(options?.headers || {}),
      },
    });
    return await readResponseData<T>(response, fallback);
  } catch (error) {
    throw new Error(getTelegramErrorMessage(error, fallback));
  }
};

export type TelegramProductPostPayload = {
  channelId: string;
  product: {
    id: string;
    name: string;
    price: number;
    image: string;
    category: string;
    stock: number;
  };
  template: string;
  notes: string;
};

export type TelegramCollectionSchedulerPayload = {
  id?: string;
  collectionId?: string;
  collectionName?: string;
  name: string;
  channelId: string;
  template: string;
  notes: string;
  category: string;
  frequency?: {
    value: number;
    unit: TelegramCollectionFrequencyUnit;
  };
  frequencyValue: number;
  frequencyUnit: TelegramCollectionFrequencyUnit;
  repeatMode: TelegramCollectionRepeatMode;
  maxFailuresBeforePause: number;
  postMode?: string;
  products: TelegramSchedulerProduct[];
};

export const createTelegramProductPost = async (payload: TelegramProductPostPayload) => {
  return requestTelegram(
    '/api/telegram/post-product',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    'Telegram product post request failed.',
  );
};

export const startTelegramCollection = async (payload: TelegramCollectionSchedulerPayload) => {
  const normalizedPayload = {
    collectionId: payload.collectionId || payload.id,
    name: payload.name,
    channelId: payload.channelId,
    category: payload.category,
    template: payload.template,
    notes: payload.notes,
    frequencyValue: payload.frequencyValue,
    frequencyUnit: payload.frequencyUnit,
    repeatMode: payload.repeatMode,
    maxFailuresBeforePause: payload.maxFailuresBeforePause,
    products: payload.products.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      salePrice: product.salePrice,
      imageUrl: product.imageUrl,
      category: product.category,
      stock: product.stock,
      barcode: product.barcode,
    })),
  };
  logTelegramDebug('telegram.collection.start.payload', {
    collectionId: normalizedPayload.collectionId,
    name: normalizedPayload.name,
    channelIdPresent: Boolean(normalizedPayload.channelId),
    productsCount: normalizedPayload.products.length,
    firstProduct: normalizedPayload.products[0] ? {
      id: normalizedPayload.products[0].id,
      name: normalizedPayload.products[0].name,
      hasImageUrl: Boolean(normalizedPayload.products[0].imageUrl),
      category: normalizedPayload.products[0].category,
      stock: normalizedPayload.products[0].stock,
    } : null,
    frequencyValue: normalizedPayload.frequencyValue,
    frequencyUnit: normalizedPayload.frequencyUnit,
    repeatMode: normalizedPayload.repeatMode,
    maxFailuresBeforePause: normalizedPayload.maxFailuresBeforePause,
  });
  return requestTelegram(
    '/api/telegram/collections/start',
    {
      method: 'POST',
      body: JSON.stringify(normalizedPayload),
    },
    'Could not start Telegram collection.',
  );
};

export const stopTelegramCollection = async (collectionId: string) => {
  return requestTelegram(
    '/api/telegram/collections/stop',
    {
      method: 'POST',
      body: JSON.stringify({ collectionId }),
    },
    'Could not stop Telegram collection.',
  );
};

export const pauseTelegramCollection = async (collectionId: string) => {
  return requestTelegram(
    '/api/telegram/collections/pause',
    {
      method: 'POST',
      body: JSON.stringify({ collectionId }),
    },
    'Could not pause Telegram collection.',
  );
};

export const resumeTelegramCollection = async (collectionId: string) => {
  return requestTelegram(
    '/api/telegram/collections/resume',
    {
      method: 'POST',
      body: JSON.stringify({ collectionId }),
    },
    'Could not resume Telegram collection.',
  );
};

export const getLiveTelegramCollections = async (): Promise<TelegramLiveCollection[]> => {
  const data = await requestTelegram<any>(
    '/api/telegram/collections/live',
    { method: 'GET' },
    'Could not load live Telegram collections.',
  );
  const rows = Array.isArray(data) ? data : Array.isArray(data?.collections) ? data.collections : Array.isArray(data?.data) ? data.data : [];
  return rows.map(normalizeLiveCollection);
};

export const getTelegramCollection = async (id: string): Promise<TelegramLiveCollection | null> => {
  const data = await requestTelegram<any>(
    `/api/telegram/collections/${encodeURIComponent(id)}`,
    { method: 'GET' },
    'Could not load Telegram collection.',
  );
  const row = data?.collection || data?.data || data;
  if (!row || typeof row !== 'object') return null;
  return normalizeLiveCollection(row);
};

export const getTelegramCollectionActivity = async (id: string): Promise<TelegramCollectionActivityItem[]> => {
  const data = await requestTelegram<any>(
    `/api/telegram/collections/${encodeURIComponent(id)}/activity`,
    { method: 'GET' },
    'Could not load Telegram collection activity.',
  );
  const rows = Array.isArray(data) ? data : Array.isArray(data?.activity) ? data.activity : Array.isArray(data?.data) ? data.data : [];
  return rows.map(normalizeActivityItem);
};
