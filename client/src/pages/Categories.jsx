import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Plus, Utensils, DollarSign } from 'lucide-react';

export default function Categories() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Categories</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage your income and expense categories</p>
        </div>
        <Button>
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
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">No expense categories yet</p>
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
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">No income categories yet</p>
          </div>
        </Card>
      </div>
    </div>
  );
}