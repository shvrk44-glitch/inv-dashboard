import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { InventoryItem, PurchaseOrder, PurchaseOrderItem, ZapierSettings, WebhookLog, StockStatus } from '../src/types';
import { INITIAL_INVENTORY, INITIAL_PURCHASE_ORDERS } from '../src/data/initialData';

dotenv.config();

export interface DatabaseSchema {
  items: InventoryItem[];
  orders: PurchaseOrder[];
  settings: ZapierSettings;
  logs: WebhookLog[];
  poSequence: number;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'inventory_db.json');
const TMP_FILE = path.join(DATA_DIR, 'inventory_db.json.tmp');

// In-memory cache synced with disk
let cachedDb: DatabaseSchema | null = null;

/**
 * Formula: Stock Status Calculation
 * - Critical: Quantity <= 0 OR Quantity <= minThreshold * 0.5 (Imminent stockout)
 * - Low: Quantity <= minThreshold (Breaches safety threshold)
 * - Healthy: Quantity > minThreshold
 */
export function calculateStockStatus(quantity: number, minThreshold: number): StockStatus {
  if (quantity <= 0) return 'critical';
  if (quantity <= minThreshold * 0.5) return 'critical';
  if (quantity <= minThreshold) return 'low';
  return 'healthy';
}

function getInitialSettings(): ZapierSettings {
  return {
    autoTriggerOnLowStock: true,
    autoTriggerOnlyEssential: true,
    sendEmailCopy: true,
    notificationPrefix: '[INVENTORY ALERT & PO REORDER]',
  };
}

function initDb(): DatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && Array.isArray(parsed.items) && Array.isArray(parsed.orders)) {
        return parsed;
      }
    } catch (err) {
      console.error('[DB] Corrupted or unreadable DB file, re-seeding:', err);
    }
  }

  // Seed default data with clean environment config
  const initialSettings = getInitialSettings();

  // Ensure default items have clean recipient emails if any
  const seededItems: InventoryItem[] = INITIAL_INVENTORY.map((item) => ({
    ...item,
    status: calculateStockStatus(item.quantity, item.minThreshold),
  }));

  const seededOrders: PurchaseOrder[] = INITIAL_PURCHASE_ORDERS.map((order) => ({
    ...order,
    recipientEmail: process.env.NOTIFICATION_RECIPIENT_EMAIL || 'procurement@company.com',
  }));

  const initialDb: DatabaseSchema = {
    items: seededItems,
    orders: seededOrders,
    settings: initialSettings,
    logs: [],
    poSequence: 1042,
  };

  saveDb(initialDb);
  return initialDb;
}

function getDb(): DatabaseSchema {
  if (!cachedDb) {
    cachedDb = initDb();
  }
  return cachedDb;
}

/**
 * Atomic file-write to prevent corrupt data on crash or power-loss:
 * 1. Write content to inventory_db.json.tmp
 * 2. Atomic rename from .tmp to inventory_db.json
 */
function saveDb(db: DatabaseSchema): void {
  cachedDb = db;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const json = JSON.stringify(db, null, 2);
    fs.writeFileSync(TMP_FILE, json, 'utf-8');
    fs.renameSync(TMP_FILE, DB_FILE);
  } catch (err) {
    console.error('[DB] Atomic write error:', err);
    throw err;
  }
}

// ==========================================
// DATABASE ACCESS METHODS
// ==========================================

export function getItems(): InventoryItem[] {
  const db = getDb();
  return db.items;
}

export function getItemById(id: string): InventoryItem | undefined {
  const db = getDb();
  return db.items.find((i) => i.id === id || i.sku === id);
}

export function addItem(itemData: Partial<InventoryItem>): InventoryItem {
  const db = getDb();

  const name = String(itemData.name || '').trim();
  const sku = String(itemData.sku || '').trim().toUpperCase();

  if (!name || !sku) {
    throw new Error('Item name and SKU are required fields.');
  }

  // Check duplicate SKU
  if (db.items.some((i) => i.sku.toUpperCase() === sku)) {
    throw new Error(`An item with SKU "${sku}" already exists in the catalog.`);
  }

  const quantity = Math.max(0, Number(itemData.quantity) || 0);
  const minThreshold = Math.max(1, Number(itemData.minThreshold) || 10);
  const targetStock = Math.max(minThreshold, Number(itemData.targetStock) || minThreshold * 2);
  const unitCost = Math.max(0, Math.round((Number(itemData.unitCost) || 0) * 100) / 100);
  const unitPrice = Math.max(0, Math.round((Number(itemData.unitPrice) || 0) * 100) / 100);

  const status = calculateStockStatus(quantity, minThreshold);

  const newItem: InventoryItem = {
    id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    sku,
    name,
    category: itemData.category || 'General',
    warehouse: itemData.warehouse || 'Main Warehouse',
    quantity,
    minThreshold,
    targetStock,
    unitCost,
    unitPrice,
    supplier: {
      name: itemData.supplier?.name || 'Default Supplier',
      email: itemData.supplier?.email || 'vendor@example.com',
      phone: itemData.supplier?.phone || '',
      leadTimeDays: Math.max(1, Number(itemData.supplier?.leadTimeDays) || 3),
    },
    lastRestocked: new Date().toISOString().split('T')[0],
    isEssential: Boolean(itemData.isEssential),
    status,
    notes: itemData.notes || '',
  };

  db.items.unshift(newItem);
  saveDb(db);
  return newItem;
}

/**
 * Atomic stock count adjustment.
 * Prevents race conditions from client-side concurrent clicks.
 * Strictly clamps at 0 (never negative).
 */
export function adjustItemQuantity(
  itemId: string,
  options: { delta?: number; newQuantity?: number; reason?: string }
): { item: InventoryItem; autoPO?: PurchaseOrder } {
  const db = getDb();
  const itemIndex = db.items.findIndex((i) => i.id === itemId);

  if (itemIndex === -1) {
    throw new Error(`Inventory item "${itemId}" not found.`);
  }

  const currentItem = db.items[itemIndex];
  let updatedQuantity: number;

  if (typeof options.newQuantity === 'number') {
    updatedQuantity = Math.max(0, options.newQuantity);
  } else if (typeof options.delta === 'number') {
    updatedQuantity = Math.max(0, currentItem.quantity + options.delta);
  } else {
    throw new Error('Either delta or newQuantity must be provided for stock adjustment.');
  }

  const previousStatus = currentItem.status;
  const newStatus = calculateStockStatus(updatedQuantity, currentItem.minThreshold);

  const updatedItem: InventoryItem = {
    ...currentItem,
    quantity: updatedQuantity,
    status: newStatus,
  };

  db.items[itemIndex] = updatedItem;

  // Check if automation triggers an auto-PO
  let autoPO: PurchaseOrder | undefined = undefined;
  const wasHealthy = previousStatus === 'healthy';
  const isNowLowOrCritical = newStatus === 'low' || newStatus === 'critical';

  if (wasHealthy && isNowLowOrCritical && db.settings.autoTriggerOnLowStock) {
    const isEligible = !db.settings.autoTriggerOnlyEssential || updatedItem.isEssential;
    if (isEligible) {
      autoPO = internalGeneratePO(db, [updatedItem], true, 'Automated threshold trigger');
    }
  }

  saveDb(db);
  return { item: updatedItem, autoPO };
}

/**
 * Server-side atomic PO sequence number generator
 * Guarantees no duplicate PO numbers across concurrent sessions.
 */
export function generateNextPONumber(): string {
  const db = getDb();
  const year = new Date().getFullYear();
  db.poSequence += 1;
  const sequenceStr = String(db.poSequence).padStart(4, '0');
  saveDb(db);
  return `PO-${year}-${sequenceStr}`;
}

function internalGeneratePO(
  db: DatabaseSchema,
  itemsToOrder: InventoryItem[],
  autoGenerated: boolean,
  notes: string
): PurchaseOrder {
  const primarySupplier = itemsToOrder[0].supplier;

  const poItems: PurchaseOrderItem[] = itemsToOrder.map((item) => {
    // Formula: Needed quantity to reach target stock, with minimum threshold buffer
    const deficit = Math.max(0, item.targetStock - item.quantity);
    const orderQty = Math.max(deficit, Math.ceil(item.minThreshold * 1.2));
    const totalCost = Math.round(orderQty * item.unitCost * 100) / 100;

    return {
      itemId: item.id,
      sku: item.sku,
      name: item.name,
      currentQty: item.quantity,
      orderQty,
      unitCost: item.unitCost,
      totalCost,
      supplierName: item.supplier.name,
      supplierEmail: item.supplier.email,
    };
  });

  const totalAmount = Math.round(poItems.reduce((acc, curr) => acc + curr.totalCost, 0) * 100) / 100;
  const now = new Date();
  const formattedDate = `${now.toISOString().split('T')[0]} ${now.toTimeString().substring(0, 5)}`;

  db.poSequence += 1;
  const poNumber = `PO-${now.getFullYear()}-${String(db.poSequence).padStart(4, '0')}`;

  const newPO: PurchaseOrder = {
    id: `po-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    poNumber,
    createdAt: formattedDate,
    status: 'draft',
    items: poItems,
    totalAmount,
    supplierName: primarySupplier.name,
    supplierEmail: primarySupplier.email,
    recipientEmail: process.env.NOTIFICATION_RECIPIENT_EMAIL || 'procurement@company.com',
    notes,
    autoGenerated,
  };

  db.orders.unshift(newPO);
  return newPO;
}

export function getOrders(): PurchaseOrder[] {
  const db = getDb();
  return db.orders;
}

export function getOrderById(id: string): PurchaseOrder | undefined {
  const db = getDb();
  return db.orders.find((o) => o.id === id || o.poNumber === id);
}

export function createOrder(data: {
  items: Array<{
    itemId: string;
    sku: string;
    name: string;
    currentQty: number;
    orderQty: number;
    unitCost: number;
    supplierName?: string;
    supplierEmail?: string;
  }>;
  supplierName?: string;
  supplierEmail?: string;
  recipientEmail?: string;
  notes?: string;
  autoGenerated?: boolean;
}): PurchaseOrder {
  const db = getDb();

  if (!data.items || data.items.length === 0) {
    throw new Error('Purchase order must contain at least one line item.');
  }

  // Recalculate totals server-side using cents to prevent float drift
  const poItems: PurchaseOrderItem[] = data.items.map((item) => {
    const qty = Math.max(1, Number(item.orderQty) || 1);
    const cost = Math.max(0, Number(item.unitCost) || 0);
    const lineTotal = Math.round(qty * cost * 100) / 100;

    return {
      itemId: item.itemId,
      sku: item.sku,
      name: item.name,
      currentQty: item.currentQty,
      orderQty: qty,
      unitCost: cost,
      totalCost: lineTotal,
      supplierName: item.supplierName || data.supplierName || 'Default Supplier',
      supplierEmail: item.supplierEmail || data.supplierEmail || 'vendor@example.com',
    };
  });

  const totalAmount = Math.round(poItems.reduce((acc, curr) => acc + curr.totalCost, 0) * 100) / 100;

  const now = new Date();
  const formattedDate = `${now.toISOString().split('T')[0]} ${now.toTimeString().substring(0, 5)}`;
  db.poSequence += 1;
  const poNumber = `PO-${now.getFullYear()}-${String(db.poSequence).padStart(4, '0')}`;

  const newPO: PurchaseOrder = {
    id: `po-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    poNumber,
    createdAt: formattedDate,
    status: 'draft',
    items: poItems,
    totalAmount,
    supplierName: data.supplierName || poItems[0]?.supplierName || 'Supplier',
    supplierEmail: data.supplierEmail || poItems[0]?.supplierEmail || 'vendor@example.com',
    recipientEmail: data.recipientEmail || process.env.NOTIFICATION_RECIPIENT_EMAIL || 'procurement@company.com',
    notes: data.notes || 'Procurement purchase order.',
    autoGenerated: Boolean(data.autoGenerated),
  };

  db.orders.unshift(newPO);
  saveDb(db);
  return newPO;
}

export function updateOrderStatus(id: string, updates: Partial<PurchaseOrder>): PurchaseOrder {
  const db = getDb();
  const orderIdx = db.orders.findIndex((o) => o.id === id || o.poNumber === id);
  if (orderIdx === -1) {
    throw new Error(`Purchase order "${id}" not found.`);
  }

  const updated: PurchaseOrder = {
    ...db.orders[orderIdx],
    ...updates,
  };

  db.orders[orderIdx] = updated;
  saveDb(db);
  return updated;
}

/**
 * Receive & Restock Purchase Order
 * Supports full or partial fulfillment.
 * ADDS (does not overwrite) received units to on-hand inventory.
 */
export function receiveOrder(
  poId: string,
  options?: { receivedItems?: Array<{ itemId: string; receivedQty: number }> }
): { order: PurchaseOrder; restockedSummary: string } {
  const db = getDb();
  const orderIdx = db.orders.findIndex((o) => o.id === poId || o.poNumber === poId);
  if (orderIdx === -1) {
    throw new Error(`Purchase Order "${poId}" not found.`);
  }

  const order = db.orders[orderIdx];
  let totalUnitsReceived = 0;
  const restockedNames: string[] = [];

  for (const lineItem of order.items) {
    // Check if partial receipt quantity specified
    let qtyToAdd = lineItem.orderQty;
    if (options?.receivedItems) {
      const match = options.receivedItems.find((r) => r.itemId === lineItem.itemId);
      if (match && typeof match.receivedQty === 'number') {
        qtyToAdd = Math.max(0, match.receivedQty);
      }
    }

    if (qtyToAdd > 0) {
      const itemIdx = db.items.findIndex((i) => i.id === lineItem.itemId || i.sku === lineItem.sku);
      if (itemIdx >= 0) {
        const item = db.items[itemIdx];
        const newQuantity = item.quantity + qtyToAdd; // strictly ADDS to existing quantity
        const newStatus = calculateStockStatus(newQuantity, item.minThreshold);

        db.items[itemIdx] = {
          ...item,
          quantity: newQuantity,
          status: newStatus,
          lastRestocked: new Date().toISOString().split('T')[0],
        };

        totalUnitsReceived += qtyToAdd;
        restockedNames.push(`${item.name} (+${qtyToAdd})`);
      }
    }
  }

  // Update order status
  const updatedOrder: PurchaseOrder = {
    ...order,
    status: 'received',
  };

  db.orders[orderIdx] = updatedOrder;
  saveDb(db);

  return {
    order: updatedOrder,
    restockedSummary: `Restocked ${totalUnitsReceived} units across ${restockedNames.length} items.`,
  };
}

export function getSettings(): ZapierSettings {
  const db = getDb();
  return db.settings;
}

export function updateSettings(newSettings: Partial<ZapierSettings>): ZapierSettings {
  const db = getDb();
  db.settings = {
    ...db.settings,
    ...newSettings,
  };
  saveDb(db);
  return db.settings;
}

export function addWebhookLog(log: WebhookLog): WebhookLog {
  const db = getDb();
  db.logs.unshift(log);
  if (db.logs.length > 100) {
    db.logs.pop(); // Cap log length
  }
  saveDb(db);
  return log;
}

export function getWebhookLogs(): WebhookLog[] {
  const db = getDb();
  return db.logs;
}
