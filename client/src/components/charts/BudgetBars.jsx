import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatMoney } from '@/lib/money';

const STATUS_COLORS = {
  ok: '#22c55e',
  warning: '#f59e0b',
  exceeded: '#ef4444',
};

export default function BudgetBars({ data, currency = 'INR' }) {
  if (!data || data.length === 0) {
    return (
      <div className="card p-8" role="img" aria-label="Budget bars chart - no budgets set">
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">No budgets set for this month</p>
          <a href="/budgets" className="text-indigo-600 hover:underline text-sm">Create a budget</a>
        </div>
      </div>
    );
  }

  // Sort by spent amount descending
  const sortedData = [...data].sort((a, b) => b.spent - a.spent);

  return (
    <div className="card" role="img" aria-label="Budget vs actual spending">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Budget Progress</h3>
        <div className="relative h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sortedData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis type="number" tickFormatter={(value) => formatMoney(value, currency)} stroke="#9ca3af" />
              <YAxis dataKey="categoryName" type="category" stroke="#9ca3af" width={120} />
              <Tooltip
                formatter={(value, name) => [
                  formatMoney(value, currency),
                  name === 'spent' ? 'Spent' : 'Budget Limit'
                ]}
                labelFormatter={(name) => name}
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Bar
                dataKey="spent"
                name="Spent"
                radius={[0, 4, 4, 0]}
              >
                {sortedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status]} />
                ))}
              </Bar>
              <Bar dataKey="limit" name="Budget Limit" fill="transparent" stroke="#9ca3af" strokeWidth={2} strokeDasharray="5 5" radius={[4, 0, 0, 4]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: STATUS_COLORS.ok }} />
            <span className="text-gray-600 dark:text-gray-400">OK</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: STATUS_COLORS.warning }} />
            <span className="text-gray-600 dark:text-gray-400">Warning</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: STATUS_COLORS.exceeded }} />
            <span className="text-gray-600 dark:text-gray-400">Exceeded</span>
          </div>
        </div>
      </div>
    </div>
  );
}