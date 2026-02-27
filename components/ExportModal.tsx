
import React from 'react';
import { FileText, FileSpreadsheet, X } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle } from './ui';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExport: (format: 'pdf' | 'excel') => void;
    title?: string;
    description?: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({ 
    isOpen, 
    onClose, 
    onExport, 
    title = "Export Report", 
    description = "Select your preferred format to download the report." 
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <Card className="w-full max-w-sm animate-in zoom-in-95 shadow-2xl">
                <CardHeader className="border-b pb-4 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-lg">{title}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">{description}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                        <X className="w-4 h-4" />
                    </Button>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="grid grid-cols-2 gap-4">
                        <button 
                            onClick={() => { onExport('pdf'); onClose(); }}
                            className="flex flex-col items-center justify-center p-6 bg-red-50 hover:bg-red-100 border border-red-200 rounded-2xl transition-all group"
                        >
                            <div className="p-4 bg-white rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
                                <FileText className="w-8 h-8 text-red-600" />
                            </div>
                            <span className="font-bold text-sm text-red-700">PDF Document</span>
                            <span className="text-[10px] text-red-600/60 mt-1">Standard Format</span>
                        </button>

                        <button 
                            onClick={() => { onExport('excel'); onClose(); }}
                            className="flex flex-col items-center justify-center p-6 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-2xl transition-all group"
                        >
                            <div className="p-4 bg-white rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
                                <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
                            </div>
                            <span className="font-bold text-sm text-emerald-700">Excel Sheet</span>
                            <span className="text-[10px] text-emerald-600/60 mt-1">Data Analysis</span>
                        </button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
