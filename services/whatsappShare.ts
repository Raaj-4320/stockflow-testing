import { Customer, Transaction } from '../types';
import { getConfiguredWhatsAppServerUrl, sendCustomerLedgerViaWhatsApp, sendInvoiceViaWhatsApp } from './whatsappStatus';

export type WhatsAppShareResult = {
  ok: boolean;
  reason: 'WHATSAPP_NOT_CONFIGURED' | 'WHATSAPP_PUBLIC_URL_REQUIRED' | 'WHATSAPP_SEND_FAILED' | 'WHATSAPP_PHONE_MISSING' | 'WHATSAPP_SENT';
  message: string;
};

const isPublicHttpUrl = (value: string) => /^https?:\/\//i.test(String(value || '').trim());

const getConfig = () => {
  const serverUrl = getConfiguredWhatsAppServerUrl();
  const configured = Boolean(serverUrl);
  let host = '';
  try { host = configured ? new URL(serverUrl).host : ''; } catch { host = ''; }
  return { configured, host };
};

export const isWhatsAppShareConfigured = () => Boolean(getConfiguredWhatsAppServerUrl());

export const shareCustomerLedgerViaWhatsApp = async (
  customer: Customer,
  pdfBlobOrUrl?: Blob | string,
): Promise<WhatsAppShareResult> => {
  const { configured, host } = getConfig();
  console.info('[WHATSAPP LEDGER CONFIG]', { configured, host });
  if (!configured) {
    return {
      ok: false,
      reason: 'WHATSAPP_NOT_CONFIGURED',
      message: 'WhatsApp sharing integration is not configured yet. PDF is ready to share.',
    };
  }
  if (!customer?.phone) {
    return { ok: false, reason: 'WHATSAPP_PHONE_MISSING', message: 'Customer phone number is missing.' };
  }
  const pdfUrl = typeof pdfBlobOrUrl === 'string' ? String(pdfBlobOrUrl).trim() : '';
  if (!isPublicHttpUrl(pdfUrl)) {
    return {
      ok: false,
      reason: 'WHATSAPP_PUBLIC_URL_REQUIRED',
      message: 'WhatsApp server currently requires a public PDF URL. Direct PDF upload is not implemented yet.',
    };
  }
  try {
    await sendCustomerLedgerViaWhatsApp({
      userId: '',
      customerPhone: customer.phone,
      customerName: customer.name || 'Customer',
      ledgerNo: `LEDGER-${customer.id}`,
      pdfUrl,
    });
    return { ok: true, reason: 'WHATSAPP_SENT', message: 'Ledger sent to WhatsApp.' };
  } catch (error) {
    return {
      ok: false,
      reason: 'WHATSAPP_SEND_FAILED',
      message: error instanceof Error ? error.message : 'Unable to send ledger to WhatsApp.',
    };
  }
};

export const shareTransactionInvoiceViaWhatsApp = async (
  transaction: Transaction,
  pdfBlobOrUrl?: Blob | string,
): Promise<WhatsAppShareResult> => {
  const { configured } = getConfig();
  if (!configured) {
    return {
      ok: false,
      reason: 'WHATSAPP_NOT_CONFIGURED',
      message: 'WhatsApp sharing integration is not configured yet. Invoice PDF is ready to share.',
    };
  }
  const phone = String(transaction.customerPhone || '').trim();
  if (!phone) return { ok: false, reason: 'WHATSAPP_PHONE_MISSING', message: 'Customer phone number is missing.' };
  const pdfUrl = typeof pdfBlobOrUrl === 'string' ? String(pdfBlobOrUrl).trim() : '';
  if (!isPublicHttpUrl(pdfUrl)) {
    return {
      ok: false,
      reason: 'WHATSAPP_PUBLIC_URL_REQUIRED',
      message: 'WhatsApp server currently requires a public PDF URL. Direct PDF upload is not implemented yet.',
    };
  }
  try {
    await sendInvoiceViaWhatsApp({
      userId: '',
      customerPhone: phone,
      customerName: transaction.customerName || 'Customer',
      invoiceNo: (transaction.invoiceNo || transaction.id).toString(),
      pdfUrl,
    });
    return { ok: true, reason: 'WHATSAPP_SENT', message: 'Invoice sent to WhatsApp.' };
  } catch (error) {
    return {
      ok: false,
      reason: 'WHATSAPP_SEND_FAILED',
      message: error instanceof Error ? error.message : 'Unable to send invoice to WhatsApp.',
    };
  }
};
