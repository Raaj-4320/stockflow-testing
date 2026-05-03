export type ApiFieldError = { field: string; message: string };
export type ApiErrorEnvelope = { code: string; message: string; fieldErrors?: ApiFieldError[]; requestId?: string | null; timestamp?: string };
export class ApiError extends Error {
  status: number; code: string; fieldErrors: ApiFieldError[]; requestId: string | null;
  constructor(input: { message: string; status: number; code?: string; fieldErrors?: ApiFieldError[]; requestId?: string | null }) {
    super(input.message); this.name='ApiError'; this.status=input.status; this.code=input.code||'API_ERROR'; this.fieldErrors=input.fieldErrors||[]; this.requestId=input.requestId??null;
  }
}
export const normalizeApiErrorEnvelope = (payload: unknown): ApiErrorEnvelope => {
  if (payload && typeof payload === 'object') {
    const source = payload as Record<string, unknown>;
    return { code: typeof source.code==='string'?source.code:'API_ERROR', message: typeof source.message==='string'?source.message:'Request failed.', fieldErrors: Array.isArray(source.fieldErrors)?(source.fieldErrors as ApiFieldError[]):[], requestId: typeof source.requestId==='string'?source.requestId:null, timestamp: typeof source.timestamp==='string'?source.timestamp:undefined };
  }
  return { code:'API_ERROR', message:'Request failed.', fieldErrors:[], requestId:null };
};
