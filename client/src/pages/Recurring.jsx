import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/context/AuthContext';
import { useRecurringRules, useCreateRecurringRule, useUpdateRecurringRule, useDeleteRecurringRule, useRunRecurringRule } from '@/hooks';
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
import { Plus, Edit, Trash2, Repeat, Play, Calendar, DollarSign, Utensils } from 'lucide-react';
import toast from 'react-hot-toast';

const recurringSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  type: z.enum(['income', 'expense']),
  amount: z.coerce.number()
    .positive('Amount must be positive')
    .max(999999999, 'Amount is too large')
    .refine(val => Number(val.toFixed(2)) === val, 'Amount can have at most 2 decimal places'),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
  anchorDay: z.coerce.number().int().positive('Anchor day is required'),
  note: z.string().max(200, 'Note must be 200 characters or less').optional(),
  active: z.boolean().default(true),
}).refine(data => {
  if (data.endDate && data.startDate) {
    return new Date(data.endDate) >= new Date(data.startDate);
  }
  return true;
}, {
  message: 'End date must be after start date',
  path: ['endDate'],
});

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

function getAnchorDayLabel(frequency) {
  switch (frequency) {
    case 'daily':
      return 'Not applicable';
    case 'weekly':
      return 'Day of week (1=Monday, 7=Sunday)';
    case 'monthly':
      return 'Day of month (1-31)';
    case 'yearly':
      return 'Day of month (1-31)';
    default:
      return 'Anchor day';
  }
}

function getAnchorDayMin(frequency) {
  switch (frequency) {
    case 'weekly':
      return 1;
    case 'monthly':
    case 'yearly':
      return 1;
    default:
      return 1;
  }
}

function getAnchorDayMax(frequency) {
  switch (frequency) {
    case 'weekly':
      return 7;
    case 'monthly':
    case 'yearly':
      return 31;
    default:
      return 31;
  }
}

function RecurringRuleCard({ rule, category, onEdit, onDelete, onRun, isDeleting, isRunning }) {
  const frequencyLabels = {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    yearly: 'Yearly',
  };

  const nextRunText = rule.nextRunAt
    ? `Next: ${format(parseISO(rule.nextRunAt), 'MMM d, yyyy')}`
    : 'Not scheduled';

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: category.color + '20' }}
          >
            <span className="w-5 h-5 rounded-full" style={{ backgroundColor: category.color }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-gray-900 dark:text-white truncate">{category.name}</p>
              <span
                className="px-2 py-0.5 text-xs font-medium rounded-full"
                style={{
                  backgroundColor: rule.type === 'income' ? '#22c55e20' : '#ef444420',
                  color: rule.type === 'income' ? '#22c55e' : '#ef4444',
                }}
              >
                {rule.type === 'income' ? 'Income' : 'Expense'}
              </span>
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                {frequencyLabels[rule.frequency]}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {rule.note || 'No description'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRun(rule)}
            disabled={isDeleting || isRunning}
            aria-label={`Run ${category.name} now`}
          >
            <Play className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onEdit(rule)} disabled={isDeleting} aria-label={`Edit ${category.name}`}>
            <Edit className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(rule)} disabled={isDeleting} aria-label={`Delete ${category.name}`}>
            <Trash2 className="w-4 h-4 text-red-600" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-gray-500 dark:text-gray-400">Amount</span>
          <p className="font-medium text-gray-900 dark:text-white">
            {rule.type === 'income' ? '+' : '-'}
            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(rule.amount / 100)}
          </p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Starts</span>
          <p className="font-medium text-gray-900 dark:text-white">{format(parseISO(rule.startDate), 'MMM d, yyyy')}</p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Anchor Day</span>
          <p className="font-medium text-gray-900 dark:text-white">
            {rule.frequency === 'daily' ? 'N/A' : rule.frequency === 'weekly' ? `Day ${rule.anchorDay}` : rule.anchorDay}
          </p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Next Run</span>
          <p className="font-medium text-gray-900 dark:text-white">{nextRunText}</p>
        </div>
      </div>

      {rule.endDate && (
        <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Ends: {format(parseISO(rule.endDate), 'MMM d, yyyy')}
        </div>
      )}

      {!rule.active && (
        <div className="mt-2">
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
            Inactive
          </span>
        </div>
      )}
    </div>
  );
}

export default function Recurring() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [runConfirm, setRunConfirm] = useState(null);

  const { data: recurringData, isLoading, error, refetch } = useRecurringRules();
  const { data: categoriesData } = useCategories();

  const createMutation = useCreateRecurringRule();
  const updateMutation = useUpdateRecurringRule();
  const deleteMutation = useDeleteRecurringRule();
  const runMutation = useRunRecurringRule();

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;
  const isRunning = runMutation.isPending;

  const categories = Array.isArray(categoriesData) ? categoriesData : (categoriesData?.data || []);
  const expenseCategories = categories.filter(c => c.type === 'expense');
  const incomeCategories = categories.filter(c => c.type === 'income');

  const rules = Array.isArray(recurringData) ? recurringData : (recurringData?.data || recurringData?.rules || []);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(recurringSchema),
    defaultValues: {
      type: 'expense',
      frequency: 'monthly',
      amount: '',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      anchorDay: 1,
      active: true,
      note: '',
    },
  });

  const watchedType = watch('type');
  const watchedFrequency = watch('frequency');

  const openCreateModal = useCallback(() => {
    setEditingRule(null);
    reset({
      type: 'expense',
      frequency: 'monthly',
      amount: '',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      anchorDay: 1,
      active: true,
      note: '',
    });
    setIsModalOpen(true);
  }, [reset]);

  const openEditModal = useCallback((rule) => {
    setEditingRule(rule);
    reset({
      categoryId: rule.categoryId,
      type: rule.type,
      frequency: rule.frequency,
      amount: rule.amount / 100,
      startDate: format(parseISO(rule.startDate), 'yyyy-MM-dd'),
      endDate: rule.endDate ? format(parseISO(rule.endDate), 'yyyy-MM-dd') : '',
      anchorDay: rule.anchorDay,
      active: rule.active,
      note: rule.note || '',
    });
    setIsModalOpen(true);
  }, [reset]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingRule(null);
    reset();
  }, [reset]);

  const onSubmit = async (data) => {
    try {
      const payload = {
        ...data,
        amount: Math.round(data.amount * 100),
        anchorDay: data.anchorDay,
        endDate: data.endDate || null,
      };

      if (editingRule) {
        await updateMutation.mutateAsync({ id: editingRule._id, data: payload });
        toast.success(`Rule "${payload.note || 'Recurring rule'}" updated!`);
      } else {
        await createMutation.mutateAsync(payload);
        toast.success(`Rule "${payload.note || 'Recurring rule'}" created successfully!`);
      }
      closeModal();
      refetch();
    } catch (err) {
      toast.error(err.message || 'Failed to save recurring rule');
    }
  };

  const handleDelete = useCallback((rule) => {
    setDeleteConfirm(rule);
  }, []);

  const confirmDelete = async () => {
    if (deleteConfirm) {
      try {
        await deleteMutation.mutateAsync(deleteConfirm._id);
        toast.success('Recurring rule deleted successfully!');
        setDeleteConfirm(null);
        refetch();
      } catch (err) {
        setDeleteConfirm(null);
        toast.error(err.message || 'Failed to delete recurring rule');
      }
    }
  };

  const handleRun = useCallback((rule) => {
    setRunConfirm(rule);
  }, []);

  const confirmRun = async () => {
    if (runConfirm) {
      try {
        const res = await runMutation.mutateAsync();
        const generated = res?.generated ?? res?.data?.generated ?? 0;
        toast.success(`Processed rule. Generated ${generated} transaction(s)!`);
        setRunConfirm(null);
        refetch();
      } catch (err) {
        setRunConfirm(null);
        toast.error(err.message || 'Failed to run recurring rule');
      }
    }
  };

  const handleRunAllDue = async () => {
    try {
      const res = await runMutation.mutateAsync();
      const generated = res?.generated ?? res?.data?.generated ?? 0;
      toast.success(`Processed due rules. Generated ${generated} transaction(s)!`);
      refetch();
    } catch (err) {
      toast.error(err.message || 'Failed to process due recurring rules');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6" role="status" aria-live="polite">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Recurring Transactions</h1>
            <p className="text-gray-500 dark:text-gray-400">Manage recurring income and expense rules</p>
          </div>
          <Button disabled>
            <Plus className="w-4 h-4" />
            Add Rule
          </Button>
        </div>
        <Card className="p-6">
          <div className="text-center py-12">
            <Spinner />
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6" role="alert">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Recurring Transactions</h1>
            <p className="text-gray-500 dark:text-gray-400">Manage recurring income and expense rules</p>
          </div>
          <Button onClick={() => refetch()}>
            <Plus className="w-4 h-4" />
            Retry
          </Button>
        </div>
        <Card className="p-6">
          <EmptyState title="Failed to load recurring rules" description={error.message} />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Recurring Transactions</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage recurring income and expense rules</p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4" />
          Add Rule
        </Button>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Active Rules</h2>
          <Button variant="secondary" onClick={handleRunAllDue} loading={isRunning}>
            <Repeat className="w-4 h-4" />
            Run Due Now
          </Button>
        </div>

        {rules.length === 0 ? (
          <div className="text-center py-12">
            <Repeat className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">No recurring rules set up</p>
            <Button onClick={openCreateModal}>
              <Plus className="w-4 h-4" />
              Create your first rule
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {rules.map((rule) => {
              const category = categories.find(c => c._id === rule.categoryId);
              return (
                <RecurringRuleCard
                  key={rule._id}
                  rule={rule}
                  category={category}
                  onEdit={openEditModal}
                  onDelete={handleDelete}
                  onRun={handleRun}
                  isDeleting={isDeleting}
                  isRunning={isRunning}
                />
              );
            })}
          </div>
        )}
      </Card>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingRule ? 'Edit Recurring Rule' : 'Add Recurring Rule'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Type"
              options={[
                { value: 'expense', label: 'Expense' },
                { value: 'income', label: 'Income' },
              ]}
              {...register('type')}
              onChange={(e) => {
                register('type').onChange(e);
                setValue('categoryId', '');
              }}
            />

            <Select
              label="Category"
              options={
                (watchedType === 'income' ? incomeCategories : expenseCategories).map(c => ({
                  value: c._id,
                  label: c.name,
                }))
              }
              placeholder="Select a category"
              error={errors.categoryId?.message}
              {...register('categoryId')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              error={errors.amount?.message}
              {...register('amount')}
            />

            <Select
              label="Frequency"
              options={FREQUENCY_OPTIONS}
              {...register('frequency')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              error={errors.startDate?.message}
              {...register('startDate')}
            />

            <Input
              label="End Date (Optional)"
              type="date"
              error={errors.endDate?.message}
              {...register('endDate')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <Input
              label={`Anchor Day (${getAnchorDayLabel(watchedFrequency)})`}
              type="number"
              min={getAnchorDayMin(watchedFrequency)}
              max={getAnchorDayMax(watchedFrequency)}
              error={errors.anchorDay?.message}
              {...register('anchorDay')}
            />

            <div className="flex items-center gap-2.5 pt-3 sm:pt-6">
              <input
                type="checkbox"
                id="active"
                {...register('active')}
                className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="active" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                Active Rule
              </label>
            </div>
          </div>

          <Input
            label="Note (Optional)"
            placeholder="e.g. Netflix subscription, Rent, Salary"
            error={errors.note?.message}
            {...register('note')}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>
              {editingRule ? 'Save Changes' : 'Create Rule'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={confirmDelete}
        title="Delete Recurring Rule"
        message={deleteConfirm
          ? `Are you sure you want to delete "${deleteConfirm.note || 'this rule'}"?`
          : 'Are you sure you want to delete this recurring rule?'
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        loading={isDeleting}
      />

      <ConfirmDialog
        isOpen={!!runConfirm}
        onClose={() => setRunConfirm(null)}
        onConfirm={confirmRun}
        title="Run Recurring Rule Now"
        message={runConfirm
          ? `Run "${runConfirm.note || 'this rule'}" now? This will create a transaction immediately.`
          : 'Run this recurring rule now?'
        }
        confirmText="Run Now"
        cancelText="Cancel"
        variant="default"
        loading={isRunning}
      />
    </div>
  );
}