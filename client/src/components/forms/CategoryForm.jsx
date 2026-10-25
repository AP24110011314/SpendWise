import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Modal from '../ui/Modal';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(40, 'Name too long'),
  type: z.enum(['income', 'expense']),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color'),
  icon: z.string().min(1, 'Icon is required'),
});

const ICONS = [
  'tag', 'utensils', 'shopping-cart', 'home', 'zap', 'heart-pulse',
  'shopping-bag', 'film', 'graduation-cap', 'plane', 'credit-card', 'help-circle',
  'dollar-sign', 'briefcase', 'gift', 'trending-up', 'plus-circle',
];

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#64748b',
];

export default function CategoryForm({ initial, onSubmit, onCancel, loading }) {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      type: 'expense',
      color: '#6366f1',
      icon: 'tag',
      ...initial,
    },
  });

  const handleSubmitForm = (data) => onSubmit(data);

  return (
    <Modal open={true} onClose={onCancel} title={initial ? 'Edit Category' : 'Add Category'} size="md">
      <form onSubmit={handleSubmit(handleSubmitForm)} className="space-y-4">
        <Input
          label="Name"
          placeholder="Category name"
          error={errors.name?.message}
          {...register('name')}
        />

        <Select
          label="Type"
          options={[
            { value: 'income', label: 'Income' },
            { value: 'expense', label: 'Expense' },
          ]}
          error={errors.type?.message}
          disabled={!!initial}
          {...register('type')}
        />

        <div>
          <label className="label">Color</label>
          <div className="grid grid-cols-8 gap-2">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setValue('color', color)}
                className={`w-8 h-8 rounded-lg border-2 transition-all ${
                  watch('color') === color ? 'border-indigo-600 scale-110' : 'border-transparent hover:border-gray-300'
                }`}
                style={{ backgroundColor: color }}
                aria-label={`Color ${color}`}
                aria-pressed={watch('color') === color}
              />
            ))}
          </div>
          {errors.color && <p className="mt-1 text-sm text-red-600">{errors.color.message}</p>}
        </div>

        <div>
          <label className="label">Icon</label>
          <div className="grid grid-cols-8 gap-2 max-h-40 overflow-y-auto">
            {ICONS.map((iconName) => (
              <button
                key={iconName}
                type="button"
                onClick={() => setValue('icon', iconName)}
                className={`p-2 rounded-lg border-2 transition-all flex items-center justify-center ${
                  watch('icon') === iconName ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30' : 'border-transparent hover:border-gray-300'
                }`}
                aria-label={`Icon ${iconName}`}
                aria-pressed={watch('icon') === iconName}
              >
                <span className="text-lg capitalize">{iconName.replace(/-/g, ' ')}</span>
              </button>
            ))}
          </div>
          {errors.icon && <p className="mt-1 text-sm text-red-600">{errors.icon.message}</p>}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {initial ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}