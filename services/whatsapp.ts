export type WhatsAppSendInvoicePayload = {
  userId: string;
  customerPhone: string;
  customerName: string;
  invoiceNo: string;
  pdfUrl: string;
};

const DEFAULT_WHATSAPP_SERVER_URL = 'http://localhost:3000';

export const getWhatsAppServerUrl = (): string => (
  (import.meta.env.VITE_WHATSAPP_SERVER_URL || DEFAULT_WHATSAPP_SERVER_URL).replace(/\/$/, '')
);

const parseJsonResponse = async (response: Response): Promise<any> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const assertOkResponse = async (response: Response, context: string): Promise<any> => {
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    const details = typeof data?.message === 'string' ? data.message : response.statusText;
    throw new Error(`${context} failed (${response.status}): ${details || 'Unexpected server response'}`);
  }
  return data;
};

export const createWhatsAppSession = async (userId: string): Promise<void> => {
  const response = await fetch(`${getWhatsAppServerUrl()}/create-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  const data = await assertOkResponse(response, 'Create WhatsApp session');
  if (data?.success !== true) throw new Error(data?.message || 'Unable to create WhatsApp session');
};

export const getWhatsAppQr = async (userId: string): Promise<{ success: boolean; qr?: string; connected?: boolean }> => {
  const response = await fetch(`${getWhatsAppServerUrl()}/qr/${encodeURIComponent(userId)}`);
  const data = await assertOkResponse(response, 'Fetch WhatsApp QR');
  if (data?.success !== true) throw new Error(data?.message || 'Invalid WhatsApp QR response');
  return { success: true, qr: typeof data?.qr === 'string' ? data.qr : undefined, connected: Boolean(data?.connected) };
};

export const getWhatsAppStatus = async (userId: string): Promise<{ success: boolean; connected: boolean }> => {
  const response = await fetch(`${getWhatsAppServerUrl()}/status/${encodeURIComponent(userId)}`);
  const data = await assertOkResponse(response, 'Fetch WhatsApp status');
  if (data?.success !== true) throw new Error(data?.message || 'Invalid WhatsApp status response');
  return { success: true, connected: Boolean(data?.connected) };
};

export const sendInvoiceToWhatsApp = async (payload: WhatsAppSendInvoicePayload): Promise<void> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${getWhatsAppServerUrl()}/send-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await assertOkResponse(response, 'Send WhatsApp invoice');
    if (data?.success !== true) throw new Error(data?.message || 'Failed to send WhatsApp invoice');
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Send WhatsApp invoice timed out. Please try again.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
};
