import React, { useState, useRef } from 'react';
import {
  X,
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  RotateCcw
} from 'lucide-react';
import { ExcelImportResult } from '../../types/resident';
import api from '../../services/api';

export interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExcelImportResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      validateAndSetFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const lowerName = file.name.toLowerCase();
    const isValid = validExtensions.some((ext) => lowerName.endsWith(ext));

    if (!isValid) {
      setError('Please select a valid Excel (.xlsx, .xls) or CSV (.csv) spreadsheet.');
      setSelectedFile(null);
      return;
    }

    setError(null);
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError(null);

    try {
      const res = await api.importExcelResidents(selectedFile);
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Error occurred while importing spreadsheet.');
    } finally {
      setUploading(false);
    }
  };

  const handleDone = () => {
    onSuccess();
    handleClose();
  };

  const handleClose = () => {
    setSelectedFile(null);
    setResult(null);
    setError(null);
    onClose();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      data-testid="excel-import-modal"
    >
      <div className="relative w-full max-w-xl bg-white rounded-none shadow-none border border-zinc-300 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 bg-zinc-50">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-none border border-emerald-200">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-950 uppercase tracking-tight">Bulk Import Residents Masterlist</h3>
              <p className="text-[11px] font-mono text-zinc-500 uppercase">Upload Excel (.xlsx, .xls) or CSV spreadsheet</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={uploading}
            className="p-1 text-zinc-400 hover:text-zinc-700 rounded-none hover:bg-zinc-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-3.5">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-none text-xs text-red-800 flex items-start gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!result ? (
            <>
              {/* Drag & Drop Upload Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-none cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-zinc-900 bg-zinc-100'
                    : 'border-zinc-300 hover:border-zinc-500 bg-zinc-50 hover:bg-zinc-100/60'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  data-testid="excel-file-input"
                  className="hidden"
                />

                <div className="p-2.5 bg-white border border-zinc-300 rounded-none text-zinc-800 mb-2.5">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <p className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-900 text-center">
                  Click to browse or drag and drop spreadsheet here
                </p>
                <p className="text-[11px] font-mono text-zinc-500 text-center mt-1">
                  Supports Microsoft Excel (.xlsx, .xls) and CSV (.csv) up to 25 MB
                </p>
              </div>

              {/* Selected File Card */}
              {selectedFile && (
                <div className="flex items-center justify-between p-3 bg-zinc-50 border border-zinc-200 rounded-none">
                  <div className="flex items-center gap-2.5">
                    <FileCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                    <div>
                      <p className="text-xs font-mono font-semibold text-zinc-900 truncate max-w-xs sm:max-w-sm">
                        {selectedFile.name}
                      </p>
                      <p className="text-[10px] font-mono text-zinc-500">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                    className="text-xs text-zinc-400 hover:text-zinc-700 p-1 rounded-none"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Notice */}
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-none text-xs font-mono text-zinc-700 space-y-1">
                <span className="font-semibold text-zinc-900 uppercase tracking-wider">Duplicate Protection:</span>
                <p className="text-[11px]">
                  Any resident record matching an existing inhabitant by <strong>First Name + Last Name + Birthdate</strong> will be skipped automatically to prevent duplicate registrations.
                </p>
              </div>
            </>
          ) : (
            /* Results Summary Screen */
            <div className="space-y-3.5" data-testid="import-summary-view">
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-300 rounded-none text-emerald-800 text-xs font-mono font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Spreadsheet processed successfully!</span>
              </div>

              <div className="grid grid-cols-3 gap-2.5 text-center font-mono">
                <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-none">
                  <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Processed</div>
                  <div className="text-lg font-bold text-zinc-950 mt-1" data-testid="total-processed">
                    {result.total_processed}
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-none">
                  <div className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider">Imported</div>
                  <div className="text-lg font-bold text-emerald-800 mt-1" data-testid="imported-count">
                    {result.imported_count}
                  </div>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-none">
                  <div className="text-[10px] font-semibold text-amber-800 uppercase tracking-wider">Duplicates</div>
                  <div className="text-lg font-bold text-amber-800 mt-1" data-testid="skipped-duplicates">
                    {result.skipped_duplicates}
                  </div>
                </div>
              </div>

              {/* Error Details if any */}
              {result.errors && result.errors.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-mono font-semibold text-red-700 flex items-center gap-1.5 uppercase">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Failed Rows ({result.errors.length})</span>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1 p-2 bg-red-50/50 border border-red-200 rounded-none text-xs font-mono">
                    {result.errors.map((err, idx) => (
                      <div key={idx} className="text-red-700">
                        {err.row ? <strong>Row {err.row}: </strong> : null}
                        {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-zinc-200 bg-zinc-50">
          {!result ? (
            <>
              <button
                type="button"
                onClick={handleClose}
                disabled={uploading}
                className="px-3.5 py-1.5 text-xs font-mono font-medium text-zinc-800 bg-white border border-zinc-300 rounded-none hover:bg-zinc-100 uppercase tracking-wider transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                data-testid="upload-excel-btn"
                className="px-3.5 py-1.5 text-xs font-mono font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-none uppercase tracking-wider transition-colors flex items-center gap-1.5"
              >
                {uploading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-none animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Upload &amp; Import</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setSelectedFile(null);
                }}
                className="px-3.5 py-1.5 text-xs font-mono font-medium text-zinc-800 bg-white border border-zinc-300 rounded-none hover:bg-zinc-100 uppercase tracking-wider transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Import Another</span>
              </button>
              <button
                type="button"
                onClick={handleDone}
                data-testid="import-done-btn"
                className="px-3.5 py-1.5 text-xs font-mono font-semibold text-white bg-zinc-900 hover:bg-black rounded-none uppercase tracking-wider transition-colors flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Done</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExcelImportModal;
