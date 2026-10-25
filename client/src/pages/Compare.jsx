import Card from '@/components/ui/Card';
import MonthPicker from '@/components/ui/MonthPicker';
import { formatMonth } from '@/lib/dates';
import { GitCompare } from 'lucide-react';

export default function Compare() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Compare Months</h1>
          <p className="text-gray-500 dark:text-gray-400">Compare spending between two months</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Month A</h3>
          <MonthPicker value={formatMonth(new Date().toISOString().split('T')[0].substring(0,7))} onChange={() => {}} />
        </Card>
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Month B</h3>
          <MonthPicker value={formatMonth(new Date().toISOString().split('T')[0].substring(0,7))} onChange={() => {}} />
        </Card>
      </div>

      <Card className="p-6 mt-4">
        <div className="text-center py-12">
          <GitCompare className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Select two months to compare</p>
        </div>
      </Card>
    </div>
  );
}