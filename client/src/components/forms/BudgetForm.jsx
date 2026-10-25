import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Modal from '../ui/Modal';

const schema = z.object({
  categoryId: z.string().nullable(),
  limit: z.string().min(1, 'Limit is required').refine(val => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, 'Invalid limit'),
  alertThreshold: z.number().min(50).max(100).default(80),
});

export default function BudgetForm({ initial, onSubmit, onCancel, categories = [], loading, month }) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      categoryId: null,
      limit: '',
      alertThreshold: 80,
      ...initial,
    },
  });

  const handleSubmitForm = (data) => {
    const limitMinor = Math.round(parseFloat(data.limit) * 100);
    onSubmit({ ...data, limit: limitMinor, month });
  };

  return (
    <Modal open={true} onClose={onCancel} title={initial ? 'Edit Budget' : 'Add Budget'} size="md">
      <form onSubmit={handleSubmit(handleSubmitForm)} className="space-y-4">
        <Select
          label="Category"
          options={[
            { value: '', label: 'Overall (all expenses)' },
            ...categories.filter(c => c.type === 'expense').map(c => ({ value: c.id, label: c.name }))
          ]}
          placeholder="Select category (or Overall)"
          error={errors.categoryId?.message}
          {...register('categoryId')}
        />

        <Input
          label="Monthly Limit"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0.00"
          error={errors.limit?.message}
          {...register('limit')}
        />

        <div>
          <label className="label">Alert Threshold: {watch('alertThreshold') || 80}%</label>
          <input
            type="range"
            min="50"
            max="100"
            step="1"
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            {...register('alertThreshold', { valueAsNumber: true })}
          />
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