import { useState, type FormEvent } from 'react';
import { X, Plus, Package, Building2, DollarSign, ShieldAlert } from 'lucide-react';
import { InventoryItem } from '../types';
import { calculateStockStatus } from '../utils/stockUtils';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItem: (item: InventoryItem) => void;
}

export function AddItemModal({ isOpen, onClose, onAddItem }: AddItemModalProps) {
  const [sku, setSku] = useState(`SKU-${Math.floor(1000 + Math.random() * 9000)}`);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [warehouse, setWarehouse] = useState('Main Distribution Hub A');
  const [quantity, setQuantity] = useState(50);
  const [minThreshold, setMinThreshold] = useState(25);
  const [targetStock, setTargetStock] = useState(100);
  const [unitCost, setUnitCost] = useState(10.0);
  const [unitPrice, setUnitPrice] = useState(22.5);
  const [isEssential, setIsEssential] = useState(true);
  const [supplierName, setSupplierName] = useState('Apex Semiconductor Direct');
  const [supplierEmail, setSupplierEmail] = useState('orders@apexsemicon.com');
  const [leadTimeDays, setLeadTimeDays] = useState(4);
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !sku.trim()) return;

    const status = calculateStockStatus(quantity, minThreshold);

    const newItem: InventoryItem = {
      id: `item-${Date.now()}`,
      sku: sku.trim().toUpperCase(),
      name: name.trim(),
      category,
      warehouse,
      quantity: Number(quantity),
      minThreshold: Number(minThreshold),
      targetStock: Number(targetStock),
      unitCost: Number(unitCost),
      unitPrice: Number(unitPrice),
      supplier: {
        name: supplierName,
        email: supplierEmail,
        phone: '+1 (555) 000-0000',
        leadTimeDays: Number(leadTimeDays),
      },
      lastRestocked: new Date().toISOString().split('T')[0],
      isEssential,
      status,
      notes,
    };

    onAddItem(newItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white dark:bg-slate-800 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Add New Inventory SKU</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Register a product with reorder thresholds and supplier data</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 text-slate-600 dark:text-slate-400 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Row 1: SKU & Name */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">SKU Identifier</label>
              <input
                type="text"
                required
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 font-mono font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Product / Item Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Ultra-Wide Micro Sensor v2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Row 2: Category & Warehouse */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800"
              >
                <option value="Electronics">Electronics</option>
                <option value="Packaging">Packaging</option>
                <option value="Hardware">Hardware</option>
                <option value="Safety & Hygiene">Safety & Hygiene</option>
                <option value="Cabling & Networking">Cabling & Networking</option>
                <option value="Raw Materials">Raw Materials</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Warehouse Location</label>
              <select
                value={warehouse}
                onChange={(e) => setWarehouse(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800"
              >
                <option value="Main Distribution Hub A">Main Distribution Hub A</option>
                <option value="Depot Logistics B">Depot Logistics B</option>
                <option value="Cleanroom Storage C">Cleanroom Storage C</option>
              </select>
            </div>
          </div>

          {/* Row 3: Stock Levels */}
          <div className="bg-slate-50 dark:bg-slate-900 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 dark:border-slate-700 space-y-2">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-wider">
              Stock Reorder Limits
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-slate-600 dark:text-slate-400 block mb-1">Initial Quantity</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-slate-600 dark:text-slate-400 block mb-1">Min Threshold (Alert)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={minThreshold}
                  onChange={(e) => setMinThreshold(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 font-mono font-bold text-amber-600"
                />
              </div>
              <div>
                <label className="text-slate-600 dark:text-slate-400 block mb-1">Target Ceiling Stock</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={targetStock}
                  onChange={(e) => setTargetStock(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 font-mono font-bold text-emerald-600"
                />
              </div>
            </div>
          </div>

          {/* Row 4: Pricing */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Unit Cost ($ Wholesale)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={unitCost}
                onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 font-mono"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Unit Price ($ Retail / Selling)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={unitPrice}
                onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 font-mono"
              />
            </div>
          </div>

          {/* Row 5: Supplier Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Supplier Name</label>
              <input
                type="text"
                required
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Supplier Email</label>
              <input
                type="email"
                required
                value={supplierEmail}
                onChange={(e) => setSupplierEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Lead Time (Days)</label>
              <input
                type="number"
                min="1"
                required
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 font-mono"
              />
            </div>
          </div>

          {/* Essential Toggle */}
          <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-lg bg-indigo-50/50 border border-indigo-100">
            <input
              type="checkbox"
              checked={isEssential}
              onChange={(e) => setIsEssential(e.target.checked)}
              className="rounded text-indigo-600 w-4 h-4"
            />
            <div>
              <span className="font-bold text-indigo-900 block">Flag as Essential Inventory</span>
              <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                Enables high-priority status for automated Zapier purchase order reordering.
              </span>
            </div>
          </label>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800/50 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Add Product SKU
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
