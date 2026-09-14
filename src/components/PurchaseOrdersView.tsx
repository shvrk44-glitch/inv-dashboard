import { useState } from 'react';
import {
  FileText,
  Send,
  CheckCircle2,
  Clock,
  ExternalLink,
  Download,
  Printer,
  PackageCheck,
  Building2,
  Mail,
  Zap,
  Plus,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { PurchaseOrder, POStatus } from '../types';
import { formatCurrency } from '../utils/stockUtils';
import { exportPurchaseOrderJSON } from '../utils/exportUtils';

interface PurchaseOrdersViewProps {
  orders: PurchaseOrder[];
  onDispatchToWebhook: (poId: string) => Promise<void>;
  onMarkAsReceived: (poId: string) => void;
  onViewDetails: (po: PurchaseOrder) => void;
  onOpenCreatePO: () => void;
}

export function PurchaseOrdersView({
  orders,
  onDispatchToWebhook,
  onMarkAsReceived,
  onViewDetails,
  onOpenCreatePO,
}: PurchaseOrdersViewProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | POStatus>('all');
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);

  const filteredOrders = orders.filter((order) => {
    if (statusFilter === 'all') return true;
    return order.status === statusFilter;
  });

  const handleDispatch = async (poId: string) => {
    setDispatchingId(poId);
    try {
      await onDispatchToWebhook(poId);
    } finally {
      setDispatchingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700/80 dark:border-slate-700 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Purchase Orders & Replenishment</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Automated procurement orders sent to suppliers and notified to email via Webhook webhooks.
          </p>
        </div>

        <button
          id="btn-create-manual-po"
          onClick={onOpenCreatePO}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Purchase Order</span>
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {(
          [
            { id: 'all', label: `All Orders (${orders.length})` },
            {
              id: 'dispatched_zapier',
              label: `Dispatched via Webhook (${orders.filter((o) => o.status === 'dispatched_zapier').length})`,
            },
            {
              id: 'received',
              label: `Received & Stocked (${orders.filter((o) => o.status === 'received').length})`,
            },
            {
              id: 'draft',
              label: `Drafts (${orders.filter((o) => o.status === 'draft').length})`,
            },
          ] as const
        ).map((tab) => {
          const isSelected = statusFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                isSelected
                  ? 'bg-slate-900 dark:bg-slate-950 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:bg-slate-950'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-12 text-center border border-slate-200 dark:border-slate-700/80 dark:border-slate-700 shadow-xs">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">No Purchase Orders in this status</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            Generate an automated purchase order from the Low Stock Alerts screen or create a manual PO above.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((po) => {
            const isDispatched = po.status === 'dispatched_zapier';
            const isReceived = po.status === 'received';
            const isDraft = po.status === 'draft';
            const isFailed = po.status === 'dispatch_failed';
            const isSendingThis = dispatchingId === po.id;

            return (
              <div
                key={po.id}
                id={`po-card-${po.id}`}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/80 dark:border-slate-700 p-5 shadow-xs hover:border-slate-300 dark:border-slate-600 transition-all space-y-4"
              >
                {/* PO Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">{po.poNumber}</span>
                        {po.autoGenerated && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                            <Zap className="w-3 h-3 text-amber-500" />
                            Auto-Generated
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">Created on {po.createdAt}</p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    {isDispatched && (
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                        po.zapierStatus === 'simulated'
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        <Zap className="w-3.5 h-3.5" />
                        <span>
                          {po.zapierStatus === 'simulated'
                            ? 'Simulated Verification (No Live Email)'
                            : 'Delivered via Webhook Webhook'}
                        </span>
                      </span>
                    )}
                    {isFailed && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                        <span>Dispatch Failed (Retry Available)</span>
                      </span>
                    )}
                    {isReceived && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Received & Restocked</span>
                      </span>
                    )}
                    {isDraft && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        <span>Draft (Pending Webhook)</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* PO Content Body */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {/* Supplier Info */}
                  <div className="space-y-1">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Vendor / Supplier</span>
                    <p className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                      {po.supplierName}
                    </p>
                    <p className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                      <Mail className="w-3 h-3 text-slate-600 dark:text-slate-400" />
                      {po.supplierEmail}
                    </p>
                  </div>

                  {/* Webhook Notification Target */}
                  <div className="space-y-1">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Email Notification Recipient</span>
                    <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-blue-500" />
                      {po.recipientEmail}
                    </p>
                    {po.zapierDispatchedAt && (
                      <p className="text-slate-600 dark:text-slate-400">
                        Dispatched: <span className="font-mono">{po.zapierDispatchedAt}</span> (Status: {po.zapierStatus})
                      </p>
                    )}
                  </div>

                  {/* Order Financials */}
                  <div className="space-y-1 md:text-right">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Total Procurement Amount</span>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(po.totalAmount)}</p>
                    <p className="text-slate-600 dark:text-slate-400">
                      {po.items.length} {po.items.length === 1 ? 'Line Item' : 'Line Items'} •{' '}
                      {po.items.reduce((a, c) => a + c.orderQty, 0)} Units Total
                    </p>
                  </div>
                </div>

                {/* Line Items Table Snippet */}
                <div className="bg-slate-50 dark:bg-slate-900 dark:bg-slate-950 rounded-lg p-3 border border-slate-200 dark:border-slate-700/60 overflow-x-auto text-xs">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/60 font-semibold">
                        <th className="pb-1.5">SKU</th>
                        <th className="pb-1.5">Item Description</th>
                        <th className="pb-1.5 text-center">Order Qty</th>
                        <th className="pb-1.5 text-right">Unit Cost</th>
                        <th className="pb-1.5 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/40 text-slate-700 dark:text-slate-300">
                      {po.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-1.5 font-mono text-slate-600 dark:text-slate-400">{item.sku}</td>
                          <td className="py-1.5 font-medium text-slate-900 dark:text-white">{item.name}</td>
                          <td className="py-1.5 text-center font-bold text-blue-600">
                            +{item.orderQty} units
                          </td>
                          <td className="py-1.5 text-right">{formatCurrency(item.unitCost)}</td>
                          <td className="py-1.5 text-right font-medium">
                            {formatCurrency(item.totalCost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Actions Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <button
                      id={`btn-view-po-${po.id}`}
                      onClick={() => onViewDetails(po)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      <span>View Invoice</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Dispatch button if draft or re-dispatch if failed */}
                    {(isDraft || isFailed) && (
                      <button
                        id={`btn-dispatch-webhook-${po.id}`}
                        disabled={isSendingThis}
                        onClick={() => handleDispatch(po.id)}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-white font-semibold text-xs shadow-2xs transition-colors cursor-pointer disabled:opacity-50 ${
                          isFailed ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                      >
                        {isSendingThis ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        <span>{isFailed ? 'Retry Webhook Dispatch' : 'Dispatch to Webhook Webhook'}</span>
                      </button>
                    )}

                    {/* Mark as received & restock button */}
                    {!isReceived && (
                      <button
                        id={`btn-receive-po-${po.id}`}
                        onClick={() => onMarkAsReceived(po.id)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-2xs transition-colors cursor-pointer"
                        title="Add order quantities to live stock inventory"
                      >
                        <PackageCheck className="w-3.5 h-3.5" />
                        <span>Receive & Restock Stock</span>
                      </button>
                    )}
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
