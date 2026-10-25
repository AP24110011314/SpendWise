import { useAuth } from '@/context/AuthContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import MonthPicker from '@/components/ui/MonthPicker';
import { formatMonth } from '@/lib/dates';
import { Plus, Target } from 'lucide-react';

export default function Budgets() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Budgets</h1>
          <p className="text-gray-500 dark:text-gray-400">Set monthly spending limits</p>
        </div>
        <div className="flex items-center gap-4">
          <MonthPicker value={formatMonth(new Date().toISOString().split('T')[0].substring(0,7))} onChange={() => {}} />
          <Button>
            <Plus className="w-4 h-4" />
            Add Budget
          </Button>
        </div>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Monthly Budgets</h2>
        </div>
        <div className="text-center py-12">
          <Target className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 mb-4">No budgets set for this month</p>
          <Button>
            <Plus className="w-4 h-4" />
            Create your first budget
          </Button>
        </div>
      </Card>
    </div>
  );
}