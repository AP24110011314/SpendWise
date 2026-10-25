import { BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatMoney } from '@/lib/money';

export default function TrendChart({ data, currency = 'INR' }) {
  if (!data || data.length === 0) {
    return (
      <div className="card p-8" role="img" aria-label="Trend chart - no data">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500 dark:text-gray-400">No data for trend chart</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card" role="img" aria-label="6-month income vs expense trend">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Income vs Expenses (6 months)</h3>
        <div className="relative h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis type="number" tickFormatter={(value) => formatMoney(value, currency)} stroke="#9ca3af" />
              <YAxis dataKey="month" type="category" stroke="#9ca3af" width={60} />
              <Tooltip
                formatter={(value, name) => [formatMoney(value, currency), name === 'income' ? 'Income' : name === 'expense' ? 'Expenses' : 'Net']}
                labelFormatter={(month) => month}
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Bar dataKey="income" fill="#22c55e" name="Income" radius={[0, 4, 4, 0]} />
              <Bar dataKey="expense" fill="#ef4444" name="Expenses" radius={[4, 0, 0, 4]} />
              <Line dataKey="net" stroke="#6366f1" strokeWidth={2} dot={false} type="monotone" name="Net" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}