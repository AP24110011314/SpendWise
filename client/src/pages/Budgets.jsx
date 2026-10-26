import { useState, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/context/AuthContext';
import { useBudgets, useBudgetProgress, useCreateBudget, useUpdateBudget, useDeleteBudget, useCopyBudgets } from '@/hooks';
import { useCategories } from '@/hooks';
import { formatMonth, getCurrentMonth, addMonths, parseMonth } from '@/lib/dates';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import Spinner from '@/components/ui/Spinner';
import MonthPicker from '@/components/ui/MonthPicker';
import { Plus, Edit, Trash2, Copy, Target, AlertTriangle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const budgetSchema = z.object({
  categoryId: z.string().nullable().optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid month format (YYYY-MM)'),
  limit: z.coerce.number()
    .positive('Limit must be positive')
    .max(999999999, 'Limit is too large')
    .refine(val => Number(val.toFixed(2)) === val, 'Limit can have at most 2 decimal places'),
  alertThreshold: z.coerce.number().int().min(1, 'Threshold must be at least 1%').max(100, 'Threshold cannot exceed 100%').default(80),
});

function formatAmount(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount / 100);
}

function BudgetCard({ budget, category, currency, onEdit, onDelete, isDeleting }) {
  const percentage = budget.limit > 0 ? (budget.spent / budget.limit) * 100 : 0;
  const isOverall = !budget.categoryId;
  const status = budget.status || (percentage >= 100 ? 'exceeded' : percentage >= 80 ? 'warning' : 'ok');
  const statusColors = {
    ok: { bg: '#22c55e18', text: '#22c55e', label: 'On track', icon: CheckCircle },
    warning: { bg: '#f9731618', text: '#f97316', label: 'Near limit', icon: AlertTriangle },
    exceeded: { bg: '#ef444418', text: '#ef4444', label: 'Over budget', icon: AlertTriangle },
  };
  const { bg, text, label, icon: StatusIcon } = statusColors[status];

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/60 transition-all hover:shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          {category ? (
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${category.color}25` }}
            >
              <span className="w-4 h-4 rounded-full" style={{ backgroundColor: category.color }} />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
              <Target className="w-5 h-5 text-amber-500" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white truncate">
              {isOverall ? 'Overall Budget' : category?.name || 'Unknown'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatAmount(budget.spent, currency)} / {formatAmount(budget.limit, currency)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(budget)}
            disabled={isDeleting}
            aria-label={`Edit ${isOverall ? 'overall' : category?.name} budget`}
            className="p-1.5 h-8 w-8"
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(budget)}
            disabled={isDeleting}
            aria-label={`Delete ${isOverall ? 'overall' : category?.name} budget`}
            className="p-1.5 h-8 w-8 text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="mb-2.5">
        <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(percentage, 100)}%`,
              backgroundColor: status === 'exceeded' ? '#ef4444' : status === 'warning' ? '#f97316' : '#22c55e',
            }}
            role="progressbar"
            aria-valuenow={Math.round(percentage)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${isOverall ? 'Overall' : category?.name} budget ${Math.round(percentage)}% used`}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs">
        <div>
          <span className="font-semibold text-gray-700 dark:text-gray-300">{Math.round(percentage)}% used</span>
          {budget.remaining !== undefined && (
            <p className="font-medium mt-0.5" style={{ color: budget.remaining < 0 ? '#ef4444' : '#22c55e' }}>
              {budget.remaining < 0 ? 'Over by' : 'Remaining'}: {formatAmount(Math.abs(budget.remaining), currency)}
            </p>
          )}
        </div>

        {/* Status Bubble Badge - perfectly enclosed inline flex with no text overflow */}
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full whitespace-nowrap shrink-0 leading-none shadow-xs"
          style={{
            backgroundColor: bg,
            color: text,
            border: `1px solid ${text}35`,
          }}
        >
          <StatusIcon className="w-3.5 h-3.5 shrink-0" />
          <span>{label}</span>
        </span>
      </div>
    </div>
  );
}

export default function Budgets() {
  const { user } = useAuth();
  const currency = user?.currency || 'INR';
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showCopyModal, setShowCopyModal] = useState(false);

  const { data: budgetsData, isLoading: budgetsLoading, error: budgetsError, refetch: refetchBudgets } = useBudgets({ month: selectedMonth });
  const { data: progressData, isLoading: progressLoading, refetch: refetchProgress } = useBudgetProgress({ month: selectedMonth });
  const { data: categoriesData } = useCategories();

  const createMutation = useCreateBudget();
  const updateMutation = useUpdateBudget();
  const deleteMutation = useDeleteBudget();
  const copyMutation = useCopyBudgets();

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;
  const isCopying = copyMutation.isPending;

  const categories = Array.isArray(categoriesData) ? categoriesData : (categoriesData?.data || []);
  const expenseCategories = categories.filter(c => c.type === 'expense');

  const budgets = Array.isArray(budgetsData) ? budgetsData : (budgetsData?.data || budgetsData?.budgets || []);
  const progress = Array.isArray(progressData?.progress) ? progressData.progress : (Array.isArray(progressData) ? progressData : []);

  const progressMap = useMemo(() => {
    const map = new Map();
    progress.forEach(p => map.set(p._id, p));
    return map;
  }, [progress]);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      month: selectedMonth,
      limit: '',
      alertThreshold: 80,
      categoryId: null,
    },
  });

  const watchedCategoryId = watch('categoryId');

  const openCreateModal = useCallback(() => {
    setEditingBudget(null);
    reset({
      month: selectedMonth,
      limit: '',
      alertThreshold: 80,
      categoryId: null,
    });
    setIsModalOpen(true);
  }, [reset, selectedMonth]);

  const openEditModal = useCallback((budget) => {
    setEditingBudget(budget);
    reset({
      month: budget.month,
      limit: budget.limit / 100,
      alertThreshold: budget.alertThreshold,
      categoryId: budget.categoryId || null,
    });
    setIsModalOpen(true);
  }, [reset]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingBudget(null);
    reset();
  }, [reset]);

  const onSubmit = async (data) => {
    try {
      const payload = {
        ...data,
        limit: Math.round(data.limit * 100),
        categoryId: data.categoryId || null,
      };

      if (editingBudget) {
        await updateMutation.mutateAsync({ id: editingBudget._id, data: payload });
        toast.success('Budget updated successfully!');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Budget created successfully!');
      }
      closeModal();
      refetchBudgets();
      refetchProgress();
    } catch (err) {
      toast.error(err.message || 'Failed to save budget');
    }
  };

  const handleDelete = useCallback((budget) => {
    setDeleteConfirm(budget);
  }, []);

  const confirmDelete = async () => {
    if (deleteConfirm) {
      try {
        await deleteMutation.mutateAsync(deleteConfirm._id);
        toast.success('Budget deleted successfully!');
        setDeleteConfirm(null);
        refetchBudgets();
        refetchProgress();
      } catch (err) {
        setDeleteConfirm(null);
        toast.error(err.message || 'Failed to delete budget');
      }
    }
  };

  const handleCopyBudgets = async () => {
    const fromMonth = addMonths(selectedMonth, -1);
    try {
      await copyMutation.mutateAsync({ fromMonth, toMonth: selectedMonth });
      toast.success(`Copied budgets from ${fromMonth} to ${selectedMonth}!`);
      setShowCopyModal(false);
      refetchBudgets();
      refetchProgress();
    } catch (err) {
      toast.error(err.message || 'Failed to copy budgets');
    }
  };

  const openCopyModal = useCallback(() => {
    setShowCopyModal(true);
  }, []);

  const hasBudgetsForPrevMonth = useMemo(() => {
    // This would need a separate API call to check, for now we'll allow it
    return true;
  }, []);

  if (budgetsLoading || progressLoading) {
    return (
      <div className="space-y-6" role="status" aria-live="polite">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Budgets</h1>
            <p className="text-gray-500 dark:text-gray-400">Set monthly spending limits</p>
          </div>
          <div className="flex items-center gap-4">
            <MonthPicker value={selectedMonth} onChange={setSelectedMonth} disabled />
            <Button disabled>
              <Plus className="w-4 h-4" />
              Add Budget
            </Button>
          </div>
        </div>
        <Card className="p-6">
          <div className="text-center py-12">
            <Spinner />
          </div>
        </Card>
      </div>
    );
  }

  if (budgetsError) {
    return (
      <div className="space-y-6" role="alert">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Budgets</h1>
            <p className="text-gray-500 dark:text-gray-400">Set monthly spending limits</p>
          </div>
          <div className="flex items-center gap-4">
            <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
            <Button onClick={() => { refetchBudgets(); refetchProgress(); }}>
              <Plus className="w-4 h-4" />
              Retry
            </Button>
          </div>
        </div>
        <Card className="p-6">
          <EmptyState title="Failed to load budgets" description={budgetsError.message} />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Budgets</h1>
          <p className="text-gray-500 dark:text-gray-400">Set monthly spending limits</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
          <Button onClick={openCreateModal}>
            <Plus className="w-4 h-4" />
            Add Budget
          </Button>
          {hasBudgetsForPrevMonth && (
            <Button variant="outline" onClick={openCopyModal} loading={isCopying}>
              <Copy className="w-4 h-4" />
              Copy from Previous Month
            </Button>
          )}
        </div>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Monthly Budgets</h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">{formatMonth(selectedMonth)}</span>
        </div>

        {budgets.length === 0 ? (
          <div className="text-center py-12">
            <Target className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">No budgets set for this month</p>
            <Button onClick={openCreateModal}>
              <Plus className="w-4 h-4" />
              Create your first budget
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {budgets.map((budget) => {
              const progressInfo = progressMap.get(budget._id);
              const category = budget.categoryId
                ? categories.find(c => c._id === budget.categoryId)
                : null;
              return (
                <BudgetCard
                  key={budget._id}
                  budget={{ ...budget, ...progressInfo }}
                  category={category}
                  currency={currency}
                  onEdit={openEditModal}
                  onDelete={handleDelete}
                  isDeleting={isDeleting}
                />
              );
            })}
          </div>
        )}
      </Card>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingBudget ? 'Edit Budget' : 'Add Budget'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Select
            label="Category (Optional - leave empty for overall budget)"
            options={[
              { value: '', label: 'Overall Budget' },
              ...expenseCategories.map(c => ({ value: c._id, label: c.name })),
            ]}
            placeholder="Select a category"
            {...register('categoryId')}
          />

          <Input
            label="Month"
            type="month"
            {...register('month')}
            disabled={!!editingBudget}
          />

          <Input
            label="Limit"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            {...register('limit')}
          />
          {errors.limit && <p className="text-sm text-red-600 dark:text-red-400">{errors.limit.message}</p>}

          <Input
            label="Alert Threshold (%)"
            type="number"
            min="1"
            max="100"
            placeholder="80"
            {...register('alertThreshold')}
          />
          {errors.alertThreshold && <p className="text-sm text-red-600 dark:text-red-400">{errors.alertThreshold.message}</p>}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>
              {editingBudget ? 'Save Changes' : 'Create Budget'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={confirmDelete}
        title="Delete Budget"
        message={deleteConfirm
          ? `Are you sure you want to delete ${deleteConfirm.categoryId ? 'this category budget' : 'the overall budget'}?`
          : 'Are you sure you want to delete this budget?'
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        loading={isDeleting}
      />

      <Modal isOpen={showCopyModal} onClose={() => setShowCopyModal(false)} title="Copy Budgets from Previous Month">
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            This will copy all budgets from <strong>{formatMonth(addMonths(selectedMonth, -1))}</strong> to <strong>{formatMonth(selectedMonth)}</strong>.
            Existing budgets for this month will be overwritten.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowCopyModal(false)}>Cancel</Button>
            <Button onClick={handleCopyBudgets} loading={isCopying}>
              Copy Budgets
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}