import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';
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
  date: z.string().min(1, 'Date is required'),
  note: z.string().max(200, 'Note too long').optional(),
});

export default function TransactionForm({ initial, onSubmit, onCancel, categories = [], loading }) {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'expense',
      categoryId: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      note: '',
      ...initial,
    },
  });

  const type = watch('type');
  const filteredCategories = categories.filter(c => c.type === type);

  useEffect(() => {
    if (initial?.categoryId && !filteredCategories.find(c => c.id === initial.categoryId)) {
      setValue('categoryId', '');
    }
  }, [type, filteredCategories, initial?.categoryId, setValue]);

  const handleSubmitForm = (data) => {
    const amountMinor = Math.round(parseFloat(data.amount) * 100);
    const date = parseDateInTz(data.date, Intl.DateTimeFormat().resolvedOptions().timeZone);
    onSubmit({ ...data, amount: amountMinor, date: date.toISOString() });
  };

  if (!initial && !onSubmit) return null;

  return (
    <Modal open={true} onClose={onCancel} title={initial ? 'Edit Transaction' : 'Add Transaction'} size="md">
      <form onSubmit={handleSubmit(handleSubmitForm)} className="space-y-4">
        <div className="flex gap-4">
          <label className="flex items-center gap-2 flex-1 p-3 border rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700">
            <input
              type="radio"
              value="income"
              {...register('type')}
              className="text-indigo-600 focus:ring-indigo-500"
            />
            <span className="font-medium text-gray-900 dark:text-white">Income</span>
          </label>
          <label className="flex items-center gap-2 flex-1 p-3 border rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700">
            <input
              type="radio"
              value="expense"
              {...register('type')}
              className="text-indigo-600 focus:ring-indigo-500"
            />
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

        <div className="grid grid-cols-2 gap-4">
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
        </div>

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