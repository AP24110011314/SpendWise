import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '@/hooks';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import Spinner from '@/components/ui/Spinner';
import { Plus, Edit, Trash2, Utensils, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';

const categorySchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Name is required')
    .max(40, 'Name must be 40 characters or less'),
  type: z.enum(['income', 'expense']),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format'),
  isDefault: z.boolean().default(false),
});

const DEFAULT_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#64748b', '#71717a', '#78716c',
];

function CategoryCard({ category, onEdit, onDelete, isDeleting }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/60">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${category.color}25` }}
        >
          <span
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: category.color }}
          />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 dark:text-white truncate">{category.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{category.type}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap">
        <span
          className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full whitespace-nowrap"
          style={{
            backgroundColor: category.type === 'income' ? '#22c55e20' : '#ef444420',
            color: category.type === 'income' ? '#22c55e' : '#ef4444',
          }}
        >
          {category.type === 'income' ? 'Income' : 'Expense'}
        </span>
        {category.isDefault && (
          <span
            className="inline-flex items-center px-2 py-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-200/80 dark:bg-gray-700/80 rounded-full whitespace-nowrap"
            title="System default categories are protected and cannot be deleted"
          >
            Default
          </span>
        )}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => onEdit(category)} disabled={isDeleting} aria-label={`Edit ${category.name}`} className="p-1.5 h-8 w-8">
            <Edit className="w-4 h-4" />
          </Button>
          {!category.isDefault ? (
            <Button variant="ghost" size="sm" onClick={() => onDelete(category)} disabled={isDeleting} aria-label={`Delete ${category.name}`} className="p-1.5 h-8 w-8 text-red-600 hover:text-red-700">
              <Trash2 className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled
              title="Default system categories cannot be deleted"
              aria-label={`Default category ${category.name} cannot be deleted`}
              className="p-1.5 h-8 w-8 opacity-40 cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4 text-gray-400 dark:text-gray-600" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Categories() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [reassignCategoryId, setReassignCategoryId] = useState('');

  const { data: categoriesData, isLoading, error, refetch } = useCategories();
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;

  // Handle both array directly (unwrapped by client) or { data: [...] }
  const categories = Array.isArray(categoriesData) ? categoriesData : (categoriesData?.data || []);
  const expenseCategories = categories.filter(c => c.type === 'expense');
  const incomeCategories = categories.filter(c => c.type === 'income');

  const { register, handleSubmit, reset, setValue, watch, clearErrors, formState: { errors } } = useForm({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      type: 'expense',
      color: DEFAULT_COLORS[0],
      isDefault: false,
    },
  });

  const openCreateModal = useCallback(() => {
    setEditingCategory(null);
    clearErrors();
    reset({
      type: 'expense',
      color: DEFAULT_COLORS[0],
      name: '',
      isDefault: false,
    });
    setIsModalOpen(true);
  }, [reset, clearErrors]);

  const openEditModal = useCallback((category) => {
    setEditingCategory(category);
    clearErrors();
    reset({
      name: category.name,
      type: category.type,
      color: category.color,
      isDefault: category.isDefault,
    });
    setIsModalOpen(true);
  }, [reset, clearErrors]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingCategory(null);
    reset();
  }, [reset]);

  const onSubmit = async (data) => {
    const payload = {
      name: data.name.trim(),
      type: data.type,
      color: data.color,
    };
    try {
      if (editingCategory) {
        await updateMutation.mutateAsync({ id: editingCategory._id, data: payload });
        toast.success(`Category "${payload.name}" updated!`);
      } else {
        await createMutation.mutateAsync(payload);
        toast.success(`Category "${payload.name}" created successfully!`);
      }
      closeModal();
      refetch();
    } catch (err) {
      if (err.status === 409 || err.code === 'CONFLICT') {
        toast.error(`A ${payload.type} category named "${payload.name}" already exists.`);
      } else {
        toast.error(err.message || 'Failed to save category');
      }
    }
  };

  const handleDelete = useCallback((category) => {
    setDeleteConfirm(category);
    setReassignCategoryId('');
  }, []);

  const confirmDelete = async () => {
    if (deleteConfirm) {
      try {
        const payload = reassignCategoryId
          ? { id: deleteConfirm._id, reassignTo: reassignCategoryId }
          : deleteConfirm._id;
        await deleteMutation.mutateAsync(payload);
        toast.success(`Category "${deleteConfirm.name}" deleted!`);
        setDeleteConfirm(null);
        setReassignCategoryId('');
        refetch();
      } catch (err) {
        if (err.status === 409 || err.code === 'CONFLICT') {
          toast.error('Category is in use. Please select a replacement category below to reassign existing records.');
        } else {
          setDeleteConfirm(null);
          setReassignCategoryId('');
          toast.error(err.message || 'Failed to delete category');
        }
      }
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6" role="status" aria-live="polite">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Categories</h1>
            <p className="text-gray-500 dark:text-gray-400">Manage your income and expense categories</p>
          </div>
          <Button disabled>
            <Plus className="w-4 h-4" />
            Add Category
          </Button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                <Utensils className="w-5 h-5 text-red-500" />
                Expense Categories
              </h2>
            </div>
            <div className="p-4">
              <Spinner />
            </div>
          </Card>
          <Card>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                <DollarSign className="w-5 h-5 text-green-500" />
                Income Categories
              </h2>
            </div>
            <div className="p-4">
              <Spinner />
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6" role="alert">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Categories</h1>
            <p className="text-gray-500 dark:text-gray-400">Manage your income and expense categories</p>
          </div>
          <Button onClick={() => refetch()}>
            <Plus className="w-4 h-4" />
            Retry
          </Button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <EmptyState title="Failed to load categories" description={error.message} />
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Categories</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage your income and expense categories</p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4" />
          Add Category
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
              <Utensils className="w-5 h-5 text-red-500" />
              Expense Categories
            </h2>
          </div>
          <div className="p-4 space-y-3">
            {expenseCategories.length === 0 ? (
              <EmptyState title="No expense categories" description="Create your first expense category" />
            ) : (
              expenseCategories.map((category) => (
                <CategoryCard
                  key={category._id}
                  category={category}
                  onEdit={openEditModal}
                  onDelete={handleDelete}
                  isDeleting={isDeleting}
                />
              ))
            )}
          </div>
        </Card>

        <Card>
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
              <DollarSign className="w-5 h-5 text-green-500" />
              Income Categories
            </h2>
          </div>
          <div className="p-4 space-y-3">
            {incomeCategories.length === 0 ? (
              <EmptyState title="No income categories" description="Create your first income category" />
            ) : (
              incomeCategories.map((category) => (
                <CategoryCard
                  key={category._id}
                  category={category}
                  onEdit={openEditModal}
                  onDelete={handleDelete}
                  isDeleting={isDeleting}
                />
              ))
            )}
          </div>
        </Card>
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingCategory ? 'Edit Category' : 'Add Category'}>
        <form
          onSubmit={handleSubmit(onSubmit, (formErrors) => {
            if (formErrors.name?.message) {
              toast.error(formErrors.name.message);
            }
          })}
          className="space-y-4"
        >
          <Input
            label="Name"
            placeholder="e.g., Groceries, Salary"
            error={errors.name?.message}
            {...register('name')}
          />

          <Select
            label="Type"
            options={[
              { value: 'expense', label: 'Expense' },
              { value: 'income', label: 'Income' },
            ]}
            error={errors.type?.message}
            {...register('type')}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Color</label>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setValue('color', color)}
                  className={`w-8 h-8 rounded-lg border-2 transition-all ${
                    watch('color') === color ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={color}
                  aria-pressed={watch('color') === color}
                />
              ))}
            </div>
            {errors.color && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.color.message}</p>}
          </div>

          {editingCategory?.isDefault && (
            <p className="text-sm text-gray-500 dark:text-gray-400">Default categories cannot be deleted</p>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>
              {editingCategory ? 'Save Changes' : 'Create Category'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => { setDeleteConfirm(null); setReassignCategoryId(''); }}
        title="Delete Category"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Are you sure you want to delete <strong className="text-gray-900 dark:text-white">"{deleteConfirm?.name}"</strong>?
          </p>
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
            If this category is used by existing transactions, budgets, or recurring rules, select a replacement category below to safely reassign them.
          </div>
          <div>
            <Select
              label="Reassign existing records to:"
              options={[
                { value: '', label: 'None (only if category is unused)' },
                ...categories
                  .filter(c => c._id !== deleteConfirm?._id && c.type === deleteConfirm?.type)
                  .map(c => ({ value: c._id, label: `${c.name} (${c.type})` })),
              ]}
              value={reassignCategoryId}
              onChange={(e) => setReassignCategoryId(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setDeleteConfirm(null); setReassignCategoryId(''); }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={confirmDelete}
              loading={isDeleting}
            >
              Delete Category
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}