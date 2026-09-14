import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { StockInventoryView } from './components/StockInventoryView';
import { LowStockAlertsView } from './components/LowStockAlertsView';
import { PurchaseOrdersView } from './components/PurchaseOrdersView';
import { SalesTrendsView } from './components/SalesTrendsView';
import { SupabaseEmailSetupView } from './components/SupabaseEmailSetupView';
import { AddItemModal } from './components/AddItemModal';
import { PurchaseOrderDetailModal } from './components/PurchaseOrderDetailModal';
import { CreatePOModal } from './components/CreatePOModal';
import {
  InventoryItem,
  PurchaseOrder,
  ZapierSettings,
  WebhookLog,
} from './types';
import {
  INITIAL_INVENTORY,
  INITIAL_PURCHASE_ORDERS,
  INITIAL_ZAPIER_SETTINGS,
  QUARTERLY_TRENDS,
} from './data/initialData';
import {
  calculateStockStatus,
  buildAutomatedPurchaseOrder,
} from './utils/stockUtils';
import { CheckCircle2, X, Zap, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<
    'inventory' | 'alerts' | 'orders' | 'analytics' | 'integrations'
  >('inventory');

  // Server connectivity state
  const [isServerOnline, setIsServerOnline] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Core Data initialized from LocalStorage (fast cold start) and reconciled with server
  const [items, setItems] = useState<InventoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('inventory_hub_items');
      return saved ? JSON.parse(saved) : INITIAL_INVENTORY;
    } catch {
      return INITIAL_INVENTORY;
    }
  });

  const [orders, setOrders] = useState<PurchaseOrder[]>(() => {
    try {
      const saved = localStorage.getItem('inventory_hub_orders');
      return saved ? JSON.parse(saved) : INITIAL_PURCHASE_ORDERS;
    } catch {
      return INITIAL_PURCHASE_ORDERS;
    }
  });

  const [zapierSettings, setZapierSettings] = useState<ZapierSettings>(() => {
    try {
      const saved = localStorage.getItem('inventory_hub_webhook');
      return saved ? JSON.parse(saved) : INITIAL_ZAPIER_SETTINGS;
    } catch {
      return INITIAL_ZAPIER_SETTINGS;
    }
  });

  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);

  // Modals
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isCreatePOOpen, setIsCreatePOOpen] = useState(false);
  const [viewingPO, setViewingPO] = useState<PurchaseOrder | null>(null);

  // Toast notifications
  const [toast, setToast] = useState<{
    id: string;
    type: 'success' | 'alert' | 'info';
    title: string;
    message: string;
  } | null>(null);

  const showToast = (type: 'success' | 'alert' | 'info', title: string, message: string) => {
    setToast({ id: `toast-${Date.now()}`, type, title, message });
    setTimeout(() => {
      setToast(null);
    }, 6000);
  };

  // Theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('inventory_hub_theme');
      return saved === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('inventory_hub_theme', isDarkMode ? 'dark' : 'light');
    } catch {}
  }, [isDarkMode]);

  // Sync to local storage for offline resilience
  useEffect(() => {
    try {
      localStorage.setItem('inventory_hub_items', JSON.stringify(items));
    } catch {
      // quota or private mode
    }
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem('inventory_hub_orders', JSON.stringify(orders));
    } catch {
      // ignore
    }
  }, [orders]);

  useEffect(() => {
    try {
      localStorage.setItem('inventory_hub_webhook', JSON.stringify(zapierSettings));
    } catch {
      // ignore
    }
  }, [zapierSettings]);

  // Reconcile client with server database
  const syncWithServer = useCallback(async () => {
    setIsSyncing(true);
    try {
      const [itemsRes, ordersRes, settingsRes, logsRes] = await Promise.all([
        fetch('/api/items'),
        fetch('/api/orders'),
        fetch('/api/webhook/settings'),
        fetch('/api/webhook/logs'),
      ]);

      if (itemsRes.ok && ordersRes.ok) {
        const itemsData = await itemsRes.json();
        const ordersData = await ordersRes.json();
        const settingsData = settingsRes.ok ? await settingsRes.json() : null;
        const logsData = logsRes.ok ? await logsRes.json() : null;

        if (Array.isArray(itemsData.items) && itemsData.items.length > 0) {
          setItems(itemsData.items);
        }
        if (Array.isArray(ordersData.orders)) {
          setOrders(ordersData.orders);
        }
        if (settingsData?.settings) {
          setZapierSettings(settingsData.settings);
        }
        if (logsData?.logs) {
          setWebhookLogs(logsData.logs);
        }

        setIsServerOnline(true);
      } else {
        setIsServerOnline(false);
      }
    } catch (err) {
      console.warn('[Sync] Offline or server unreachable, using client cache:', err);
      setIsServerOnline(false);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    syncWithServer();
  }, [syncWithServer]);

  // Update Item Quantity atomically on server & client
  const handleUpdateQuantity = async (itemId: string, newQty: number, note?: string) => {
    const clampedQty = Math.max(0, newQty);

    // Optimistic client update
    let triggeredPO: PurchaseOrder | null = null;
    setItems((prevItems) => {
      return prevItems.map((item) => {
        if (item.id !== itemId) return item;
        const newStatus = calculateStockStatus(clampedQty, item.minThreshold);
        return {
          ...item,
          quantity: clampedQty,
          status: newStatus,
        };
      });
    });

    try {
      const response = await fetch(`/api/items/${itemId}/adjust`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newQuantity: clampedQty, reason: note }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.item) {
          setItems((prev) => prev.map((i) => (i.id === itemId ? data.item : i)));
        }

        if (data.autoPO) {
          setOrders((prev) => [data.autoPO, ...prev]);
          showToast(
            'alert',
            'Automated PO Triggered!',
            `Safety threshold breached for ${data.item.name}. Reorder ${data.autoPO.poNumber} generated and sent to Webhook for notification.`
          );
        }
      } else {
        throw new Error('Server returned error on stock adjustment');
      }
    } catch (err) {
      console.warn('[Adjust] Server adjustment fallback to local:', err);
      // Fallback for offline mode: compute client auto-PO
      const currentItem = items.find((i) => i.id === itemId);
      if (currentItem && zapierSettings.autoTriggerOnLowStock) {
        const newStatus = calculateStockStatus(clampedQty, currentItem.minThreshold);
        const wasHealthy = currentItem.status === 'healthy';
        const isNowLow = newStatus === 'low' || newStatus === 'critical';

        if (wasHealthy && isNowLow) {
          const eligible = !zapierSettings.autoTriggerOnlyEssential || currentItem.isEssential;
          if (eligible) {
            const pos = buildAutomatedPurchaseOrder([currentItem], 'configured email', true);
            if (pos.length > 0) {
              triggeredPO = pos[0];
              setOrders((prev) => [triggeredPO!, ...prev]);
              showToast(
                'alert',
                'Automated PO Triggered (Local)',
                `Threshold breach for ${currentItem.name}. Drafted ${triggeredPO.poNumber}.`
              );
            }
          }
        }
      }
    }
  };

  // Add SKU to catalog
  const handleAddItem = async (newItem: InventoryItem) => {
    try {
      const response = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem),
      });

      if (response.ok) {
        const data = await response.json();
        setItems((prev) => [data.item, ...prev]);
        showToast('success', 'SKU Added', `${data.item.name} (${data.item.sku}) saved to database.`);
      } else {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to save item');
      }
    } catch (err: any) {
      // Local fallback
      setItems((prev) => [newItem, ...prev]);
      showToast('info', 'SKU Added (Local Cache)', `${newItem.name} added to inventory.`);
    }
  };

  // Dispatch PO to Webhook Webhook
  const handleDispatchPOToWebhook = async (poId: string, directPo?: PurchaseOrder) => {
    const po = directPo || orders.find((o) => o.id === poId);
    if (!po) return;

    try {
      const response = await fetch(`/api/orders/${poId}/dispatch`, {
        method: 'POST',
      });

      const resData = await response.json();

      if (resData.order) {
        setOrders((prev) => prev.map((o) => (o.id === poId ? resData.order : o)));
      }

      if (resData.log) {
        setWebhookLogs((prev) => [resData.log, ...prev]);
      }

      if (resData.success) {
        showToast(
          'success',
          'Webhook Webhook Dispatched',
          `Notification for ${po.poNumber} sent to ${'configured email'} (${resData.mode === 'simulation' ? 'Simulated validation' : 'Live delivered'}).`
        );
      } else {
        showToast(
          'alert',
          'Webhook Dispatch Issue',
          resData.error || 'Webhook failed to acknowledge. PO saved as draft for retry.'
        );
      }
    } catch (err: any) {
      console.error(err);
      showToast('alert', 'Network Error', 'Could not reach server to dispatch webhook.');
    }
  };

  // Generate automated POs for multiple low-stock items
  const handleGenerateAutoPOs = async (itemsToOrder: InventoryItem[], sendToWebhookNow: boolean) => {
    if (itemsToOrder.length === 0) return;

    const generatedPOs = buildAutomatedPurchaseOrder(itemsToOrder, 'configured email', true);

    for (const po of generatedPOs) {
      try {
        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(po),
        });

        if (response.ok) {
          const data = await response.json();
          setOrders((prev) => [data.order, ...prev]);

          if (sendToWebhookNow) {
            await handleDispatchPOToWebhook(data.order.id, data.order);
          }
        } else {
          setOrders((prev) => [po, ...prev]);
        }
      } catch {
        setOrders((prev) => [po, ...prev]);
      }
    }

    showToast('success', 'Purchase Orders Generated', `Created ${generatedPOs.length} purchase orders.`);
  };

  // Receive PO & Restock Inventory
  const handleMarkAsReceived = async (poId: string) => {
    try {
      const response = await fetch(`/api/orders/${poId}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.order) {
          setOrders((prev) => prev.map((o) => (o.id === poId ? data.order : o)));
        }
        if (Array.isArray(data.updatedItems)) {
          setItems(data.updatedItems);
        }
        showToast('success', 'Stock Replenished!', data.summary || 'Purchase order received and inventory updated.');
      } else {
        throw new Error('Server receipt error');
      }
    } catch (err: any) {
      // Local fallback
      const po = orders.find((o) => o.id === poId);
      if (!po) return;

      setItems((prevItems) => {
        const updated = [...prevItems];
        for (const orderItem of po.items) {
          const idx = updated.findIndex((i) => i.id === orderItem.itemId || i.sku === orderItem.sku);
          if (idx >= 0) {
            const newQty = updated[idx].quantity + orderItem.orderQty;
            updated[idx] = {
              ...updated[idx],
              quantity: newQty,
              lastRestocked: new Date().toISOString().split('T')[0],
              status: calculateStockStatus(newQty, updated[idx].minThreshold),
            };
          }
        }
        return updated;
      });

      setOrders((prev) => prev.map((o) => (o.id === poId ? { ...o, status: 'received' } : o)));
      showToast('success', 'Stock Replenished (Local)', `Received items from ${po.supplierName}.`);
    }
  };

  // Test Webhook webhook connection
  const handleTestWebhook = async () => {
    try {
      const response = await fetch('/api/webhook/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      if (data.log) {
        setWebhookLogs((prev) => [data.log, ...prev]);
      }

      if (data.success) {
        return {
          success: true,
          message:
            data.mode === 'simulation'
              ? 'Test payload validated successfully in Simulation Mode. Configure a live Webhook Catch Hook URL to route outbound notifications to external services.'
              : 'Live HTTP POST delivered successfully to Webhook endpoint (HTTP 200 OK)!',
          httpCode: data.httpStatus || 200,
        };
      } else {
        return {
          success: false,
          message: data.error || 'Failed to reach webhook endpoint',
          httpCode: data.httpStatus || 500,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Network error communicating with server test endpoint',
        httpCode: 502,
      };
    }
  };

  // Quick reorder single item from inventory view
  const handleQuickReorderItem = async (item: InventoryItem) => {
    const pos = buildAutomatedPurchaseOrder([item], 'configured email', false);
    if (pos.length > 0) {
      const po = pos[0];
      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(po),
        });
        if (res.ok) {
          const data = await res.json();
          setOrders((prev) => [data.order, ...prev]);
        } else {
          setOrders((prev) => [po, ...prev]);
        }
      } catch {
        setOrders((prev) => [po, ...prev]);
      }

      setActiveTab('orders');
      showToast(
        'info',
        'Purchase Order Prepared',
        `Drafted ${po.poNumber} for ${item.name}. Click 'Dispatch to Webhook Webhook' to transmit.`
      );
    }
  };

  // Create manual PO
  const handleCreateManualPO = async (po: PurchaseOrder, dispatchNow: boolean) => {
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(po),
      });

      if (response.ok) {
        const data = await response.json();
        setOrders((prev) => [data.order, ...prev]);
        if (dispatchNow) {
          await handleDispatchPOToWebhook(data.order.id, data.order);
        } else {
          showToast('info', 'PO Saved as Draft', `Purchase Order ${data.order.poNumber} saved to database.`);
        }
      } else {
        setOrders((prev) => [po, ...prev]);
        if (dispatchNow) {
          await handleDispatchPOToWebhook(po.id, po);
        }
      }
    } catch {
      setOrders((prev) => [po, ...prev]);
      if (dispatchNow) {
        await handleDispatchPOToWebhook(po.id, po);
      }
    }
  };

  // Update Settings
  const handleUpdateSettings = async (newSettings: ZapierSettings) => {
    setZapierSettings(newSettings);
    try {
      await fetch('/api/webhook/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
    } catch {
      // saved to localStorage
    }
  };

  return (
    <div className={`${isDarkMode ? 'dark' : ''} min-h-screen bg-slate-100/70 text-slate-800 dark:text-slate-200 dark:bg-slate-900 dark:text-slate-200 flex flex-col font-sans antialiased`}>
      {/* Header with Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        items={items}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
      />


      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md animate-bounce-short">
          <div
            className={`p-4 rounded-xl border shadow-xl flex items-start gap-3 text-xs sm:text-sm ${
              toast.type === 'success'
                ? 'bg-emerald-900 text-white border-emerald-700'
                : toast.type === 'alert'
                ? 'bg-amber-900 text-white border-amber-700'
                : 'bg-slate-900 text-white border-slate-700'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : toast.type === 'alert' ? (
              <Zap className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-bold text-white text-xs">{toast.title}</p>
              <p className="text-slate-200 text-xs mt-0.5 leading-snug">{toast.message}</p>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-white p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'inventory' && (
          <StockInventoryView
            items={items}
            onUpdateQuantity={handleUpdateQuantity}
            onOpenAddItem={() => setIsAddItemOpen(true)}
            onQuickReorder={handleQuickReorderItem}
            onSelectAlertTab={() => setActiveTab('alerts')}
          />
        )}

        {activeTab === 'alerts' && (
          <LowStockAlertsView
            items={items}
            onGenerateAutoPOs={handleGenerateAutoPOs}
            onNavigateToOrders={() => setActiveTab('orders')}
          />
        )}

        {activeTab === 'orders' && (
          <PurchaseOrdersView
            orders={orders}
            onDispatchToWebhook={handleDispatchPOToWebhook}
            onMarkAsReceived={handleMarkAsReceived}
            onViewDetails={(po) => setViewingPO(po)}
            onOpenCreatePO={() => setIsCreatePOOpen(true)}
          />
        )}

        {activeTab === 'analytics' && (
          <SalesTrendsView quarterlyReports={QUARTERLY_TRENDS} />
        )}

        {activeTab === 'integrations' && (
          <SupabaseEmailSetupView onShowToast={showToast} />
        )}
      </main>

      {/* Modals */}
      <AddItemModal
        isOpen={isAddItemOpen}
        onClose={() => setIsAddItemOpen(false)}
        onAddItem={handleAddItem}
      />

      <CreatePOModal
        isOpen={isCreatePOOpen}
        onClose={() => setIsCreatePOOpen(false)}
        items={items}
        recipientEmail={'configured email'}
        onCreatePO={handleCreateManualPO}
      />

      <PurchaseOrderDetailModal
        po={viewingPO}
        onClose={() => setViewingPO(null)}
        onDispatchToWebhook={handleDispatchPOToWebhook}
      />

      {/* Responsive Footer */}
      <footer className="bg-white dark:bg-slate-800 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700/80 dark:border-slate-700 dark:border-slate-800 py-4 text-center text-xs text-slate-500 dark:text-slate-400 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300 dark:text-slate-300">Inventory Hub</span>
            <span>•</span>
            <span>Real-Time Stock, Webhook Webhook Procurement &amp; Quarterly Analytics</span>
          </div>
          <div className="flex items-center gap-4 text-slate-600 dark:text-slate-400">
            <span>Server Proxy: Port 3000</span>
            <span>•</span>
            <span>Recipient: {'configured email'}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
