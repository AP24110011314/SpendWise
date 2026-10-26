import { useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/context/AuthContext';
import { useTransactions, useCreateTransaction, useUpdateTransaction, useDeleteTransaction } from '@/hooks';
import { useCategories } from '@/hooks';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import Spinner from '@/components/ui/Spinner';
import { Plus, Search, Filter, Edit, Trash2, ChevronDown, ChevronUp, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

const transactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  categoryId: z.string().min(1, 'Category is required'),
  amount: z.coerce.number()
    .positive('Amount must be positive')
    .max(999999999, 'Amount is too large')
    .refine(val => Number(val.toFixed(2)) === val, 'Amount can have at most 2 decimal places'),
  date: z.string().min(1, 'Date is required').refine(date => {
    const selected = new Date(date.includes('T') ? date : date + 'T00:00:00');
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    return selected <= endOfToday;
  }, 'Date cannot be in the future'),
  note: z.string().max(200, 'Note must be 200 characters or less').optional(),
});

const filterSchema = z.object({
  search: z.string().optional(),
  type: z.enum(['', 'income', 'expense']).optional(),
  categoryId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['date', 'amount', 'createdAt']).default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

function formatAmount(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount / 100);
}

function CategoryBadge({ name, color, type }) {
  const bgColor = type === 'income' ? `${color}20` : `${color}20`;
  const textColor = color;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      {name}
    </span>
  );
}

export default function Transactions() {
  const { user } = useAuth();
  const currency = user?.currency || 'INR';
  const [filters, setFilters] = useState({
    search: '',
    type: '',
    categoryId: '',
    dateFrom: '',
    dateTo: '',
    page: 1,
    limit: 20,
    sortBy: 'date',
    sortOrder: 'desc',
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const { data: transactionsData, isLoading, error, refetch } = useTransactions(filters);
  const { data: categoriesData } = useCategories();
  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const deleteMutation = useDeleteTransaction();

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;

  const categories = Array.isArray(categoriesData) ? categoriesData : (categoriesData?.data || []);
  const expenseCategories = categories.filter(c => c.type === 'expense');
  const incomeCategories = categories.filter(c => c.type === 'income');

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: 'expense',
      amount: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      note: '',
    },
  });

  const watchedType = watch('type');

  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  }, []);

  const handleSort = useCallback((sortBy) => {
    setFilters(prev => ({
      ...prev,
      sortBy,
      sortOrder: prev.sortBy === sortBy && prev.sortOrder === 'desc' ? 'asc' : 'desc',
    }));
  }, []);

  const location = useLocation();
  const navigate = useNavigate();

  const openCreateModal = useCallback(() => {
    setEditingTransaction(null);
    reset({
      type: 'expense',
      amount: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      note: '',
    });
    setIsModalOpen(true);
  }, [reset]);

  useEffect(() => {
    if (location.state?.openAdd || location.search.includes('add=true')) {
      openCreateModal();
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, openCreateModal, navigate]);

  const openEditModal = useCallback((transaction) => {
    setEditingTransaction(transaction);
    reset({
      type: transaction.type,
      categoryId: transaction.categoryId,
      amount: transaction.amount / 100,
      date: format(parseISO(transaction.date), 'yyyy-MM-dd'),
      note: transaction.note || '',
    });
    setIsModalOpen(true);
  }, [reset]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingTransaction(null);
    reset();
  }, [reset]);

  const onSubmit = async (data) => {
    try {
      const dateStr = data.date.includes('T') ? data.date : `${data.date}T12:00:00.000Z`;
      const payload = {
        ...data,
        amount: Math.round(data.amount * 100),
        date: dateStr,
      };

      if (editingTransaction) {
        await updateMutation.mutateAsync({ id: editingTransaction._id, data: payload });
        toast.success('Transaction updated successfully!');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Transaction created successfully!');
      }
      closeModal();
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || err.message || 'Failed to save transaction');
    }
  };

  const handleDelete = async (transaction) => {
    setDeleteConfirm(transaction);
  };

  const confirmDelete = async () => {
    if (deleteConfirm) {
      try {
        await deleteMutation.mutateAsync(deleteConfirm._id);
        toast.success('Transaction deleted successfully!');
        setDeleteConfirm(null);
        refetch();
      } catch (err) {
        setDeleteConfirm(null);
        toast.error(err.response?.data?.error?.message || err.message || 'Failed to delete transaction');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6" role="status" aria-live="polite">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transactions</h1>
            <p className="text-gray-500 dark:text-gray-400">Manage your income and expenses</p>
          </div>
          <Button disabled>
            <Plus className="w-4 h-4" />
            Add Transaction
          </Button>
        </div>
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Note</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {[...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <Spinner />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transactions</h1>
            <p className="text-gray-500 dark:text-gray-400">Manage your income and expenses</p>
          </div>
          <Button onClick={() => refetch()}>
            <Plus className="w-4 h-4" />
            Retry
          </Button>
        </div>
        <Card>
          <EmptyState title="Failed to load transactions" description={error.message} />
        </Card>
      </div>
    );
  }

  const transactions = Array.isArray(transactionsData)
    ? transactionsData
    : (transactionsData?.data || []);
  const pagination = transactionsData?.pagination || { page: 1, totalPages: 1, total: transactions.length };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transactions</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage your income and expenses</p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4" />
          Add Transaction
        </Button>
      </div>

      <Card>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="w-4 h-4 mr-1" />
              Filters
            </Button>
          </div>

          {showFilters && (
            <div className="space-y-4" role="search">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search transactions..."
                    className="input pl-10"
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                  />
                </div>
                <Select
                  options={[
                    { value: '', label: 'All Types' },
                    { value: 'income', label: 'Income' },
                    { value: 'expense', label: 'Expense' },
                  ]}
                  value={filters.type}
                  onChange={(e) => handleFilterChange('type', e.target.value)}
                  className="w-40"
                />
                <Select
                  options={[
                    { value: '', label: 'All Categories' },
                    ...categories.map(c => ({ value: c._id, label: c.name })),
                  ]}
                  value={filters.categoryId}
                  onChange={(e) => handleFilterChange('categoryId', e.target.value)}
                  className="w-48"
                />
                <Input
                  type="date"
                  placeholder="From"
                  className="w-36"
                  value={filters.dateFrom}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                />
                <Input
                  type="date"
                  placeholder="To"
                  className="w-36"
                  value={filters.dateTo}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Mobile Cards View (sm:hidden) */}
        <div className="sm:hidden divide-y divide-gray-200 dark:divide-gray-700">
          {transactions.length === 0 ? (
            <div className="p-8 text-center">
              <EmptyState
                title="No transactions found"
                description={Object.keys(filters).some(k => filters[k]) ? 'Try adjusting your filters' : 'Add your first transaction to get started'}
                action={<Button onClick={openCreateModal}><Plus className="w-4 h-4" /> Add Transaction</Button>}
              />
            </div>
          ) : (
            transactions.map((transaction) => {
              const category = categories.find(c => c._id === transaction.categoryId);
              return (
                <div key={transaction._id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {category && (
                          <CategoryBadge name={category.name} color={category.color} type={category.type} />
                        )}
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {format(parseISO(transaction.date), 'MMM d, yyyy')}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {transaction.note || 'No note'}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className={`text-base font-bold ${
                        transaction.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {transaction.type === 'income' ? '+' : '-'}{formatAmount(transaction.amount, currency)}
                      </p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(transaction)}
                          aria-label={`Edit ${transaction.note || 'transaction'}`}
                          className="p-1 h-7 w-7"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(transaction)}
                          aria-label={`Delete ${transaction.note || 'transaction'}`}
                          disabled={isDeleting}
                          className="p-1 h-7 w-7 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table View (hidden sm:block) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full" role="grid">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => handleSort('date')}
                  scope="col"
                >
                  <div className="flex items-center gap-1">
                    Date
                    {filters.sortBy === 'date' && (
                      filters.sortOrder === 'desc' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" scope="col">Note</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" scope="col">Category</th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => handleSort('amount')}
                  scope="col"
                >
                  <div className="flex items-center justify-end gap-1">
                    Amount
                    {filters.sortBy === 'amount' && (
                      filters.sortOrder === 'desc' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" scope="col">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <EmptyState
                      title="No transactions found"
                      description={Object.keys(filters).some(k => filters[k]) ? 'Try adjusting your filters' : 'Add your first transaction to get started'}
                      action={<Button onClick={openCreateModal}><Plus className="w-4 h-4" /> Add Transaction</Button>}
                    />
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => {
                  const category = categories.find(c => c._id === transaction.categoryId);
                  return (
                    <tr key={transaction._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                        {format(parseISO(transaction.date), 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white max-w-xs truncate">
                        {transaction.note || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {category && (
                          <CategoryBadge name={category.name} color={category.color} type={category.type} />
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium">
                        <span
                          className={transaction.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
                        >
                          {transaction.type === 'income' ? '+' : '-'}{formatAmount(transaction.amount, currency)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(transaction)}
                            aria-label={`Edit ${transaction.note || 'transaction'}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(transaction)}
                            aria-label={`Delete ${transaction.note || 'transaction'}`}
                            disabled={isDeleting}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={(page) => handleFilterChange('page', page)}
            />
          </div>
        )}
      </Card>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingTransaction ? 'Edit Transaction' : 'Add Transaction'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Select
            label="Type"
            options={[
              { value: 'income', label: 'Income' },
              { value: 'expense', label: 'Expense' },
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

          <Input
            label="Amount"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            error={errors.amount?.message}
            {...register('amount')}
          />

          <Input
            label="Date"
            type="date"
            error={errors.date?.message}
            {...register('date')}
          />

          <Input
            label="Note (optional)"
            placeholder="What was this for?"
            error={errors.note?.message}
            {...register('note')}
          />

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>
              {editingTransaction ? 'Save Changes' : 'Create Transaction'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={confirmDelete}
        title="Delete Transaction"
        message="Are you sure you want to delete this transaction? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        loading={isDeleting}
      />
    </div>
  );
}