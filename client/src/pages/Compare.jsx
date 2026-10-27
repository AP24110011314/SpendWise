import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useCompare, useTrend } from '@/hooks';
import { formatMonth, getCurrentMonth, addMonths } from '@/lib/dates';
import Card from '@/components/ui/Card';
import MonthPicker from '@/components/ui/MonthPicker';
import EmptyState from '@/components/ui/EmptyState';
import { GitCompare, TrendingUp, TrendingDown, Minus, PieChart, Layers } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

function formatAmountDisplay(amount, currency = 'INR') {
  if (amount == null || isNaN(amount)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount / 100);
}

function getTrendIcon(delta) {
  if (delta > 0) return <TrendingUp className="w-4 h-4 text-red-500" />;
  if (delta < 0) return <TrendingDown className="w-4 h-4 text-emerald-500" />;
  return <Minus className="w-4 h-4 text-gray-400" />;
}

function ComparisonCard({ title, amountA, amountB, monthAName, monthBName, delta, pct, currency, icon, isPercent = false }) {
  const isPositive = (delta || 0) > 0;
  const isNegative = (delta || 0) < 0;
  // For expenses, positive delta means more spent (red/worse), negative delta means saved (green/better)
  // For income and net, positive delta means more income/savings (green/better)
  const isExpense = title.toLowerCase().includes('expense');
  const trendColor = isExpense
    ? (isPositive ? 'text-red-600 dark:text-red-400' : isNegative ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500')
    : (isPositive ? 'text-emerald-600 dark:text-emerald-400' : isNegative ? 'text-red-600 dark:text-red-400' : 'text-gray-500');

  const formatVal = (val) => isPercent ? `${Number(val || 0).toFixed(1)}%` : formatAmountDisplay(val, currency);

  return (
    <Card className="p-3.5 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider truncate">{title}</h3>
        {icon}
      </div>
      <div className="grid grid-cols-3 gap-1 sm:gap-2 items-center text-center">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 truncate mb-1">{monthAName}</p>
          <p className="text-xs sm:text-base lg:text-lg font-bold text-gray-900 dark:text-white truncate" title={formatVal(amountA)}>{formatVal(amountA)}</p>
        </div>
        <div className="flex flex-col items-center justify-center px-1 border-x border-gray-100 dark:border-gray-800 min-w-0">
          <div className={trendColor}>
            {getTrendIcon(delta)}
          </div>
          <p className={`text-[10px] sm:text-xs font-semibold mt-0.5 sm:mt-1 ${trendColor} truncate max-w-full`} title={`${isPositive ? '+' : ''}${formatVal(delta)}`}>
            {isPositive ? '+' : ''}{formatVal(delta)}
          </p>
          {!isPercent && (
            pct === null || pct === undefined ? (
              <span className="text-[10px] sm:text-[11px] text-gray-400 font-medium">New</span>
            ) : (
              <span className={`text-[10px] sm:text-[11px] font-medium ${trendColor}`}>
                {pct > 0 ? '+' : ''}{Number(pct).toFixed(1)}%
              </span>
            )
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 truncate mb-1">{monthBName}</p>
          <p className="text-xs sm:text-base lg:text-lg font-bold text-gray-900 dark:text-white truncate" title={formatVal(amountB)}>{formatVal(amountB)}</p>
        </div>
      </div>
    </Card>
  );
}

function CategoryComparisonChart({ categories = [], monthAName, monthBName, currency }) {
  if (!categories || categories.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center">
        <EmptyState title="No category data" description="No categories to compare between these months" />
      </div>
    );
  }

  // Display top 8 categories by absolute delta for best readability
  const chartData = categories.slice(0, 8).map((cat) => ({
    name: cat.name,
    [monthAName]: Math.round((cat.monthA || 0) / 100),
    [monthBName]: Math.round((cat.monthB || 0) / 100),
  }));

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
          <XAxis
            dataKey="name"
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            angle={-25}
            textAnchor="end"
            interval={0}
            height={50}
          />
          <YAxis
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            tickFormatter={(value) => `${currency === 'INR' ? '₹' : '$'}${value >= 1000 ? `${Math.round(value / 1000)}k` : value}`}
          />
          <Tooltip
            formatter={(value, name) => [
              formatAmountDisplay(Number(value) * 100, currency),
              name,
            ]}
            contentStyle={{
              backgroundColor: '#1f2937',
              borderColor: '#374151',
              borderRadius: '0.5rem',
              color: '#f9fafb',
            }}
          />
          <Legend wrapperStyle={{ paddingTop: '10px' }} />
          <Bar dataKey={monthAName} fill="#6366f1" radius={[4, 4, 0, 0]} />
          <Bar dataKey={monthBName} fill="#f59e0b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Compare() {
  const { user } = useAuth();
  const currency = user?.currency || 'INR';

  const [searchParams, setSearchParams] = useSearchParams();
  const defaultCurrent = getCurrentMonth();
  const defaultPrevious = addMonths(defaultCurrent, -1);

  const [monthA, setMonthA] = useState(() => searchParams.get('a') || searchParams.get('monthA') || defaultPrevious);
  const [monthB, setMonthB] = useState(() => searchParams.get('b') || searchParams.get('monthB') || defaultCurrent);

  // Sync to URL search parameters
  useEffect(() => {
    if (monthA && monthB) {
      setSearchParams({ a: monthA, b: monthB }, { replace: true });
    }
  }, [monthA, monthB, setSearchParams]);

  const { data: compareData, isLoading, error, refetch } = useCompare(monthA, monthB);
  const { data: trendData } = useTrend(12);

  const availableMonths = useMemo(() => {
    if (!trendData || !Array.isArray(trendData)) return [];
    return trendData.map(t => t.month).sort().reverse();
  }, [trendData]);

  // Support both raw object or { data: object } from Axios interceptor
  const comparison = compareData?.data || compareData;
  const hasComparison = Boolean(
    comparison &&
    Array.isArray(comparison.categories) &&
    monthA &&
    monthB &&
    monthA !== monthB
  );

  const monthAName = formatMonth(monthA);
  const monthBName = formatMonth(monthB);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <GitCompare className="w-7 h-7 text-indigo-600 dark:text-amber-400" />
            Compare Months
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Compare your income, expenses, and category breakdown between any two months
          </p>
        </div>
      </div>

      {/* Month Selection Pickers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-5 border-l-4 border-indigo-500">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
              Base Month (Month A)
            </span>
          </div>
          <MonthPicker
            value={monthA}
            onChange={setMonthA}
            min={availableMonths[availableMonths.length - 1]}
            max={availableMonths[0]}
          />
        </Card>
        <Card className="p-5 border-l-4 border-amber-500">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Comparison Month (Month B)
            </span>
          </div>
          <MonthPicker
            value={monthB}
            onChange={setMonthB}
            min={availableMonths[availableMonths.length - 1]}
            max={availableMonths[0]}
          />
        </Card>
      </div>

      {/* Same Month Warning */}
      {monthA && monthB && monthA === monthB && (
        <Card className="p-4 bg-amber-50/50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <p className="text-amber-800 dark:text-amber-300 text-sm font-medium">
            Please choose two different months to see the month-over-month comparison deltas.
          </p>
        </Card>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-6 animate-pulse" role="status">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} className="p-6">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-3" />
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
              </Card>
            ))}
          </div>
          <Card className="p-6">
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
          </Card>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <Card className="p-6">
          <EmptyState
            title="Failed to load comparison data"
            description={error.message || 'Please check your connection or choose different months'}
            onRetry={() => refetch()}
          />
        </Card>
      )}

      {/* Comparison Results */}
      {!isLoading && !error && hasComparison && (
        <>
          {/* Summary Delta Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ComparisonCard
              title="Income"
              amountA={comparison.incomeA}
              amountB={comparison.incomeB}
              monthAName={monthAName}
              monthBName={monthBName}
              delta={comparison.incomeB - comparison.incomeA}
              pct={comparison.incomeA ? ((comparison.incomeB - comparison.incomeA) / comparison.incomeA) * 100 : null}
              currency={currency}
              icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
            />
            <ComparisonCard
              title="Expenses"
              amountA={comparison.expenseA}
              amountB={comparison.expenseB}
              monthAName={monthAName}
              monthBName={monthBName}
              delta={comparison.expenseB - comparison.expenseA}
              pct={comparison.expenseA ? ((comparison.expenseB - comparison.expenseA) / comparison.expenseA) * 100 : null}
              currency={currency}
              icon={<TrendingDown className="w-5 h-5 text-red-500" />}
            />
            <ComparisonCard
              title="Net Savings"
              amountA={comparison.netA}
              amountB={comparison.netB}
              monthAName={monthAName}
              monthBName={monthBName}
              delta={comparison.netB - comparison.netA}
              pct={comparison.netA ? ((comparison.netB - comparison.netA) / Math.abs(comparison.netA)) * 100 : null}
              currency={currency}
              icon={<GitCompare className="w-5 h-5 text-indigo-500" />}
            />
            <ComparisonCard
              title="Savings Rate"
              amountA={comparison.incomeA ? (comparison.netA / comparison.incomeA) * 100 : 0}
              amountB={comparison.incomeB ? (comparison.netB / comparison.incomeB) * 100 : 0}
              monthAName={monthAName}
              monthBName={monthBName}
              delta={
                (comparison.incomeB ? (comparison.netB / comparison.incomeB) * 100 : 0) -
                (comparison.incomeA ? (comparison.netA / comparison.incomeA) * 100 : 0)
              }
              pct={0}
              isPercent={true}
              currency=""
              icon={<PieChart className="w-5 h-5 text-amber-500" />}
            />
          </div>

          {/* Grouped Bar Chart */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Top Categories Comparison
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {monthAName} vs {monthBName} (Top categories sorted by absolute spend change)
                </p>
              </div>
            </div>
            <CategoryComparisonChart
              categories={comparison.categories}
              monthAName={monthAName}
              monthBName={monthBName}
              currency={currency}
            />
          </Card>

          {/* Detailed Category Table */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600 dark:text-amber-400" />
                Category Breakdown Table
              </h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {comparison.categories.length} categories found
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/60 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-right">{monthAName}</th>
                    <th className="px-4 py-3 text-right">{monthBName}</th>
                    <th className="px-4 py-3 text-right">Change (Delta)</th>
                    <th className="px-4 py-3 text-right">% Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700/60">
                  {comparison.categories.map((cat) => {
                    const isIncrease = cat.delta > 0;
                    const isDecrease = cat.delta < 0;
                    // For expenses: increase is red, decrease is green
                    const deltaColor = isIncrease
                      ? 'text-red-600 dark:text-red-400'
                      : isDecrease
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-gray-500';

                    return (
                      <tr
                        key={cat.categoryId || cat.name}
                        className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: cat.color || '#F2A900' }}
                          />
                          <span>{cat.name}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300 font-mono">
                          {formatAmountDisplay(cat.monthA, currency)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300 font-mono">
                          {formatAmountDisplay(cat.monthB, currency)}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono font-medium ${deltaColor}`}>
                          {cat.delta > 0 ? '+' : ''}{formatAmountDisplay(cat.delta, currency)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">
                          {cat.pct === null ? (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-indigo-50 text-indigo-600 dark:bg-amber-400/10 dark:text-amber-400">
                              New
                            </span>
                          ) : (
                            <span className={deltaColor}>
                              {cat.pct > 0 ? '+' : ''}{Number(cat.pct).toFixed(1)}%
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Empty State when no data is available */}
      {!isLoading && !error && !hasComparison && monthA && monthB && monthA !== monthB && (
        <Card className="p-8">
          <EmptyState
            title="No comparison data found"
            description={`No transactions recorded for either ${monthAName} or ${monthBName}.`}
          />
        </Card>
      )}
    </div>
  );
}