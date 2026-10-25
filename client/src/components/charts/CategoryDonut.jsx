import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { formatMoney } from '@/lib/money';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];

export default function CategoryDonut({ data, currency = 'INR' }) {
  if (!data || data.length === 0) {
    return (
      <div className="card p-8" role="img" aria-label="Category donut chart - no data">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500 dark:text-gray-400">No expense data for this period</p>
        </div>
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.total, 0);

  return (
    <div className="card" role="img" aria-label={`Category spending breakdown. Total: ${formatMoney(total, currency)}`}>
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Spending by Category</h3>
        <div className="relative h-[300px] w-full">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="total"
              nameKey="name"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
              labelLine={false}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [formatMoney(value, currency), '']}
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
              labelStyle={{ color: '#1f2937' }}
              itemStyle={{ color: '#374151' }}
            />
            <Legend
              layout="vertical"
              align="right"
              verticalAlign="middle"
              iconType="circle"
              iconSize={10}
              formatter={(value) => {
                const item = data.find(d => d.name === value);
                if (item) {
                  return `${value} (${formatMoney(item.total, currency)}, ${((item.total / total) * 100).toFixed(1)}%)`;
                }
                return value;
              }}
            />
          </PieChart>
        </div>
        <div className="mt-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatMoney(total, currency)}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total expenses</p>
        </div>
      </div>
    </div>
  );
}