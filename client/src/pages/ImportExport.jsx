import { useState, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/context/AuthContext';
import { useImportHistory, usePreviewImport, useCommitImport, useUndoImport, useExportTransactions } from '@/hooks';
import { useCategories } from '@/hooks';
import { format, parseISO } from 'date-fns';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import Spinner from '@/components/ui/Spinner';
import MonthPicker from '@/components/ui/MonthPicker';
import { UploadCloud, Download, FileText, Eye, RotateCcw, Trash2, CheckCircle, AlertCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';

const importSchema = z.object({
  mapping: z.object({
    filename: z.string().optional(),
    delimiter: z.string().optional(),
    date: z.string().min(1, 'Date column is required'),
    amount: z.string().optional(),
    debit: z.string().optional(),
    credit: z.string().optional(),
    note: z.string().optional(),
    category: z.string().optional(),
    type: z.string().optional(),
    amountMode: z.enum(['single', 'split']).optional(),
  }).refine(data => {
    // If using single amount mode, amount column is required
    if (data.amountMode === 'single') {
      return Boolean(data.amount && data.amount.length > 0);
    }
    // If using split mode, both debit and credit are required
    if (data.amountMode === 'split') {
      return Boolean(data.debit && data.debit.length > 0 && data.credit && data.credit.length > 0);
    }
    return true;
  }, {
    message: 'Amount column is required for single mode; both debit and credit columns are required for split mode',
    path: ['amount'],
  }),
  previewRows: z.array(z.any()).optional(),
});

function formatAmount(amount, currency = 'INR') {
  const num = typeof amount === 'number' ? amount / 100 : parseFloat(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function ImportBatchCard({ batch, onUndo, onView, isUndoing }) {
  const status = batch.status || (batch.importedCount > 0 ? 'completed' : (batch.invalidCount > 0 && batch.importedCount === 0 ? 'failed' : 'completed'));
  const statusColors = {
    completed: { bg: '#22c55e20', text: '#22c55e', icon: CheckCircle },
    previewed: { bg: '#3b82f620', text: '#3b82f6', icon: Eye },
    failed: { bg: '#ef444420', text: '#ef4444', icon: AlertCircle },
    undone: { bg: '#9ca3af20', text: '#9ca3af', icon: RotateCcw },
  };

  const { bg, text, icon: StatusIcon } = statusColors[status] || statusColors.completed;

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-3">
          <FileText className="w-8 h-8 text-gray-400" />
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{batch.filename || 'Import'}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {format(parseISO(batch.createdAt), 'MMM d, yyyy HH:mm')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1"
            style={{ backgroundColor: bg, color: text }}
          >
            <StatusIcon className="w-3 h-3" />
            {status}
          </span>
          {batch.previewRows && (
            <Button variant="ghost" size="sm" onClick={() => onView(batch)} disabled={isUndoing} aria-label="View preview">
              <Eye className="w-4 h-4" />
            </Button>
          )}
          {status !== 'undone' && (batch.importedCount > 0 || batch.importedRows > 0) && (
            <Button variant="ghost" size="sm" onClick={() => onUndo(batch)} disabled={isUndoing} aria-label="Undo import">
              <RotateCcw className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <span className="text-gray-500 dark:text-gray-400">Total Rows</span>
          <p className="font-medium text-gray-900 dark:text-white">{batch.totalRows ?? 0}</p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Duplicates Skipped</span>
          <p className="font-medium text-amber-600 dark:text-amber-400">{batch.skippedDuplicates ?? 0}</p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Imported</span>
          <p className="font-medium text-emerald-600 dark:text-emerald-400">{batch.importedCount ?? batch.importedRows ?? 0}</p>
        </div>
      </div>

      {batch.error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{batch.error}</p>
      )}
    </div>
  );
}

function PreviewModal({ batch, categories, onClose, onCommit, isCommitting }) {
  if (!batch) return null;

  const suggested = batch.suggestedMapping || {};
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(importSchema),
    defaultValues: {
      mapping: {
        date: suggested.date || '',
        amount: suggested.amount || '',
        debit: suggested.debit || '',
        credit: suggested.credit || '',
        note: suggested.note || '',
        category: suggested.category || '',
        type: suggested.type || '',
        delimiter: suggested.delimiter || batch.delimiter || ',',
        amountMode: suggested.amountMode || (suggested.debit && suggested.credit ? 'split' : 'single'),
        filename: batch.file?.name || 'import.csv',
      },
      previewRows: batch.previewRows || [],
    },
  });

  const previewRows = watch('previewRows') || [];
  const validRows = previewRows.filter(r => r.valid);
  const invalidRows = previewRows.filter(r => !r.valid);

  const handleCommit = async (data) => {
    try {
      await onCommit({
        mapping: data.mapping,
        previewRows: batch.previewRows || data.previewRows,
      });
      toast.success('Import committed successfully!');
    } catch (err) {
      // Error handled by mutation
    }
  };

  return (
    <Modal isOpen={!!batch} onClose={onClose} title="Import Preview" size="xl">
      <form onSubmit={handleSubmit(handleCommit)} className="space-y-4 max-h-[80vh] overflow-y-auto">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 dark:text-white">Column Mapping</h4>
            <Select
              label="Date Column (Required)"
              options={batch.headers?.map(h => ({ value: h, label: h })) || []}
              placeholder="Select date column"
              {...register('mapping.date')}
            />
            {errors.mapping?.date && <p className="text-sm text-red-600">{errors.mapping.date.message}</p>}

            <Select
              label="Amount Mode"
              options={[
                { value: 'single', label: 'Single Amount Column' },
                { value: 'split', label: 'Separate Debit/Credit Columns' },
              ]}
              {...register('mapping.amountMode')}
              onChange={(e) => {
                register('mapping.amountMode').onChange(e);
                if (e.target.value === 'single') {
                  setValue('mapping.debit', '');
                  setValue('mapping.credit', '');
                } else {
                  setValue('mapping.amount', '');
                }
              }}
            />

            {watch('mapping.amountMode') === 'single' ? (
              <>
                <Select
                  label="Amount Column"
                  options={batch.headers?.map(h => ({ value: h, label: h })) || []}
                  placeholder="Select amount column"
                  {...register('mapping.amount')}
                />
                {errors.mapping?.amount && <p className="text-sm text-red-600">{errors.mapping.amount.message}</p>}
              </>
            ) : (
              <>
                <Select
                  label="Debit Column"
                  options={batch.headers?.map(h => ({ value: h, label: h })) || []}
                  placeholder="Select debit column"
                  {...register('mapping.debit')}
                />
                {errors.mapping?.debit && <p className="text-sm text-red-600">{errors.mapping.debit.message}</p>}
                <Select
                  label="Credit Column"
                  options={batch.headers?.map(h => ({ value: h, label: h })) || []}
                  placeholder="Select credit column"
                  {...register('mapping.credit')}
                />
                {errors.mapping?.credit && <p className="text-sm text-red-600">{errors.mapping.credit.message}</p>}
              </>
            )}

            <Select
              label="Note Column (Optional)"
              options={[{ value: '', label: 'None' }, ...(batch.headers?.map(h => ({ value: h, label: h })) || [])]}
              {...register('mapping.note')}
            />

            <Select
              label="Category Column (Optional)"
              options={[{ value: '', label: 'None' }, ...(batch.headers?.map(h => ({ value: h, label: h })) || [])]}
              {...register('mapping.category')}
            />

            <Select
              label="Type Column (Optional)"
              options={[{ value: '', label: 'None' }, ...(batch.headers?.map(h => ({ value: h, label: h })) || [])]}
              {...register('mapping.type')}
            />

            <Select
              label="Delimiter"
              options={[
                { value: ',', label: 'Comma (,)' },
                { value: ';', label: 'Semicolon (;)' },
                { value: '\t', label: 'Tab' },
                { value: '|', label: 'Pipe (|)' },
              ]}
              {...register('mapping.delimiter')}
            />
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 dark:text-white">Preview</h4>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {validRows.length} valid, {invalidRows.length} invalid out of {previewRows.length} rows
            </div>

            {invalidRows.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="font-medium text-red-700 dark:text-red-400 mb-2">
                  {invalidRows.length} row(s) have errors and will be skipped:
                </p>
                <ul className="text-sm text-red-600 dark:text-red-400 space-y-1 max-h-32 overflow-y-auto">
                  {invalidRows.slice(0, 10).map((row, idx) => (
                    <li key={idx}>Row {row.rowIndex}: {row.errors?.map(e => e.reason).join(', ')}</li>
                  ))}
                  {invalidRows.length > 10 && <li>... and {invalidRows.length - 10} more</li>}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-medium text-gray-900 dark:text-white">Valid Rows</h4>
          <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">Row</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Amount</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-left">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {validRows.map((row) => (
                  <tr key={row.rowIndex}>
                    <td className="px-3 py-2 text-gray-500">{row.rowIndex}</td>
                    <td className="px-3 py-2">{row.date}</td>
                    <td className="px-3 py-2 font-medium">
                      {row.type === 'income' ? '+' : '-'}{formatAmount(row.amount)}
                    </td>
                    <td className="px-3 py-2 capitalize">{row.type}</td>
                    <td className="px-3 py-2">{row.categoryName || '—'}</td>
                    <td className="px-3 py-2 text-gray-500 max-w-xs truncate">{row.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button type="button" variant="secondary" onClick={onClose} disabled={isCommitting}>Cancel</Button>
        <Button type="submit" loading={isCommitting} disabled={isCommitting || validRows.length === 0}>
          Import {validRows.length} Transaction(s)
        </Button>
      </div>
    </form>
    </Modal>
  );
}

export default function ImportExport() {
  const { user } = useAuth();
  const currency = user?.currency || 'INR';
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [previewBatch, setPreviewBatch] = useState(null);
  const [undoConfirm, setUndoConfirm] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const { data: historyData, isLoading: historyLoading, error: historyError, refetch: refetchHistory } = useImportHistory();
  const previewMutation = usePreviewImport();
  const commitMutation = useCommitImport();
  const undoMutation = useUndoImport();
  const exportMutation = useExportTransactions();
  const { data: categoriesData } = useCategories();

  const isPreviewing = previewMutation.isPending;
  const isCommitting = commitMutation.isPending;
  const isUndoing = undoMutation.isPending;
  const isExporting = exportMutation.isPending;

  const categories = Array.isArray(categoriesData) ? categoriesData : (categoriesData?.data || []);
  const history = Array.isArray(historyData) ? historyData : (historyData?.data || []);

  const processFile = useCallback(async (file) => {
    if (!file) return;
    const isCsv = file.name.toLowerCase().endsWith('.csv') || (file.type && (file.type.includes('csv') || file.type.includes('text')));
    if (!isCsv) {
      toast.error('Please upload a valid CSV file (.csv)');
      return;
    }
    const toastId = toast.loading('Reading & analyzing CSV...');
    try {
      const result = await previewMutation.mutateAsync(file);
      setPreviewBatch({ ...result, file });
      toast.success(`Found ${result.totalRows} row(s) in ${file.name}`, { id: toastId });
    } catch (err) {
      toast.error(err.message || 'Failed to preview file', { id: toastId });
    }
  }, [previewMutation]);

  const handleFileSelect = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
    e.target.value = '';
  }, [processFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      await processFile(file);
    }
  }, [processFile]);

  const handleCommit = useCallback(async (data) => {
    if (!previewBatch || !previewBatch.file) {
      toast.error('File missing for import. Please re-select the CSV file.');
      return;
    }
    try {
      await commitMutation.mutateAsync({
        file: previewBatch.file,
        mapping: data.mapping,
        previewRows: data.previewRows || previewBatch.previewRows,
      });
      setPreviewBatch(null);
      refetchHistory();
    } catch (err) {
      toast.error(err.message || 'Failed to commit import');
      throw err;
    }
  }, [previewBatch, commitMutation, refetchHistory]);

  const handleUndo = useCallback((batch) => {
    setUndoConfirm(batch);
  }, []);

  const confirmUndo = async () => {
    if (undoConfirm) {
      try {
        await undoMutation.mutateAsync(undoConfirm._id);
        setUndoConfirm(null);
        refetchHistory();
        toast.success('Import undone successfully');
      } catch (err) {
        setUndoConfirm(null);
        toast.error(err.message || 'Failed to undo import');
      }
    }
  };

  const handleExport = useCallback(async () => {
    try {
      const blob = await exportMutation.mutateAsync({ month: selectedMonth });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions-${selectedMonth}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Export downloaded successfully!');
    } catch (err) {
      toast.error(err.message || 'Failed to export transactions');
    }
  }, [exportMutation, selectedMonth]);

  if (historyLoading) {
    return (
      <div className="space-y-6" role="status" aria-live="polite">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Import / Export</h1>
            <p className="text-gray-500 dark:text-gray-400">Import transactions from CSV or export your data</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
              <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </Card>
          <Card className="p-6">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
              <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </Card>
        </div>
        <Card className="p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </Card>
      </div>
    );
  }

  if (historyError) {
    return (
      <div className="space-y-6" role="alert">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Import / Export</h1>
            <p className="text-gray-500 dark:text-gray-400">Import transactions from CSV or export your data</p>
          </div>
        </div>
        <Card className="p-6">
          <EmptyState title="Failed to load import history" description={historyError.message} />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Import / Export</h1>
          <p className="text-gray-500 dark:text-gray-400">Import transactions from CSV or export your data</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-50 dark:bg-amber-500/10 rounded-lg">
              <UploadCloud className="w-6 h-6 text-indigo-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Import CSV</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Upload a CSV file with your transactions</p>
            </div>
          </div>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50/50 dark:border-amber-400 dark:bg-amber-400/10'
                : 'border-gray-300 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-amber-400/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,text/plain,application/vnd.ms-excel"
              onChange={handleFileSelect}
              className="hidden"
              id="csv-upload"
              disabled={isPreviewing}
            />
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full">
                <UploadCloud className={`w-6 h-6 ${isDragging ? 'text-indigo-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`} />
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {isDragging ? 'Drop CSV file here' : 'Click to select or drag & drop CSV'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Supports standard CSV, debit/credit split, and European formats (max 5MB)
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                className="mt-2 pointer-events-none"
                loading={isPreviewing}
                disabled={isPreviewing}
              >
                Browse Files
              </Button>
            </div>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 mt-4">
            <p>Expected columns: Date, Amount (or Debit/Credit), Note, Category, Type</p>
            <p>Date formats: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, etc.</p>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Download className="w-8 h-8 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Export CSV</h3>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mb-4">Download your transactions as a CSV file</p>
          <div className="flex items-center gap-4 mb-4">
            <MonthPicker
              value={selectedMonth}
              onChange={setSelectedMonth}
              className="w-48"
            />
            <Button onClick={handleExport} loading={isExporting} variant="secondary">
              <Download className="w-4 h-4" />
              Export Transactions
            </Button>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Import History
        </h3>

        {history.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">No imports yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((batch) => (
              <ImportBatchCard
                key={batch._id}
                batch={batch}
                onUndo={handleUndo}
                onView={setPreviewBatch}
                isUndoing={isUndoing}
              />
            ))}
          </div>
        )}
      </Card>

      {previewBatch && (
        <PreviewModal
          batch={previewBatch}
          categories={categories}
          onClose={() => setPreviewBatch(null)}
          onCommit={handleCommit}
          isCommitting={isCommitting}
        />
      )}

      <ConfirmDialog
        isOpen={!!undoConfirm}
        onClose={() => setUndoConfirm(null)}
        onConfirm={confirmUndo}
        title="Undo Import"
        message={undoConfirm
          ? `Are you sure you want to undo the import "${undoConfirm.filename || undoConfirm._id}"? This will delete ${undoConfirm.importedCount ?? undoConfirm.importedRows ?? 0} imported transaction(s).`
          : 'Are you sure you want to undo this import?'
        }
        confirmText="Undo"
        cancelText="Cancel"
        variant="destructive"
        loading={isUndoing}
      />
    </div>
  );
}