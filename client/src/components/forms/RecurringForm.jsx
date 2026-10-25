import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Modal from '../ui/Modal';
import { parseDateInTz } from '@/lib/dates';

const schema = z.object({
  type: z.enum(['income', 'expense']),
  categoryId: z.string().min(1, 'Category is required'),
  amount: z.string().min(1, 'Amount is required').refine(val => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0 && num <= 1000000000;
  }, 'Invalid amount'),
  note: z.string().max(200, 'Note too long').optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
});

export default function RecurringForm({ initial, onSubmit, onCancel, categories = [], loading }) {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'expense',
      categoryId: '',
      amount: '',
      note: '',
      frequency: 'monthly',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      ...initial,
    },
  });

  const type = watch('type');
  const frequency = watch('frequency');
  const filteredCategories = categories.filter(c => c.type === type);

  const handleSubmitForm = (data) => {
    const amountMinor = Math.round(parseFloat(data.amount) * 100);
    const startDate = parseDateInTz(data.startDate, Intl.DateTimeFormat().resolvedOptions().timeZone);
    const endDate = data.endDate ? parseDateInTz(data.endDate, Intl.DateTimeFormat().resolvedOptions().timeZone) : null;
    onSubmit({ ...data, amount: amountMinor, startDate: startDate.toISOString(), endDate: endDate?.toISOString() });
  };

  return (
    <Modal open={true} onClose={onCancel} title={initial ? 'Edit Recurring Rule' : 'Add Recurring Rule'} size="md">
      <form onSubmit={handleSubmit(handleSubmitForm)} className="space-y-4">
        <div className="flex gap-4">
          <label className="flex items-center gap-2 flex-1 p-3 border rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700">
            <input type="radio" value="income" {...register('type')} className="text-indigo-600 focus:ring-indigo-500" />
            <span className="font-medium text-gray-900 dark:text-white">Income</span>
          </label>
          <label className="flex items-center gap-2 flex-1 p-3 border rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700">
            <input type="radio" value="expense" {...register('type')} className="text-indigo-600 focus:ring-indigo-500" />
            <span className="font-medium text-gray-900 dark:text-white">Expense</span>
          </label>
        </div>

        <Select
          label="Category"
          options={filteredCategories.map(c => ({ value: c.id, label: c.name }))}
          placeholder="Select category"
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

        <Select
          label="Frequency"
          options={[
            { value: 'daily', label: 'Daily' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'monthly', label: 'Monthly' },
            { value: 'yearly', label: 'Yearly' },
          ]}
          error={errors.frequency?.message}
          {...register('frequency')}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Start Date"
            type="date"
            error={errors.startDate?.message}
            {...register('startDate')}
          />
          <Input
            label="End Date (optional)"
            type="date"
            error={errors.endDate?.message}
            {...register('endDate')}
          />
        </div>

        {frequency === 'monthly' || frequency === 'yearly' ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            For monthly/yearly rules, the day of month is taken from the start date.
            If the day doesn't exist in a month (e.g., Jan 31 → Feb), it clamps to the last day of that month.
          </p>
        ) : null}

        <Input
          label="Note (optional)"
          type="text"
          placeholder="Add a note..."
          error={errors.note?.message}
          {...register('note')}
        />

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