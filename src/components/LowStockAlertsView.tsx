import { useState } from 'react';
import {
  AlertTriangle,
  Zap,
  CheckCircle2,
  ShoppingCart,
  Send,
  ArrowRight,
  ShieldAlert,
  Mail,
  Clock,
  Building2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { InventoryItem, ZapierSettings } from '../types';
import { formatCurrency } from '../utils/stockUtils';

interface LowStockAlertsViewProps {
  items: InventoryItem[];
  onGenerateAutoPOs: (itemsToOrder: InventoryItem[], sendToWebhookNow: boolean) => Promise<void>;
  onNavigateToOrders: () => void;
}

export function LowStockAlertsView({
  items,
  onGenerateAutoPOs,
  onNavigateToOrders,
}: LowStockAlertsViewProps) {
  const [filterEssential, setFilterEssential] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filter low and critical items
  const lowStockItems = items.filter((item) => {
    const isLow = item.status === 'low' || item.status === 'critical';
    if (!isLow) return false;
    if (filterEssential) return item.isEssential;
    return true;
  });

  const criticalItems = lowStockItems.filter((i) => i.status === 'critical');
  const warningItems = lowStockItems.filter((i) => i.status === 'low');
  const essentialCount = items.filter(
    (i) => (i.status === 'low' || i.status === 'critical') && i.isEssential
  ).length;

  const handleBatchReorder = async (essentialOnly: boolean) => {
    setIsProcessing(true);
    setSuccessMessage(null);

    const targetList = items.filter((i) => {
      const isLow = i.status === 'low' || i.status === 'critical';
      return essentialOnly ? isLow && i.isEssential : isLow;
    });

    try {
      await onGenerateAutoPOs(targetList, true);
      setSuccessMessage(
        `Successfully generated Purchase Orders for ${targetList.length} items.`
      );
      setTimeout(() => setSuccessMessage(null), 6000);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSingleReorder = async (item: InventoryItem) => {
    setIsProcessing(true);
    try {
      await onGenerateAutoPOs([item], true);
      setSuccessMessage(
        `PO generated for ${item.name}.`
      );
      setTimeout(() => setSuccessMessage(null), 5000);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert Header Banner */}
      <div className="bg-gradient-to-r from-red-950/80 via-slate-900 to-slate-900 border border-red-900/60 rounded-2xl p-6 text-white relative overflow-hidden shadow-lg">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/30 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                Live Replenishment Monitor
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              {lowStockItems.length > 0 ? (
                <span>
                  {lowStockItems.length} {lowStockItems.length === 1 ? 'Product has' : 'Products have'} breached minimum stock thresholds
                </span>
              ) : (
                <span className="text-emerald-300">All Inventory Levels Are Currently Healthy</span>
              )}
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Automated procurement can calculate reorder quantities up to optimal safety levels and
              dispatch purchase orders directly to suppliers.
            </p>
          </div>

          {/* Quick Action Button */}
          {lowStockItems.length > 0 && (
            <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
              <button
                id="btn-auto-reorder-essential"
                disabled={isProcessing || essentialCount === 0}
                onClick={() => handleBatchReorder(true)}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm shadow-md shadow-blue-500/30 transition-all cursor-pointer"
              >
                {isProcessing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 text-amber-300" />
                )}
                <span>Auto-Reorder {essentialCount} Essential Items</span>
              </button>

              <button
                id="btn-auto-reorder-all"
                disabled={isProcessing}
                onClick={() => handleBatchReorder(false)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition-all cursor-pointer"
              >
                <ShoppingCart className="w-3.5 h-3.5 text-slate-400" />
                <span>Reorder All ({lowStockItems.length} Items)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 flex items-center justify-between gap-3 text-emerald-900 text-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={onNavigateToOrders}
            className="flex items-center gap-1 text-xs font-bold text-emerald-800 hover:underline shrink-0"
          >
            <span>View Orders</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter and stats row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 dark:border-slate-700 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Filter Alerts:</span>
          <button
            id="btn-filter-all-low"
            onClick={() => setFilterEssential(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              !filterEssential
                ? 'bg-slate-900 dark:bg-slate-950 text-white'
                : 'bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            All Low Stock ({items.filter((i) => i.status === 'low' || i.status === 'critical').length})
          </button>
          <button
            id="btn-filter-essential-low"
            onClick={() => setFilterEssential(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              filterEssential
                ? 'bg-indigo-600 text-white'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Essential Only ({essentialCount})</span>
          </button>
        </div>


      </div>

      {/* Critical & Low Items Grid */}
      {lowStockItems.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-12 text-center border border-slate-200 dark:border-slate-700/80 dark:border-slate-700 shadow-xs">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">No Low-Stock Alerts</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-md mx-auto">
            All inventory SKUs are currently maintaining quantities above their assigned safety reorder thresholds.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {lowStockItems.map((item) => {
            const deficit = item.targetStock - item.quantity;
            const estimatedCost = deficit * item.unitCost;
            const isCritical = item.status === 'critical';

            return (
              <div
                key={item.id}
                id={`alert-card-${item.id}`}
                className={`bg-white dark:bg-slate-800 rounded-xl border p-5 transition-all shadow-xs ${
                  isCritical
                    ? 'border-red-200/90 bg-red-50/15 hover:border-red-300'
                    : 'border-amber-200/90 bg-amber-50/10 hover:border-amber-300'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Column: Product details */}
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          isCritical
                            ? 'bg-red-100 text-red-700 border border-red-200'
                            : 'bg-amber-100 text-amber-700 border border-amber-200'
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {isCritical ? 'CRITICAL STOCKOUT RISK' : 'LOW STOCK WARNING'}
                      </span>

                      {item.isEssential && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" />
                          Essential Inventory
                        </span>
                      )}

                      <span className="font-mono text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 px-2 py-0.5 rounded">
                        {item.sku}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white">{item.name}</h3>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-600 dark:text-slate-400 pt-1">
                      <div>
                        <span className="text-slate-600 dark:text-slate-400 block">Warehouse</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                          {item.warehouse}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-600 dark:text-slate-400 block">Supplier</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                          {item.supplier.name}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-600 dark:text-slate-400 block">Lead Time</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                          {item.supplier.leadTimeDays} business days
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-600 dark:text-slate-400 block">Reorder Cost</span>
                        <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block">
                          {formatCurrency(estimatedCost)} ({deficit} units)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle Column: Stock Level Meter */}
                  <div className="bg-slate-50 dark:bg-slate-900 dark:bg-slate-950/80 rounded-xl p-3.5 border border-slate-200 dark:border-slate-700/80 dark:border-slate-700 lg:min-w-[200px] flex flex-col justify-center">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-slate-600 dark:text-slate-400 font-medium">On-Hand:</span>
                      <span
                        className={`font-mono font-bold text-sm ${
                          isCritical ? 'text-red-700' : 'text-amber-700'
                        }`}
                      >
                        {item.quantity} / {item.targetStock}
                      </span>
                    </div>

                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isCritical ? 'bg-red-500' : 'bg-amber-500'
                        }`}
                        style={{
                          width: `${Math.max(
                            4,
                            Math.min(100, Math.round((item.quantity / item.targetStock) * 100))
                          )}%`,
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 mt-1.5">
                      <span>Threshold: {item.minThreshold}</span>
                      <span className="text-red-600 font-medium">Deficit: -{deficit}</span>
                    </div>
                  </div>

                  {/* Right Column: Action Button */}
                  <div className="flex sm:flex-col justify-end gap-2 shrink-0">
                    <button
                      id={`btn-trigger-po-${item.id}`}
                      disabled={isProcessing}
                      onClick={() => handleSingleReorder(item)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-300" />
                      <span>Generate PO & Send Webhook</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
