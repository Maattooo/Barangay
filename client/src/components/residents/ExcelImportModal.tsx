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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
      data-testid="excel-import-modal"
    >
      <div className="relative w-full max-w-xl bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Bulk Import Residents Masterlist</h3>
              <p className="text-xs text-slate-500">Upload Excel (.xlsx, .xls) or CSV spreadsheet</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={uploading}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
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
                className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50/50'
                    : 'border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50'
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

                <div className="p-3 bg-white border border-slate-200 rounded-full shadow-xs text-emerald-600 mb-3">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-800 text-center">
                  Click to browse or drag and drop spreadsheet here
                </p>
                <p className="text-xs text-slate-500 text-center mt-1">
                  Supports Microsoft Excel (.xlsx, .xls) and CSV (.csv) up to 25 MB
                </p>
              </div>

              {/* Selected File Card */}
              {selectedFile && (
                <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-slate-900 truncate max-w-xs sm:max-w-sm">
                        {selectedFile.name}
                      </p>
                      <p className="text-[11px] text-slate-500">
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
                    className="text-xs text-slate-400 hover:text-slate-600 p-1 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Notice */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 space-y-1">
                <span className="font-semibold">Automatic Duplicate Protection:</span>
                <p>
                  Any resident record matching an existing inhabitant by{' '}
                  <strong>First Name + Last Name + Birthdate</strong> will be skipped automatically to prevent duplicate registrations.
                </p>
              </div>
            </>
          ) : (
            /* Results Summary Screen */
            <div className="space-y-4" data-testid="import-summary-view">
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm font-semibold">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Spreadsheet processed successfully!</span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Processed</div>
                  <div className="text-xl font-bold text-slate-900 mt-1" data-testid="total-processed">
                    {result.total_processed}
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="text-xs font-medium text-emerald-700 uppercase tracking-wider">Imported</div>
                  <div className="text-xl font-bold text-emerald-700 mt-1" data-testid="imported-count">
                    {result.imported_count}
                  </div>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="text-xs font-medium text-amber-700 uppercase tracking-wider">Duplicates Skipped</div>
                  <div className="text-xl font-bold text-amber-700 mt-1" data-testid="skipped-duplicates">
                    {result.skipped_duplicates}
                  </div>
                </div>
              </div>

              {/* Error Details if any */}
              {result.errors && result.errors.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Failed Rows ({result.errors.length})</span>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1 p-2 bg-red-50/50 border border-red-200 rounded-lg text-xs">
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
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          {!result ? (
            <>
              <button
                type="button"
                onClick={handleClose}
                disabled={uploading}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                data-testid="upload-excel-btn"
                className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
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
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Import Another</span>
              </button>
              <button
                type="button"
                onClick={handleDone}
                data-testid="import-done-btn"
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
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
