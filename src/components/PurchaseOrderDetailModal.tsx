import { X, Printer, Download, Mail, Building2, Send, Zap, CheckCircle2 } from 'lucide-react';
import { PurchaseOrder } from '../types';
import { formatCurrency } from '../utils/stockUtils';
import { exportPurchaseOrderJSON } from '../utils/exportUtils';

interface PurchaseOrderDetailModalProps {
  po: PurchaseOrder | null;
  onClose: () => void;
  onDispatchToWebhook: (poId: string) => Promise<void>;
}

export function PurchaseOrderDetailModal({
  po,
  onClose,
  onDispatchToWebhook,
}: PurchaseOrderDetailModalProps) {
  if (!po) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto print:max-w-none print:shadow-none print:border-none">
        {/* Header Controls (Hidden during print) */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 sticky top-0 bg-white dark:bg-slate-800 z-10 print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 dark:text-white text-base">Purchase Order Document</span>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300">
              {po.poNumber}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 text-slate-600 dark:text-slate-400 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Invoice Printable Sheet */}
        <div className="p-6 sm:p-8 space-y-6 text-xs text-slate-700 dark:text-slate-300">
          {/* Top Title & PO Number */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-slate-200 dark:border-slate-700">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">PURCHASE ORDER</h1>
              <p className="text-slate-500 dark:text-slate-400 font-mono mt-0.5">PO Number: {po.poNumber}</p>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5">Issue Date: {po.createdAt}</p>
            </div>

            <div className="text-left sm:text-right">
              <span className="font-bold text-slate-900 dark:text-white text-base">Inventory Hub Corp.</span>
              <p className="text-slate-500 dark:text-slate-400">Warehouse &amp; Logistics Facility 1</p>
              <p className="text-slate-500 dark:text-slate-400">Stock Procurement Operations</p>
              <p className="text-blue-600 font-medium">{po.recipientEmail}</p>
            </div>
          </div>

          {/* Supplier & Notification Targets */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-900 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60">
            <div>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-wider block mb-1">
                Vendor / Supplier
              </span>
              <p className="font-bold text-slate-900 dark:text-white text-sm">{po.supplierName}</p>
              <p className="text-slate-600 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                <Mail className="w-3 h-3 text-slate-400" />
                {po.supplierEmail}
              </p>
            </div>

            <div>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-wider block mb-1">
                Webhook Webhook &amp; Notification Route
              </span>
              <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Triggered to: {po.recipientEmail}</span>
              </p>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                Status: {po.status === 'dispatched_zapier' ? 'Dispatched to Webhook' : po.status}
              </p>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-100 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-bold uppercase text-[11px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-4">Item SKU</th>
                  <th className="py-2.5 px-4">Description</th>
                  <th className="py-2.5 px-3 text-center">Current Stock</th>
                  <th className="py-2.5 px-3 text-center">Order Qty</th>
                  <th className="py-2.5 px-4 text-right">Unit Cost</th>
                  <th className="py-2.5 px-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {po.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:bg-slate-900 dark:bg-slate-950">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-800 dark:text-slate-200">{item.sku}</td>
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">{item.name}</td>
                    <td className="py-3 px-3 text-center text-slate-500 dark:text-slate-400">{item.currentQty}</td>
                    <td className="py-3 px-3 text-center font-bold text-blue-600">
                      {item.orderQty} units
                    </td>
                    <td className="py-3 px-4 text-right">{formatCurrency(item.unitCost)}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                      {formatCurrency(item.totalCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Subtotal & Total */}
          <div className="flex justify-end">
            <div className="w-full sm:w-72 space-y-2 bg-slate-50 dark:bg-slate-900 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Subtotal</span>
                <span>{formatCurrency(po.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Estimated Freight / Tax</span>
                <span>$0.00 (Exempt / Direct)</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                <span>Total Amount Due</span>
                <span>{formatCurrency(po.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 space-y-1">
            <span className="font-bold text-amber-900 text-xs">Procurement Instructions &amp; Notes</span>
            <p className="text-amber-800 text-xs leading-relaxed">{po.notes}</p>
          </div>

          {/* Footer Dispatch Action (Hidden in print) */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700 print:hidden">
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">
              Inventory Hub Reorder Automation • Powered by Webhook Webhook Dispatcher
            </span>

            {po.status === 'draft' && (
              <button
                onClick={() => {
                  onDispatchToWebhook(po.id);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send to Webhook Webhook Now</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
