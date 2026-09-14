import { useState, useMemo } from 'react';
import {
  TrendingUp,
  Download,
  Printer,
  DollarSign,
  Package,
  Calendar,
  Layers,
  ArrowUpRight,
  FileSpreadsheet,
  FileCode,
  PieChart as PieIcon,
  BarChart3,
  Percent,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';
import { QuarterlyTrendReport } from '../types';
import { formatCurrency } from '../utils/stockUtils';
import { exportQuarterlyCSV, exportQuarterlyJSON } from '../utils/exportUtils';

interface SalesTrendsViewProps {
  quarterlyReports: QuarterlyTrendReport[];
}

export function SalesTrendsView({ quarterlyReports }: SalesTrendsViewProps) {
  const [selectedReportId, setSelectedReportId] = useState(quarterlyReports[0]?.id || '');
  const [activeSubTab, setActiveSubTab] = useState<'trends' | 'categories' | 'monthly'>('trends');

  const currentReport = useMemo(() => {
    return quarterlyReports.find((r) => r.id === selectedReportId) || quarterlyReports[0];
  }, [quarterlyReports, selectedReportId]);

  // Comparative data for all quarters chart
  const allQuartersData = useMemo(() => {
    return [...quarterlyReports]
      .reverse()
      .map((r) => ({
        quarter: r.quarter.replace(' (Current)', ''),
        Revenue: r.totalRevenue,
        COGS: r.cogs,
        GrossProfit: r.grossProfit,
        Units: r.unitsSold,
      }));
  }, [quarterlyReports]);

  // Monthly data formatted for chart
  const monthlyData = useMemo(() => {
    if (!currentReport) return [];
    return currentReport.monthlyBreakdown.map((m) => ({
      month: m.month,
      Revenue: m.revenue,
      Cost: m.cost,
      Profit: m.profit,
      Units: m.units,
    }));
  }, [currentReport]);

  const handlePrint = () => {
    window.print();
  };

  if (!currentReport) return null;

  return (
    <div className="space-y-6">
      {/* Top Banner & Export Actions */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700/80 dark:border-slate-700 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Quarterly Sales Trends & Analytics</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Audit Ready
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Quarterly revenue margins, inventory turnover velocity, and exportable financial audit reports.
          </p>
        </div>

        {/* Quarter Selector & Export Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quarter dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 dark:bg-slate-950 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
            <select
              id="select-quarter"
              value={selectedReportId}
              onChange={(e) => setSelectedReportId(e.target.value)}
              aria-label="Select quarter"
              className="bg-transparent font-semibold text-slate-800 dark:text-slate-200 focus:outline-hidden cursor-pointer"
            >
              {quarterlyReports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.quarter}
                </option>
              ))}
            </select>
          </div>

          {/* Export CSV Button */}
          <button
            id="btn-export-quarterly-csv"
            onClick={() => exportQuarterlyCSV(currentReport)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-2xs transition-colors cursor-pointer"
            title="Download formatted CSV spreadsheet of this quarter"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          {/* Print/PDF Button */}
          <button
            id="btn-print-report"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-medium text-xs border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            title="Print or Save as PDF"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* KPI Cards for Selected Quarter */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* KPI 1: Gross Revenue */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700/80 dark:border-slate-700 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Gross Revenue</span>
          <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{formatCurrency(currentReport.totalRevenue)}</p>
          <p className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-0.5">
            <ArrowUpRight className="w-3 h-3" />
            <span>+{currentReport.growthComparedToPreviousQ}% QoQ</span>
          </p>
        </div>

        {/* KPI 2: COGS */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700/80 dark:border-slate-700 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Cost of Goods (COGS)</span>
          <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{formatCurrency(currentReport.cogs)}</p>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">Direct inventory cost</p>
        </div>

        {/* KPI 3: Gross Profit */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700/80 dark:border-slate-700 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Gross Profit</span>
          <p className="text-xl font-bold text-emerald-700 mt-1">{formatCurrency(currentReport.grossProfit)}</p>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">Margin: {currentReport.profitMarginPercent}%</p>
        </div>

        {/* KPI 4: Units Sold */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700/80 dark:border-slate-700 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Units Dispatched</span>
          <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{currentReport.unitsSold.toLocaleString()}</p>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">Across all channels</p>
        </div>

        {/* KPI 5: Inventory Turnover */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700/80 dark:border-slate-700 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Turnover Rate</span>
          <p className="text-xl font-bold text-blue-700 mt-1">{currentReport.inventoryTurnoverRate}x</p>
          <p className="text-[11px] text-emerald-700 font-medium mt-1">Healthy cycle</p>
        </div>

        {/* KPI 6: Carrying Cost */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700/80 dark:border-slate-700 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Est. Carrying Cost</span>
          <p className="text-xl font-bold text-slate-800 dark:text-slate-200 mt-1">{formatCurrency(currentReport.carryingCostEstimate)}</p>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">Storage & handling</p>
        </div>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Multi-Quarter Sales Trend & Monthly Velocity */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700/80 dark:border-slate-700 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Financial Trend Comparison: Revenue vs COGS vs Gross Profit
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">Multi-quarter historical trend progression</p>
            </div>
          </div>

          {/* Recharts Bar Chart */}
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={allQuartersData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) => `$${val / 1000}k`}
                />
                <Tooltip
                  formatter={(value: any) => [formatCurrency(Number(value)), '']}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="Revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="COGS" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="GrossProfit" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Selected Quarter Monthly Velocity */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Monthly Breakdown ({currentReport.quarter})
              </h4>
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Period: {currentReport.periodLabel}</span>
            </div>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorMonthlyRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => `$${val / 1000}k`}
                  />
                  <Tooltip
                    formatter={(val: any) => [formatCurrency(Number(val)), '']}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Revenue"
                    stroke="#2563eb"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorMonthlyRev)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Category Sales Share & Top Performing SKUs */}
        <div className="space-y-6">
          {/* Category Contribution Card */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700/80 dark:border-slate-700 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Category Performance</h3>
              <Layers className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </div>

            <div className="space-y-3 pt-1">
              {currentReport.categoryBreakdown.map((cat, idx) => {
                const percent = Math.round((cat.revenue / currentReport.totalRevenue) * 100);
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{cat.category}</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300 font-medium">
                        {formatCurrency(cat.revenue)} ({percent}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800/50 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                      <span>{cat.units.toLocaleString()} units sold</span>
                      <span>Profit: {formatCurrency(cat.profit)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Performing Items Card */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700/80 dark:border-slate-700 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Top Revenue Items</h3>
              <Package className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {currentReport.topPerformingItems.map((item, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between">
                  <div className="pr-2">
                    <p className="font-semibold text-slate-900 dark:text-white truncate max-w-[180px]">{item.name}</p>
                    <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">{item.sku}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(item.revenue)}</p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">{item.units.toLocaleString()} units</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
