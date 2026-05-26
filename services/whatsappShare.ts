import { Customer, Transaction } from '../types';

export type WhatsAppShareResult = {
  ok: boolean;
  reason: 'WHATSAPP_NOT_CONFIGURED';
  message: string;
};

export const isWhatsAppShareConfigured = () => false;

export const shareCustomerLedgerViaWhatsApp = async (
  _customer: Customer,
  _pdfBlobOrUrl?: Blob | string,
): Promise<WhatsAppShareResult> => ({
  ok: false,
  reason: 'WHATSAPP_NOT_CONFIGURED',
  message: 'WhatsApp sharing integration is not configured yet. PDF is ready to share.',
});

export const shareTransactionInvoiceViaWhatsApp = async (
  _transaction: Transaction,
  _pdfBlobOrUrl?: Blob | string,
): Promise<WhatsAppShareResult> => ({
  ok: false,
  reason: 'WHATSAPP_NOT_CONFIGURED',
  message: 'WhatsApp sharing integration is not configured yet. Invoice PDF is ready to share.',
});
