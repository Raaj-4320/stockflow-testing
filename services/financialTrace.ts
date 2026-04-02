type CalcBucket = 'TX' | 'CASH' | 'LEDGER' | 'P&L' | 'SHIFT' | 'EXPENSE' | 'CORRECTION' | 'RECON';

const prefix = (bucket: CalcBucket, event: string) => `[CALC][${bucket}][${event}]`;

export const calcTrace = (bucket: CalcBucket, event: string, payload: Record<string, unknown>) => {
  console.info(prefix(bucket, event), payload);
};

export const calcTraceError = (bucket: CalcBucket, event: string, payload: Record<string, unknown>) => {
  console.error(prefix(bucket, event), payload);
};
