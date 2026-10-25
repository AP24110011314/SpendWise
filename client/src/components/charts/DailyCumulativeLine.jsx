import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line } from 'recharts';
import { formatMoney } from '@/lib/money';

export default function DailyCumulativeLine({ data, projectedTotal, currency = 'INR' }) {
  if (!data || data.length === 0) {
    return (
      <div className="card p-8" role="img" aria-label="Daily cumulative spend chart - no data">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500 dark:text-gray-400">No data for daily cumulative chart</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card" role="img" aria-label="Daily cumulative spending through the month">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Daily Cumulative Spend</h3>
        <div className="relative h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tickFormatter={(value) => value} stroke="#9ca3af" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tickFormatter={(value) => formatMoney(value, currency)} stroke="#9ca3af" />
              <Tooltip
                formatter={(value, name) => [
                  formatMoney(value, currency),
                  name === 'cumulativeExpense' ? 'Cumulative' : name === 'expense' ? 'Daily' : 'Income'
                ]}
                labelFormatter={(date) => new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Area
                type="monotone"
                dataKey="cumulativeExpense"
                stroke="#ef4444"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorExpense)"
              />
              {projectedTotal && projectedTotal > 0 && (
                <Line
                  type="monotone"
                  dataKey="cumulativeExpense"
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  connectNulls
                >
                  {data.map((d, i) => i === data.length - 1 && <Line key="projected" points={[{x: d.date, y: d.cumulativeExpense}, {x: data[data.length - 1].date, y: projectedTotal}]} />)}
                </Line>
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}