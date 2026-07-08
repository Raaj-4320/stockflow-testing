const getTelegramServerUrl = () => {
  console.log({
    telegramServerUrl: import.meta.env.VITE_TELEGRAM_SERVER_URL,
    hasTelegramServerUrl: Boolean(import.meta.env.VITE_TELEGRAM_SERVER_URL)
  });
  const value = String((import.meta as any)?.env?.VITE_TELEGRAM_SERVER_URL || '').trim().replace(/\/$/, '');
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

export const createTelegramProductPost = async (payload: TelegramProductPostPayload) => {
  const response = await fetch(`${getTelegramServerUrl()}/api/telegram/post-product`, {
    method: 'POST',
    headers: getTelegramHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await safeJson(response);
  if (!response.ok) {
    throw new Error(data?.message || data?.error || 'Telegram product post request failed.');
  }
  return data;
};
