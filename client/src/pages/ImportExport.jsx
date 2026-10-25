import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { UploadCloud, Download, FileText } from 'lucide-react';

export default function ImportExport() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Import / Export</h1>
          <p className="text-gray-500 dark:text-gray-400">Import transactions from CSV or export your data</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <UploadCloud className="w-8 h-8 text-indigo-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Import CSV</h3>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mb-4">Upload a CSV file with your transactions</p>
          <Button>
            <UploadCloud className="w-4 h-4" />
            Choose File
          </Button>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Download className="w-8 h-8 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Export CSV</h3>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mb-4">Download your transactions as a CSV file</p>
          <Button variant="secondary">
            <Download className="w-4 h-4" />
            Export Transactions
          </Button>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Import History
        </h3>
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">No imports yet</p>
        </div>
      </Card>
    </div>
  );
}