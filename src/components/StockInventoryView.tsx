import { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Download,
  AlertTriangle,
  CheckCircle2,
  SlidersHorizontal,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  Package,
  Layers,
  DollarSign,
  ShoppingCart,
  Minus,
  ExternalLink,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import { InventoryItem } from '../types';
import { formatCurrency } from '../utils/stockUtils';
import { exportInventoryCSV } from '../utils/exportUtils';

interface StockInventoryViewProps {
  items: InventoryItem[];
  onUpdateQuantity: (id: string, newQty: number, note?: string) => void;
  onOpenAddItem: () => void;
  onQuickReorder: (item: InventoryItem) => void;
  onSelectAlertTab: () => void;
}

export function StockInventoryView({
  items,
  onUpdateQuantity,
  onOpenAddItem,
  onQuickReorder,
  onSelectAlertTab,
}: StockInventoryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'critical' | 'low' | 'healthy' | 'essential'>('all');

  // Compute categories
  const categories = useMemo(() => {
    const set = new Set(items.map((i) => i.category));
    return ['all', ...Array.from(set)];
  }, [items]);

  // Compute Metrics
  const metrics = useMemo(() => {
    const totalSKUs = items.length;
    const totalUnits = items.reduce((acc, curr) => acc + curr.quantity, 0);
    const totalValuation = items.reduce((acc, curr) => acc + curr.quantity * curr.unitCost, 0);
    const lowStockCount = items.filter((i) => i.status === 'low' || i.status === 'critical').length;
    const criticalCount = items.filter((i) => i.status === 'critical').length;

    return { totalSKUs, totalUnits, totalValuation, lowStockCount, criticalCount };
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.warehouse.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.supplier.name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCat = selectedCategory === 'all' || item.category === selectedCategory;

      let matchesStatus = true;
      if (statusFilter === 'critical') matchesStatus = item.status === 'critical';
      else if (statusFilter === 'low') matchesStatus = item.status === 'low';
      else if (statusFilter === 'healthy') matchesStatus = item.status === 'healthy';
      else if (statusFilter === 'essential') matchesStatus = item.isEssential;

      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [items, searchQuery, selectedCategory, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total SKUs */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700/80 dark:border-slate-700 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Total Products / SKUs</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{metrics.totalSKUs}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-blue-700" />
              <span>{categories.length - 1} Active Categories</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Package className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 2: Inventory In Stock */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700/80 dark:border-slate-700 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Total On-Hand Units</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{metrics.totalUnits.toLocaleString()}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
              <span>Across 3 Warehouses</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 3: Total Asset Valuation */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700/80 dark:border-slate-700 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Stock Asset Valuation</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{formatCurrency(metrics.totalValuation)}</p>
            <p className="text-xs text-emerald-700 font-medium mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>At Unit Purchase Cost</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 4: Low Stock Alert Trigger */}
        <div
          onClick={metrics.lowStockCount > 0 ? onSelectAlertTab : undefined}
          className={`bg-white dark:bg-slate-800 rounded-xl p-5 border transition-all ${
            metrics.criticalCount > 0
              ? 'border-red-200 bg-red-50/30 hover:bg-red-50/50 cursor-pointer'
              : metrics.lowStockCount > 0
              ? 'border-amber-200 bg-amber-50/20 hover:bg-amber-50/40 cursor-pointer'
              : 'border-slate-200 dark:border-slate-700/80 dark:border-slate-700'
          } shadow-xs flex items-center justify-between`}
        >
          <div>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Low Inventory Alerts</p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.lowStockCount}</p>
              {metrics.criticalCount > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                  {metrics.criticalCount} Critical
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-1">
              {metrics.lowStockCount > 0 ? (
                <span className="text-red-700 font-medium hover:underline flex items-center gap-1">
                  <span>Review & auto-generate POs</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
              ) : (
                <span className="text-emerald-700 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Optimal stock reserves</span>
                </span>
              )}
            </p>
          </div>
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              metrics.criticalCount > 0
                ? 'bg-red-100 text-red-600'
                : metrics.lowStockCount > 0
                ? 'bg-amber-100 text-amber-600'
                : 'bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400'
            }`}
          >
            <AlertTriangle className={`w-6 h-6 ${metrics.lowStockCount > 0 ? 'animate-pulse' : ''}`} />
          </div>
        </div>
      </div>

      {/* Action Bar & Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700/80 dark:border-slate-700 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 dark:text-slate-400" />
            <input
              id="input-inventory-search"
              type="text"
              placeholder="Search by SKU, product name, warehouse, or supplier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 dark:bg-slate-900 dark:bg-slate-950/50"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="btn-export-inventory-csv"
              onClick={() => exportInventoryCSV(items)}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200/80 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
              <span>Export CSV</span>
            </button>

            <button
              id="btn-add-new-sku"
              onClick={onOpenAddItem}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs shadow-blue-500/20 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Product</span>
            </button>
          </div>
        </div>

        {/* Filter Chips & Category Dropdown */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-600 dark:text-slate-400 font-medium mr-1 flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Status:
            </span>
            {(
              [
                {
                  id: 'all',
                  label: `All (${items.length})`,
                  color: 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:bg-slate-950',
                  activeColor: 'bg-slate-900 dark:bg-slate-950 text-white border-slate-900',
                },
                {
                  id: 'critical',
                  label: `Critical (${items.filter((i) => i.status === 'critical').length})`,
                  color: 'text-red-700 bg-red-50 border-red-200 hover:bg-red-100',
                  activeColor: 'bg-red-600 text-white border-red-600',
                },
                {
                  id: 'low',
                  label: `Low Stock (${items.filter((i) => i.status === 'low').length})`,
                  color: 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100',
                  activeColor: 'bg-amber-600 text-white border-amber-600',
                },
                {
                  id: 'healthy',
                  label: `Healthy (${items.filter((i) => i.status === 'healthy').length})`,
                  color: 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
                  activeColor: 'bg-emerald-600 text-white border-emerald-600',
                },
                {
                  id: 'essential',
                  label: `Essential Only (${items.filter((i) => i.isEssential).length})`,
                  color: 'text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100',
                  activeColor: 'bg-indigo-600 text-white border-indigo-600',
                },
              ] as Array<{
                id: 'all' | 'critical' | 'low' | 'healthy' | 'essential';
                label: string;
                color: string;
                activeColor: string;
              }>
            ).map((filter) => {
              const isSelected = statusFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  id={`filter-status-${filter.id}`}
                  onClick={() => setStatusFilter(filter.id)}
                  className={`px-3 py-1 rounded-full border transition-all font-medium ${
                    isSelected ? filter.activeColor : filter.color
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center gap-2">
            <label htmlFor="select-category" className="text-slate-600 dark:text-slate-400 font-medium">Category:</label>
            <select
              id="select-category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              aria-label="Filter items by category"
              className="py-1 px-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:bg-slate-950 text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Inventory Table (Desktop) / Cards (Mobile) */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/80 dark:border-slate-700 shadow-xs overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="py-12 text-center">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">No matching inventory items found</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Try adjusting your search query or reset your status and category filters.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-700/80 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Item & SKU</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Location / Depot</th>
                    <th className="py-3 px-4 text-center">On-Hand Stock</th>
                    <th className="py-3 px-3">Min / Target</th>
                    <th className="py-3 px-3 text-right">Cost / Unit</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 dark:text-slate-300">
                  {filteredItems.map((item) => {
                    const stockPercent = Math.min(
                      100,
                      Math.round((item.quantity / item.targetStock) * 100)
                    );
                    const isLow = item.status === 'low' || item.status === 'critical';

                    return (
                      <tr
                        key={item.id}
                        id={`inventory-row-${item.id}`}
                        className={`hover:bg-slate-50 dark:bg-slate-900 dark:bg-slate-950/80 transition-colors ${
                          item.status === 'critical' ? 'bg-red-50/20' : item.status === 'low' ? 'bg-amber-50/10' : ''
                        }`}
                      >
                        {/* Name & SKU */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-start gap-2">
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                                <span>{item.name}</span>
                                {item.isEssential && (
                                  <span
                                    title="Essential Inventory Item (Auto-Reorder Priority)"
                                    className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200"
                                  >
                                    Essential
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-slate-600 dark:text-slate-400">
                                <span className="font-mono text-[11px] font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 px-1.5 py-0.5 rounded">
                                  {item.sku}
                                </span>
                                <span>•</span>
                                <span>Supplier: {item.supplier.name}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Category */}
                        <td className="py-3.5 px-3">
                          <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-medium">
                            {item.category}
                          </span>
                        </td>

                        {/* Warehouse */}
                        <td className="py-3.5 px-3">
                          <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400 shrink-0" />
                            <span className="truncate max-w-[130px]">{item.warehouse}</span>
                          </span>
                        </td>

                        {/* On-Hand Stock with Quick Increment/Decrement */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col items-center">
                            <div className="flex items-center gap-2">
                              <button
                                id={`btn-decrement-${item.id}`}
                                onClick={() => onUpdateQuantity(item.id, Math.max(0, item.quantity - 1), 'Manual decrement')}
                                className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 flex items-center justify-center text-slate-600 dark:text-slate-400 transition-colors"
                                title="Reduce stock by 1 unit"
                              >
                                <Minus className="w-3 h-3" />
                              </button>

                              <span
                                className={`font-mono text-sm font-bold min-w-[36px] text-center ${
                                  item.status === 'critical'
                                    ? 'text-red-700'
                                    : item.status === 'low'
                                    ? 'text-amber-700'
                                    : 'text-slate-900 dark:text-white'
                                }`}
                              >
                                {item.quantity}
                              </span>

                              <button
                                id={`btn-increment-${item.id}`}
                                onClick={() => onUpdateQuantity(item.id, item.quantity + 1, 'Manual increment')}
                                className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 flex items-center justify-center text-slate-600 dark:text-slate-400 transition-colors"
                                title="Add stock by 1 unit"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Progress bar */}
                            <div className="w-24 bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  item.status === 'critical'
                                    ? 'bg-red-500'
                                    : item.status === 'low'
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                }`}
                                style={{ width: `${stockPercent}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Min / Target */}
                        <td className="py-3.5 px-3">
                          <div className="text-slate-600 dark:text-slate-400">
                            <div>
                              Min: <span className="font-semibold text-slate-800 dark:text-slate-200">{item.minThreshold}</span>
                            </div>
                            <div className="text-[11px] text-slate-600 dark:text-slate-400">
                              Target: <span className="font-semibold text-slate-700 dark:text-slate-300">{item.targetStock}</span>
                            </div>
                          </div>
                        </td>

                        {/* Unit Cost */}
                        <td className="py-3.5 px-3 text-right">
                          <div className="font-medium text-slate-900 dark:text-white">{formatCurrency(item.unitCost)}</div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-400">Retail: {formatCurrency(item.unitPrice)}</div>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-4">
                          {item.status === 'critical' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-700 border border-red-200">
                              <AlertTriangle className="w-3 h-3" />
                              Critical
                            </span>
                          ) : item.status === 'low' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                              <AlertTriangle className="w-3 h-3" />
                              Low Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              Healthy
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          {isLow ? (
                            <button
                              id={`btn-reorder-${item.id}`}
                              onClick={() => onQuickReorder(item)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-2xs"
                              title="Generate reorder purchase order via Zapier"
                            >
                              <ShoppingCart className="w-3.5 h-3.5" />
                              <span>Reorder</span>
                            </button>
                          ) : (
                            <button
                              id={`btn-restock-opt-${item.id}`}
                              onClick={() => onQuickReorder(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs transition-colors"
                              title="Prepare purchase order"
                            >
                              <span>Create PO</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards List */}
            <div className="lg:hidden divide-y divide-slate-100">
              {filteredItems.map((item) => {
                const isLow = item.status === 'low' || item.status === 'critical';
                const stockPercent = Math.min(100, Math.round((item.quantity / item.targetStock) * 100));

                return (
                  <div
                    key={item.id}
                    className={`p-4 space-y-3 ${
                      item.status === 'critical' ? 'bg-red-50/30' : item.status === 'low' ? 'bg-amber-50/20' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-900 dark:text-white text-sm">{item.name}</span>
                          {item.isEssential && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Essential
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-xs text-slate-600 dark:text-slate-400 mt-0.5">{item.sku} • {item.category}</p>
                      </div>

                      {/* Status badge */}
                      {item.status === 'critical' ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700 border border-red-200">
                          Critical
                        </span>
                      ) : item.status === 'low' ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                          Low Stock
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                          Healthy
                        </span>
                      )}
                    </div>

                    {/* Stock numbers & Quick controls */}
                    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/60">
                      <div>
                        <span className="text-xs text-slate-600 dark:text-slate-400 block">On Hand / Target</span>
                        <div className="flex items-baseline gap-1">
                          <span
                            className={`text-lg font-bold font-mono ${
                              isLow ? 'text-red-700' : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {item.quantity}
                          </span>
                          <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">/ {item.targetStock} units</span>
                          <span className="text-[10px] text-slate-600 dark:text-slate-400 ml-1">(Min: {item.minThreshold})</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          id={`btn-mobile-decrement-${item.id}`}
                          onClick={() => onUpdateQuantity(item.id, Math.max(0, item.quantity - 1), 'Mobile adjustment')}
                          aria-label={`Reduce stock for ${item.name}`}
                          className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 shadow-xs flex items-center justify-center text-slate-800 dark:text-slate-200 active:bg-slate-200 active:scale-95 transition-transform"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <button
                          id={`btn-mobile-increment-${item.id}`}
                          onClick={() => onUpdateQuantity(item.id, item.quantity + 1, 'Mobile adjustment')}
                          aria-label={`Add stock for ${item.name}`}
                          className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 shadow-xs flex items-center justify-center text-slate-800 dark:text-slate-200 active:bg-slate-200 active:scale-95 transition-transform"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Footer with Reorder button */}
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-slate-600 dark:text-slate-400">Unit: {formatCurrency(item.unitCost)}</span>
                      <button
                        onClick={() => onQuickReorder(item)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium text-xs shadow-2xs hover:bg-blue-700"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>Reorder PO</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
