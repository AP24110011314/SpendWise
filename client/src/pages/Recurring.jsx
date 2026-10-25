import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Plus, Repeat } from 'lucide-react';

export default function Recurring() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Recurring Transactions</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage recurring income and expense rules</p>
        </div>
        <Button>
          <Plus className="w-4 h-4" />
          Add Rule
        </Button>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Active Rules</h2>
          <Button variant="secondary">
            <Repeat className="w-4 h-4" />
            Run Due Now
          </Button>
        </div>
        <div className="text-center py-12">
          <Repeat className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 mb-4">No recurring rules set up</p>
          <Button>
            <Plus className="w-4 h-4" />
            Create your first rule
          </Button>
        </div>
      </Card>
    </div>
  );
}