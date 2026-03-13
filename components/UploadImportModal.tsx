import React, { useRef, useState } from 'react';
import { Button } from './ui';
import { AlertTriangle, FileDown, Upload, X } from 'lucide-react';
import { ImportIssue, ImportResult } from '../services/importExcel';

type Props = {
  title: string;
  open: boolean;
  onClose: () => void;
  onDownloadTemplate: () => void;
  onImportFile: (file: File) => Promise<ImportResult>;
};

export function UploadImportModal({ title, open, onClose, onDownloadTemplate, onImportFile }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  if (!open) return null;

  const onFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const res = await onImportFile(file);
      setResult(res);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const issues = result?.errors || [];

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-full border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onDownloadTemplate}><FileDown className="mr-2 h-4 w-4" /> Download Example File</Button>
            <Button onClick={() => inputRef.current?.click()} disabled={loading}><Upload className="mr-2 h-4 w-4" /> {loading ? 'Inspecting file...' : 'Upload File'}</Button>
            <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onFilePick} />
          </div>

          {result && (
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-900">Result Summary</div>
              <div className="mt-2 text-sm text-slate-600">{result.summary}</div>
              <div className="mt-2 text-xs text-slate-500">Total rows: {result.totalRows} · Imported: {result.importedRows} · Errors: {result.errors.length}</div>
            </div>
          )}

          {!!issues.length && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800"><AlertTriangle className="h-4 w-4" /> Validation Errors</div>
              <div className="max-h-72 space-y-1 overflow-auto text-sm text-amber-900">
                {issues.map((issue: ImportIssue, idx: number) => (
                  <div key={`${issue.row}-${issue.field}-${idx}`}>Sheet {issue.sheet} · Row {issue.row} · {issue.field}: {issue.message}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
