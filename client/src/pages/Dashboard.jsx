import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { formatMonth, getCurrentMonth, addMonths } from '@/lib/dates';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import MonthPicker from '@/components/ui/MonthPicker';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import Spinner from '@/components/ui/Spinner';
import { Plus } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
} from 'recharts';
import {
  useSummary,
  useByCategory,
  useTrend,
  useDaily,
  useForecast,
} from '@/hooks';

const COLORS = [
  '#F2A900', '#CC6F00', '#F9E6A8', '#10b981', '#3b82f6',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f59e0b', '#14b8a6',
  '#6366f1', '#f43f5e', '#84cc16', '#a855f7', '#64748b',
];

function formatAmount(amount, currency = 'INR') {
  if (!amount && amount !== 0) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount / 100);
}

function formatAmountWithSign(amount, currency = 'INR') {
  if (!amount && amount !== 0) return '—';
  const sign = amount >= 0 ? '+' : '';
  return `${sign}${formatAmount(amount, currency)}`;
}

function DashboardCard({ title, value, subtitle, trend, className = '' }) {
  return (
    <Card className={`p-3 sm:p-5 flex flex-col justify-between border border-gray-100 dark:border-gray-700/60 ${className}`}>
      <div>
        <p className="text-[11px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider truncate">{title}</p>
        <p
          className="text-base sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white mt-1 tracking-tight truncate"
          title={typeof value === 'string' ? value : undefined}
        >
          {value}
        </p>
      </div>
      {(subtitle || trend !== undefined) && (
        <div className="flex items-center gap-1.5 mt-2 text-xs flex-wrap">
          {subtitle && <span className="text-gray-500 dark:text-gray-400 text-[10px] sm:text-xs truncate">{subtitle}</span>}
          {trend !== undefined && (
            <span className={`font-semibold text-[10px] sm:text-xs ${trend >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

function CategoryBreakdownChart({ data, currency = 'INR' }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center">
        <EmptyState title="No expense data" description="Add transactions to see category breakdown" />
      </div>
    );
  }

  const chartData = data.map((item, index) => ({
    name: item.name,
    value: item.total / 100,
    color: item.color || COLORS[index % COLORS.length],
    pct: item.pct,
    total: item.total,
  }));

  const totalExpense = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-6">
      {/* Donut chart */}
      <div className="h-64 relative flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={95}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
              label={false}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [formatAmount(value * 100, currency), 'Amount']}
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                fontSize: '12px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total</span>
          <span className="text-base font-bold text-gray-900 dark:text-white">
            {formatAmount(totalExpense * 100, currency)}
          </span>
        </div>
      </div>

      {/* Categories Legend List with details and progress */}
      <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
        {chartData.map((item) => (
          <div key={item.name} className="flex flex-col gap-1 text-sm group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="font-medium text-gray-800 dark:text-gray-200 truncate" title={item.name}>
                  {item.name}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-gray-900 dark:text-white font-semibold">
                  {formatAmount(item.total, currency)}
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-medium">
                  {item.pct ? `${item.pct.toFixed(1)}%` : `${((item.value / (totalExpense || 1)) * 100).toFixed(1)}%`}
                </span>
              </div>
            </div>
            {/* Proportion Bar */}
            <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, item.pct || ((item.value / (totalExpense || 1)) * 100))}%`,
                  backgroundColor: item.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function IncomeExpenseChart({ data, currency = 'INR' }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center">
        <EmptyState title="No trend data" description="Data will appear as you add transactions" />
      </div>
    );
  }

  const chartData = data.map((item) => ({
    month: formatMonth(item.month),
    income: item.income / 100,
    expense: item.expense / 100,
    net: item.net / 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={256}>
      <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: '#6b7280', fontSize: 12 }}
          axisLine={{ stroke: '#e5e7eb' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#6b7280', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value) => formatAmount(value * 100, currency).replace(currency === 'INR' ? '₹' : '$', '')}
        />
        <Tooltip
          formatter={(value, name) => [formatAmount(value * 100, currency), name === 'income' ? 'Income' : name === 'expense' ? 'Expenses' : 'Net']}
          labelFormatter={(month) => month}
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
          }}
        />
        <Legend
          layout="horizontal"
          align="center"
          verticalAlign="top"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ paddingTop: 20 }}
        />
        <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarWidth={30} />
        <Bar dataKey="expense" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarWidth={30} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function BudgetProgressChart({ budgets, currency = 'INR' }) {
  if (!budgets || budgets.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center">
        <EmptyState title="No budgets set" description="Create budgets to track your spending limits" />
      </div>
    );
  }

  const chartData = budgets.map((budget, index) => ({
    name: budget.categoryName || 'Overall',
    spent: budget.spent / 100,
    limit: budget.limit / 100,
    percentage: budget.percentage,
    status: budget.status,
    color: budget.color || COLORS[index % COLORS.length],
  }));

  return (
    <div className="h-64 overflow-y-auto pr-2">
      {chartData.map((budget, index) => (
        <div key={index} className="mb-4 last:mb-0" role="progressbar" aria-valuenow={budget.percentage} aria-valuemin={0} aria-valuemax={100} aria-label={`${budget.name} budget ${budget.percentage}% used`}>
          <div className="flex justify-between items-center text-xs sm:text-sm mb-1.5 gap-2">
            <span className="font-medium text-gray-900 dark:text-white truncate">{budget.name}</span>
            <span className="text-gray-500 dark:text-gray-400 text-xs shrink-0 font-medium">
              {formatAmount(budget.spent * 100, currency)} / {formatAmount(budget.limit * 100, currency)}
            </span>
          </div>
          <div
            className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
            style={{ backgroundColor: '#e5e7eb' }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(budget.percentage, 100)}%`,
                backgroundColor:
                  budget.status === 'exceeded' ? '#ef4444' :
                  budget.status === 'warning' ? '#f97316' :
                  '#22c55e',
              }}
            />
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-gray-500 dark:text-gray-400">{budget.percentage}% used</span>
            <span className={
              budget.status === 'exceeded' ? 'text-red-600 dark:text-red-400' :
              budget.status === 'warning' ? 'text-orange-600 dark:text-orange-400' :
              'text-green-600 dark:text-green-400'
            }>
              {budget.status === 'exceeded' ? 'Over budget' :
               budget.status === 'warning' ? 'Near limit' : 'On track'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function DailyCumulativeChart({ data, currency = 'INR' }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center">
        <EmptyState title="No daily data" description="Add transactions to see daily spending" />
      </div>
    );
  }

  const chartData = data.map((item) => ({
    date: item.date,
    expense: item.expense / 100,
    cumulativeExpense: item.cumulativeExpense / 100,
    income: item.income / 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={256}>
      <AreaChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: '#6b7280', fontSize: 11 }}
          axisLine={{ stroke: '#e5e7eb' }}
          tickLine={false}
          interval="preserveStartEnd"
          tickFormatter={(value) => value.split('-')[2]}
        />
        <YAxis
          tick={{ fill: '#6b7280', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value) => formatAmount(value * 100, currency).replace(currency === 'INR' ? '₹' : '$', '')}
        />
        <Tooltip
          formatter={(value, name) => [
            formatAmount(value * 100, currency),
            name === 'expense' ? 'Daily Expense' : 'Cumulative Expense'
          ]}
          labelFormatter={(date) => {
            const day = date.split('-')[2];
            return `Day ${parseInt(day, 10)}`;
          }}
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
          }}
        />
        <Legend layout="horizontal" align="center" verticalAlign="top" iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 20 }} />
        <Area
          type="monotone"
          dataKey="expense"
          name="Daily Expense"
          stroke="#ef4444"
          fillOpacity={1}
          fill="url(#colorExpense)"
          strokeWidth={1}
        />
        <Area
          type="monotone"
          dataKey="cumulativeExpense"
          name="Cumulative Expense"
          stroke="#3b82f6"
          fillOpacity={1}
          fill="url(#colorCumulative)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function ForecastChart({ forecast, currency = 'INR' }) {
  if (!forecast) {
    return (
      <div className="h-64 flex items-center justify-center">
        <EmptyState title="No forecast data" description="Forecast will appear after some spending history" />
      </div>
    );
  }

  const { spentSoFar, projectedTotal, upcomingRecurringTotal, daysElapsed, daysInMonth, confidence } = forecast;
  const remaining = Math.max(0, projectedTotal - spentSoFar);

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {/* 3 Metric Cards - responsive horizontal flex on mobile, 3-column grid on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
        <div className="p-3.5 sm:p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl flex items-center justify-between sm:flex-col sm:justify-center sm:text-center border border-gray-100 dark:border-gray-700/60 transition-all">
          <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Spent So Far</p>
          <p
            className="text-base sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white mt-0 sm:mt-1 tracking-tight truncate max-w-[60%] sm:max-w-full"
            title={formatAmount(spentSoFar, currency)}
          >
            {formatAmount(spentSoFar, currency)}
          </p>
        </div>

        <div className="p-3.5 sm:p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl flex items-center justify-between sm:flex-col sm:justify-center sm:text-center border border-gray-100 dark:border-gray-700/60 transition-all">
          <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Upcoming Recurring</p>
          <p
            className="text-base sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white mt-0 sm:mt-1 tracking-tight truncate max-w-[60%] sm:max-w-full"
            title={formatAmount(upcomingRecurringTotal, currency)}
          >
            {formatAmount(upcomingRecurringTotal, currency)}
          </p>
        </div>

        <div className="p-3.5 sm:p-4 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-xl flex items-center justify-between sm:flex-col sm:justify-center sm:text-center transition-all">
          <p className="text-xs sm:text-sm font-medium text-indigo-700 dark:text-indigo-300">Projected Total</p>
          <p
            className="text-base sm:text-xl lg:text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-0 sm:mt-1 tracking-tight truncate max-w-[60%] sm:max-w-full"
            title={formatAmount(projectedTotal, currency)}
          >
            {formatAmount(projectedTotal, currency)}
          </p>
        </div>
      </div>

      {/* Month Progress Card */}
      <div className="p-3.5 sm:p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/60">
        <div className="flex items-center justify-between mb-2 gap-2">
          <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">Month Progress</span>
          <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 shrink-0">Day {daysElapsed} of {daysInMonth}</span>
        </div>
        <div className="h-2.5 sm:h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-600 rounded-full transition-all duration-500"
            style={{ width: `${Math.min((daysElapsed / daysInMonth) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Confidence Card */}
      <div className="p-3.5 sm:p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/60">
        <div className="flex items-center justify-between mb-1.5 gap-2">
          <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">Confidence</span>
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
            confidence === 'high' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
            confidence === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
            'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
          }`}>
            {confidence.charAt(0).toUpperCase() + confidence.slice(1)}
          </span>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {confidence === 'high' && 'Strong historical data and mid-month'}
          {confidence === 'medium' && 'Some history, early in month'}
          {confidence === 'low' && 'Limited data for reliable projection'}
        </div>
      </div>

      {/* Overall Budget Card */}
      {forecast.budget && (
        <div className="p-3.5 sm:p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/60" role="alert">
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">Overall Budget</span>
            <span className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 truncate">
              {formatAmount(forecast.budget.limit, currency)}
            </span>
          </div>
          <div className="h-2.5 sm:h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min((projectedTotal / forecast.budget.limit) * 100, 100)}%`,
                backgroundColor:
                  forecast.budget.willExceed ? '#ef4444' : '#22c55e',
              }}
            />
          </div>
          <div className="flex justify-between items-center text-xs mt-1.5 gap-2 flex-wrap">
            <span className="text-gray-500 dark:text-gray-400 truncate">
              Projected: {formatAmount(projectedTotal, currency)}
            </span>
            <span className={`text-[11px] sm:text-xs font-semibold ${
              forecast.budget.willExceed ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
            }`}>
              {forecast.budget.willExceed ? '⚠ Projected to exceed budget' : '✓ Within budget'}
            </span>
          </div>
        </div>
      )}

      {/* By Category */}
      {forecast.categories && forecast.categories.length > 0 && (
        <div>
          <h4 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white mb-2.5">By Category</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {forecast.categories.map((cat, index) => (
              <div key={cat.categoryId} className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700/50">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat.color || COLORS[index % COLORS.length] }}
                    />
                    <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate">{cat.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-semibold text-gray-900 dark:text-white">
                      {formatAmount(cat.projected, currency)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 gap-2">
                  <span>Spent: {formatAmount(cat.spent, currency)}</span>
                  <span>Proj: {formatAmount(cat.projected, currency)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currency = user?.currency || 'INR';
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const prevMonth = addMonths(selectedMonth, -1);

  const { data: summary, isLoading: summaryLoading, error: summaryError, refetch: refetchSummary } = useSummary(selectedMonth);
  const { data: byCategory, isLoading: byCategoryLoading, error: byCategoryError } = useByCategory(selectedMonth);
  const { data: trend, isLoading: trendLoading, error: trendError } = useTrend(6, selectedMonth);
  const { data: daily, isLoading: dailyLoading, error: dailyError } = useDaily(selectedMonth);
  const { data: forecast, isLoading: forecastLoading, error: forecastError } = useForecast();

  const isLoading = summaryLoading || byCategoryLoading || trendLoading || dailyLoading || forecastLoading;
  const hasError = summaryError || byCategoryError || trendError || dailyError || forecastError;

  const summaryData = useMemo(() => {
    if (!summary) return null;
    return {
      income: summary.income,
      expense: summary.expense,
      net: summary.net,
      savingsRate: summary.savingsRate,
    };
  }, [summary]);

  const forecastData = useMemo(() => {
    if (!forecast) return null;
    return forecast;
  }, [forecast]);

  if (isLoading) {
    return (
      <div className="space-y-6" role="status" aria-live="polite">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
            <p className="text-gray-500 dark:text-gray-400">Welcome back, {user?.name}</p>
          </div>
          <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4" aria-busy="true">
          {['Income', 'Expenses', 'Net Savings', 'Savings Rate', 'Projected'].map((label) => (
            <Card key={label} className="p-6 animate-pulse">
              <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mt-1" />
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" aria-busy="true">
          {[1, 2].map((i) => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
              <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" aria-busy="true">
          {[1, 2].map((i) => (
            <Card key={i + 2} className="p-6 animate-pulse">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
              <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="space-y-6" role="alert">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
            <p className="text-gray-500 dark:text-gray-400">Welcome back, {user?.name}</p>
          </div>
          <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
        </div>
        <ErrorState
          title="Failed to load dashboard"
          message={hasError.message || 'Please try again later'}
          onRetry={() => {
            refetchSummary();
            window.location.reload();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400">Welcome back, {user?.name}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
          <Button onClick={() => navigate('/transactions?add=true', { state: { openAdd: true } })}>
            <Plus className="w-4 h-4" />
            <span>Add Transaction</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <DashboardCard
          title="Income"
          value={formatAmount(summaryData?.income, currency)}
          subtitle={summaryData ? `+${formatAmount(summaryData.income - (prevMonth ? 0 : 0), currency)} vs last month` : undefined}
        />
        <DashboardCard
          title="Expenses"
          value={formatAmount(summaryData?.expense, currency)}
          subtitle={summaryData ? `${formatAmount(summaryData.expense, currency)} this month` : undefined}
        />
        <DashboardCard
          title="Net Savings"
          value={formatAmountWithSign(summaryData?.net, currency)}
          subtitle={summaryData?.net >= 0 ? 'Positive flow' : 'Exceeds income'}
          trend={summaryData ? (summaryData.net / Math.max(Math.abs(summaryData.income), 1)) * 100 : undefined}
        />
        <DashboardCard
          title="Savings Rate"
          value={summaryData ? `${summaryData.savingsRate}%` : '—'}
          subtitle="Of income saved"
        />
        <DashboardCard
          title="Projected Expenses"
          value={formatAmount(forecastData?.projectedTotal, currency)}
          subtitle={forecastData ? `Confidence: ${forecastData.confidence}` : undefined}
          className="col-span-2 sm:col-span-1"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Category Breakdown</h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">{formatMonth(selectedMonth)}</span>
          </div>
          <CategoryBreakdownChart data={byCategory} currency={currency} />
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Income vs Expenses</h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">Last 6 months</span>
          </div>
          <IncomeExpenseChart data={trend} currency={currency} />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Budget Progress</h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">{formatMonth(selectedMonth)}</span>
          </div>
          <BudgetProgressChart budgets={forecastData?.categories || []} currency={currency} />
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Daily Cumulative Spend</h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">{formatMonth(selectedMonth)}</span>
          </div>
          <DailyCumulativeChart data={daily} currency={currency} />
        </Card>
      </div>

      <Card className="p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3.5 sm:mb-4">Spending Forecast</h3>
        <ForecastChart forecast={forecastData} currency={currency} />
      </Card>
    </div>
  );
}