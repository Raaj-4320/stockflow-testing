const STOCKFLOW_ERROR_PREFIX = '[StockFlowError]';

export const logStockFlowError = (context: string, error: unknown, extra?: Record<string, unknown>) => {
  try {
    console.error(STOCKFLOW_ERROR_PREFIX, context, { error, ...(extra || {}) });
  } catch (_logError) {
  }
};

export const getFriendlyErrorMessage = (error: unknown, context = 'general') => {
  const rawMessage = error instanceof Error ? error.message : String(error || '');
  const code = String((error as any)?.code || '').toLowerCase();
  const message = rawMessage.toLowerCase();

  logStockFlowError(context, error, { code });

  const isFirestoreSizeError = (message.includes('cannot be written') || message.includes('maximum allowed size') || message.includes('exceeds') || message.includes('1,048,576') || message.includes('1048576'))
    && (message.includes('stores/') || message.includes('document') || message.includes('firestore'));
  if (isFirestoreSizeError) {
    return 'This action could not be saved because old store data needs cleanup. Please contact support.';
  }

  if (code.includes('permission-denied') || message.includes('permission-denied') || message.includes('missing or insufficient permissions')) {
    return 'You do not have permission to perform this action.';
  }

  if (code.includes('resource-exhausted') || code.includes('429') || message.includes('resource-exhausted') || message.includes('429') || message.includes('quota')) {
    return 'The system is temporarily busy. Please wait and try again.';
  }

  if (code.includes('unavailable') || message.includes('unavailable') || message.includes('network') || message.includes('offline') || message.includes('failed to get document because the client is offline')) {
    return 'Network issue. Please check your connection and retry.';
  }

  if (message.includes('blocked root store write')) {
    return 'This action could not be saved because old store data needs cleanup. Please contact support.';
  }

  if (!rawMessage || rawMessage === 'undefined' || rawMessage === 'null') {
    return 'Something went wrong. Please try again.';
  }

  // Validation and business-rule messages are intentionally preserved.
  return rawMessage;
};
