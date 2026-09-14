import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { InventoryItem, PurchaseOrder, WebhookLog } from '../src/types';

dotenv.config();

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    } catch (err) {
      console.error('[Supabase] Failed to initialize client:', err);
      return null;
    }
  }

  return supabaseInstance;
}

export function isSupabaseConfigured(): boolean {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  return Boolean(url && key && url.trim() !== '' && key.trim() !== '');
}

export async function testSupabaseConnection(): Promise<{
  connected: boolean;
  message: string;
  tables?: { items: boolean; orders: boolean; logs: boolean };
}> {
  const client = getSupabase();

  if (!client) {
    return {
      connected: false,
      message: 'Supabase credentials not configured in secure environment.',
    };
  }

  try {
    const [itemsCheck, ordersCheck, logsCheck] = await Promise.all([
      client.from('inventory_items').select('id').limit(1),
      client.from('purchase_orders').select('id').limit(1),
      client.from('notification_logs').select('id').limit(1),
    ]);

    const itemsOk = !itemsCheck.error;
    const ordersOk = !ordersCheck.error;
    const logsOk = !logsCheck.error;

    if (itemsOk && ordersOk) {
      return {
        connected: true,
        message: 'Successfully connected to private Supabase backend and verified schema tables.',
        tables: { items: itemsOk, orders: ordersOk, logs: logsOk },
      };
    } else {
      const missing = [];
      if (!itemsOk) missing.push('inventory_items');
      if (!ordersOk) missing.push('purchase_orders');
      if (!logsOk) missing.push('notification_logs');

      return {
        connected: true,
        message: `Connected securely to Supabase, but some tables need to be created in SQL editor: ${missing.join(', ')}`,
        tables: { items: itemsOk, orders: ordersOk, logs: logsOk },
      };
    }
  } catch (err: any) {
    return {
      connected: false,
      message: `Failed to connect to Supabase: ${err.message || 'Unknown network error'}`,
    };
  }
}

/**
 * Upsert inventory items to Supabase
 */
export async function syncItemsToSupabase(items: InventoryItem[]): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  try {
    const formatted = items.map((item) => ({
      id: item.id,
      sku: item.sku,
      name: item.name,
      category: item.category,
      warehouse: item.warehouse,
      quantity: item.quantity,
      min_threshold: item.minThreshold,
      target_stock: item.targetStock,
      unit_cost: item.unitCost,
      unit_price: item.unitPrice,
      supplier_name: item.supplier.name,
      supplier_email: item.supplier.email,
      supplier_phone: item.supplier.phone,
      supplier_lead_time_days: item.supplier.leadTimeDays,
      last_restocked: item.lastRestocked,
      is_essential: item.isEssential,
      status: item.status,
      notes: item.notes,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await client.from('inventory_items').upsert(formatted, { onConflict: 'id' });
    if (error) {
      console.error('[Supabase] Error syncing items:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] Exception syncing items:', err);
    return false;
  }
}

/**
 * Fetch inventory items from Supabase if table exists
 */
export async function fetchItemsFromSupabase(): Promise<InventoryItem[] | null> {
  const client = getSupabase();
  if (!client) return null;

  try {
    const { data, error } = await client.from('inventory_items').select('*').order('name');
    if (error || !data || data.length === 0) {
      return null;
    }

    return data.map((row: any) => ({
      id: row.id,
      sku: row.sku,
      name: row.name,
      category: row.category || 'General',
      warehouse: row.warehouse || 'Main Warehouse',
      quantity: Number(row.quantity) || 0,
      minThreshold: Number(row.min_threshold) || 10,
      targetStock: Number(row.target_stock) || 20,
      unitCost: Number(row.unit_cost) || 0,
      unitPrice: Number(row.unit_price) || 0,
      supplier: {
        name: row.supplier_name || 'Vendor',
        email: row.supplier_email || 'vendor@example.com',
        phone: row.supplier_phone || '',
        leadTimeDays: Number(row.supplier_lead_time_days) || 3,
      },
      lastRestocked: row.last_restocked || new Date().toISOString().split('T')[0],
      isEssential: Boolean(row.is_essential),
      status: row.status || 'healthy',
      notes: row.notes || '',
    }));
  } catch (err) {
    console.error('[Supabase] Exception fetching items:', err);
    return null;
  }
}

/**
 * Upsert purchase orders to Supabase
 */
export async function syncOrderToSupabase(po: PurchaseOrder): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  try {
    const { error } = await client.from('purchase_orders').upsert(
      {
        id: po.id,
        po_number: po.poNumber,
        status: po.status,
        supplier_name: po.supplierName,
        supplier_email: po.supplierEmail,
        recipient_email: po.recipientEmail,
        created_at: po.createdAt,
        total_amount: po.totalAmount,
        currency: 'USD',
        notes: po.notes,
        auto_generated: po.autoGenerated,
        items: po.items,
        zapier_status: po.zapierStatus,
        zapier_dispatched_at: po.zapierDispatchedAt,
        zapier_http_code: po.zapierHttpCode,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (error) {
      console.error('[Supabase] Error saving order:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] Exception saving order:', err);
    return false;
  }
}

/**
 * Log notifications/webhooks to Supabase
 */
export async function logNotificationToSupabase(log: WebhookLog): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  try {
    const { error } = await client.from('notification_logs').insert({
      id: log.id,
      timestamp: log.timestamp,
      po_number: log.poNumber,
      target_url: log.targetUrl,
      recipient_email: log.recipientEmail,
      status: log.status,
      http_code: log.httpCode,
      response_preview: log.responsePreview,
      payload: log.payload,
    });

    if (error) {
      console.error('[Supabase] Error logging notification:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] Exception logging notification:', err);
    return false;
  }
}
