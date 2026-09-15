import express from "express";
import path from "path";
import dotenv from "dotenv";
import {
  getItems,
  getItemById,
  addItem,
  adjustItemQuantity,
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  receiveOrder,
  getSettings,
  updateSettings,
  addWebhookLog,
  getWebhookLogs,
} from "./server/db";
import {
  isSupabaseConfigured,
  testSupabaseConnection,
  syncItemsToSupabase,
  syncOrderToSupabase,
  logNotificationToSupabase,
} from "./server/supabase";
import {
  isEmailConfigured,
  sendPurchaseOrderEmail,
  sendTestEmail,
  generatePurchaseOrderHtml,
  generatePurchaseOrderPlainText,
} from "./server/email";
import { QUARTERLY_TRENDS } from "./src/data/initialData";
import { WebhookLog, PurchaseOrder } from "./src/types";

dotenv.config();

/**
 * Dispatch helper with strict 8-second timeout and URL validation
 */
async function dispatchWebhook(
  targetUrl: string | undefined,
  recipientEmail: string,
  payload: any
): Promise<{
  success: boolean;
  mode: "live" | "simulation";
  httpStatus?: number;
  response?: any;
  error?: string;
  log: WebhookLog;
}> {
  const isSimulation =
    !targetUrl ||
    targetUrl.trim() === "" ||
    targetUrl.includes("example.com") ||
    targetUrl.includes("your-zapier-webhook-url");

  const logEntry: WebhookLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    poNumber: payload?.poNumber || "PO-UNKNOWN",
    targetUrl: targetUrl || "Simulation (No Webhook URL configured)",
    recipientEmail,
    status: isSimulation ? "simulated" : "success",
    payload,
  };

  if (isSimulation) {
    logEntry.status = "simulated";
    logEntry.httpCode = 200;
    logEntry.responsePreview =
      "Simulation mode: payload validated successfully. Configure live Zapier Catch Hook URL in settings to dispatch live notifications.";
    addWebhookLog(logEntry);

    return {
      success: true,
      mode: "simulation",
      httpStatus: 200,
      log: logEntry,
    };
  }

  // Security check: only allow https endpoints to prevent SSRF against internal/private network
  if (!targetUrl.startsWith("https://")) {
    logEntry.status = "failed";
    logEntry.httpCode = 400;
    logEntry.responsePreview = "Rejected: Webhook URL must use secure HTTPS protocol.";
    addWebhookLog(logEntry);

    return {
      success: false,
      mode: "live",
      httpStatus: 400,
      error: "Webhook URL must use secure HTTPS protocol.",
      log: logEntry,
    };
  }

  // 8-second timeout enforcement
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "InventoryHub-PO-Dispatcher/1.0",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();
    let parsed: any = responseText;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      // keep raw string
    }

    logEntry.status = response.ok ? "success" : "failed";
    logEntry.httpCode = response.status;
    logEntry.responsePreview =
      typeof parsed === "string" ? parsed.substring(0, 300) : JSON.stringify(parsed).substring(0, 300);

    addWebhookLog(logEntry);

    return {
      success: response.ok,
      mode: "live",
      httpStatus: response.status,
      response: parsed,
      log: logEntry,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);

    const isTimeout = err.name === "AbortError";
    const errorMessage = isTimeout
      ? "Zapier webhook connection timed out after 8,000ms"
      : err.message || "Network error contacting webhook endpoint";

    logEntry.status = "failed";
    logEntry.httpCode = isTimeout ? 504 : 502;
    logEntry.responsePreview = errorMessage;

    addWebhookLog(logEntry);

    return {
      success: false,
      mode: "live",
      httpStatus: isTimeout ? 504 : 502,
      error: errorMessage,
      log: logEntry,
    };
  }
}

export const app = express();
app.use(express.json());

async function startServer() {
  const PORT = 3000;

  // -------------------------------------------------------------
  // API ROUTES
  // -------------------------------------------------------------

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      storage: "durable_server_file_store",
      supabaseConfigured: isSupabaseConfigured(),
      emailConfigured: isEmailConfigured(),
    });
  });

  // 0. Supabase & Notification Integrations
  app.get("/api/supabase/status", async (_req, res) => {
    try {
      const status = await testSupabaseConnection();
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ connected: false, message: err.message });
    }
  });

  app.post("/api/supabase/sync", async (_req, res) => {
    try {
      if (!isSupabaseConfigured()) {
        return res.status(400).json({
          success: false,
          message: "Supabase credentials are not set. Add SUPABASE_URL and SUPABASE_ANON_KEY to your environment variables.",
        });
      }

      const items = getItems();
      const orders = getOrders();

      const [itemsSynced, ordersSynced] = await Promise.all([
        syncItemsToSupabase(items),
        Promise.all(orders.map((o) => syncOrderToSupabase(o))),
      ]);

      res.json({
        success: itemsSynced,
        itemsCount: items.length,
        ordersCount: orders.length,
        message: `Successfully synchronized ${items.length} items and ${orders.length} orders with Supabase.`,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  function maskEmail(email?: string): string {
    if (!email || !email.includes('@')) return 'Configured securely';
    const [local, domain] = email.split('@');
    if (local.length <= 2) return `${local[0]}*@${domain}`;
    return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
  }

  app.get("/api/notifications/status", (_req, res) => {
    const rawEmail = process.env.NOTIFICATION_RECIPIENT_EMAIL;
    const settings = getSettings();
    const activeWebhookUrl = settings.webhookUrl || process.env.ZAPIER_WEBHOOK_URL;
    const isZapierValid = Boolean(
      activeWebhookUrl &&
        activeWebhookUrl.trim() !== "" &&
        !activeWebhookUrl.includes("example.com") &&
        !activeWebhookUrl.includes("your-zapier-webhook-url")
    );

    res.json({
      emailConfigured: isEmailConfigured(),
      zapierConfigured: isZapierValid,
      recipientConfigured: Boolean(rawEmail && rawEmail.trim() !== ""),
      maskedRecipient: rawEmail ? maskEmail(rawEmail) : "Default system recipient",
      maskedWebhookUrl: activeWebhookUrl && isZapierValid
        ? activeWebhookUrl.substring(0, 30) + "..." + activeWebhookUrl.slice(-6)
        : undefined,
    });
  });

  app.post("/api/notifications/test", async (req, res) => {
    try {
      const recipient = req.body?.recipientEmail || process.env.NOTIFICATION_RECIPIENT_EMAIL || "procurement@company.com";
      const result = await sendTestEmail(recipient);

      // Log notification (with masked recipient to prevent exposure)
      const logEntry: WebhookLog = {
        id: `log_email_${Date.now()}`,
        timestamp: new Date().toISOString(),
        poNumber: "TEST-NOTIFICATION",
        targetUrl: result.provider === "resend" ? "https://api.resend.com/emails" : "Simulated Email Dispatch",
        recipientEmail: maskEmail(recipient),
        status: result.success ? "success" : "failed",
        httpCode: result.success ? 200 : 500,
        responsePreview: result.message || result.error || "Dispatched",
        payload: { test: true },
      };
      addWebhookLog(logEntry);
      logNotificationToSupabase(logEntry).catch(() => {});

      res.json({
        ...result,
        message: result.message ? result.message.replace(recipient, maskEmail(recipient)) : undefined,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 1. Inventory Items
  app.get("/api/items", (_req, res) => {
    try {
      const items = getItems();
      res.json({ items });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/items", async (req, res) => {
    try {
      const newItem = addItem(req.body);
      syncItemsToSupabase([newItem]).catch(() => {});
      res.status(201).json({ item: newItem });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Atomic quantity adjustment
  app.patch("/api/items/:id/adjust", async (req, res) => {
    try {
      const { id } = req.params;
      const { delta, newQuantity, reason } = req.body;
      const { item, autoPO } = adjustItemQuantity(id, { delta, newQuantity, reason });

      // Sync item adjustment to Supabase in background
      syncItemsToSupabase([item]).catch(() => {});

      let dispatchResult = null;
      if (autoPO) {
        // Sync auto-generated PO to Supabase
        syncOrderToSupabase(autoPO).catch(() => {});

        // Send email notification for auto-PO
        sendPurchaseOrderEmail({ po: autoPO }).catch((err) => {
          console.error('[Email] Failed to send auto-PO email:', err);
        });

        const settings = getSettings();
        if (settings.sendEmailCopy) {
          const emailSubject = `${settings.notificationPrefix} Stockout Warning: ${autoPO.poNumber} for ${autoPO.supplierName}`;
          const emailHtmlBody = generatePurchaseOrderHtml(autoPO);
          const emailTextBody = generatePurchaseOrderPlainText(autoPO);

          const payload = {
            event: "inventory.purchase_order.auto_triggered",
            source: "Inventory Hub Automated Threshold Rule",
            timestamp: new Date().toISOString(),
            recipientEmail: process.env.NOTIFICATION_RECIPIENT_EMAIL || "procurement@company.com",
            notificationTitle: emailSubject,
            emailSubject,
            emailHtmlBody,
            emailTextBody,
            poNumber: autoPO.poNumber,
            supplier: {
              name: autoPO.supplierName,
              email: autoPO.supplierEmail,
            },
            items: autoPO.items.map((i) => ({
              sku: i.sku,
              name: i.name,
              currentStock: i.currentQty,
              orderQuantity: i.orderQty,
              unitCost: i.unitCost,
              lineTotal: i.totalCost,
            })),
            totalAmount: autoPO.totalAmount,
            notes: autoPO.notes,
          };

          const targetWebhook = settings.webhookUrl || process.env.ZAPIER_WEBHOOK_URL;
          dispatchResult = await dispatchWebhook(
            targetWebhook,
            process.env.NOTIFICATION_RECIPIENT_EMAIL || "procurement@company.com",
            payload
          );

          updateOrderStatus(autoPO.id, {
            status: dispatchResult.success ? "dispatched_zapier" : "dispatch_failed",
            zapierDispatchedAt: new Date().toISOString().replace("T", " ").substring(0, 16),
            zapierStatus: dispatchResult.mode === "simulation" ? "simulated" : dispatchResult.success ? "success" : "failed",
            zapierHttpCode: dispatchResult.httpStatus || 200,
          });
        }
      }

      res.json({
        item,
        autoPO,
        dispatchResult,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 2. Purchase Orders
  app.get("/api/orders", (_req, res) => {
    try {
      const orders = getOrders();
      res.json({ orders });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/orders", (req, res) => {
    try {
      const newPO = createOrder(req.body);
      syncOrderToSupabase(newPO).catch(() => {});
      res.status(201).json({ order: newPO });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Dispatch PO to Zapier Webhook & Email
  app.post("/api/orders/:id/dispatch", async (req, res) => {
    try {
      const { id } = req.params;
      const order = getOrderById(id);
      if (!order) {
        return res.status(404).json({ error: `Purchase Order "${id}" not found.` });
      }

      const settings = getSettings();
      const recipientEmail = process.env.NOTIFICATION_RECIPIENT_EMAIL || order.recipientEmail || "procurement@company.com";

      // 1. Dispatch Email Notification (Resend or Simulation)
      const emailResult = await sendPurchaseOrderEmail({ po: order, recipientEmail }).catch((err) => ({
        success: false,
        provider: 'resend' as const,
        error: err.message,
      }));

      // 2. Dispatch Webhook (Zapier or Simulation)
      const emailSubject = `${settings.notificationPrefix} Reorder Request: ${order.poNumber} for ${order.supplierName} ($${order.totalAmount.toLocaleString()})`;
      const emailHtmlBody = generatePurchaseOrderHtml(order);
      const emailTextBody = generatePurchaseOrderPlainText(order);

      const payload = {
        event: "inventory.purchase_order.created",
        source: "Inventory Hub Automation",
        timestamp: new Date().toISOString(),
        recipientEmail,
        notificationTitle: emailSubject,
        emailSubject,
        emailHtmlBody,
        emailTextBody,
        poNumber: order.poNumber,
        supplier: {
          name: order.supplierName,
          email: order.supplierEmail,
        },
        items: order.items.map((i) => ({
          sku: i.sku,
          name: i.name,
          currentStock: i.currentQty,
          orderQuantity: i.orderQty,
          unitCost: i.unitCost,
          lineTotal: i.totalCost,
        })),
        totalAmount: order.totalAmount,
        currency: "USD",
        notes: order.notes,
        autoGenerated: order.autoGenerated,
      };

      const targetWebhook = settings.webhookUrl || process.env.ZAPIER_WEBHOOK_URL;
      const result = await dispatchWebhook(targetWebhook, recipientEmail, payload);

      // Note: PO is NEVER lost or deleted on dispatch failure!
      const updatedOrder = updateOrderStatus(order.id, {
        status: result.success ? "dispatched_zapier" : "dispatch_failed",
        zapierDispatchedAt: new Date().toISOString().replace("T", " ").substring(0, 16),
        zapierStatus: result.mode === "simulation" ? "simulated" : result.success ? "success" : "failed",
        zapierHttpCode: result.httpStatus || (result.success ? 200 : 502),
      });

      // Sync updated PO status to Supabase
      syncOrderToSupabase(updatedOrder).catch(() => {});

      res.json({
        success: result.success,
        mode: result.mode,
        order: updatedOrder,
        log: result.log,
        emailResult,
        error: result.error,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Receive & Restock Purchase Order
  app.post("/api/orders/:id/receive", (req, res) => {
    try {
      const { id } = req.params;
      const { receivedItems } = req.body;
      const result = receiveOrder(id, { receivedItems });
      const items = getItems(); // refreshed stock counts
      res.json({
        order: result.order,
        summary: result.restockedSummary,
        updatedItems: items,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 3. Settings & Webhook Diagnostics
  app.get("/api/zapier/settings", (_req, res) => {
    try {
      const settings = getSettings();
      res.json({ settings });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/zapier/settings", (req, res) => {
    try {
      const updated = updateSettings(req.body);
      res.json({ settings: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/zapier/test", async (req, res) => {
    try {
      const settings = getSettings();
      const targetUrl = req.body?.webhookUrl || settings.webhookUrl || process.env.ZAPIER_WEBHOOK_URL;
      const recipientEmail = process.env.NOTIFICATION_RECIPIENT_EMAIL || "procurement@company.com";

      const samplePO: PurchaseOrder = {
        id: "po-zapier-test",
        poNumber: "PO-ZAP-SAMPLE",
        status: "dispatched_zapier",
        supplierName: "Apex Semiconductor Direct",
        supplierEmail: "orders@apexsemiconductor.com",
        recipientEmail,
        createdAt: new Date().toISOString().replace("T", " ").substring(0, 16),
        totalAmount: 1250.00,
        notes: "Automated replenishment order triggered via Zapier Webhook integration.",
        autoGenerated: true,
        items: [
          {
            itemId: "item-1",
            sku: "STM32-CORE-V2",
            name: "STM32 Microcontroller Core Boards",
            currentQty: 4,
            orderQty: 25,
            unitCost: 35.00,
            totalCost: 875.00,
            supplierName: "Apex Semiconductor Direct",
            supplierEmail: "orders@apexsemiconductor.com",
          },
          {
            itemId: "item-2",
            sku: "LIPO-2500-3V7",
            name: "High-Drain 3.7V Lithium-Polymer Cells",
            currentQty: 8,
            orderQty: 25,
            unitCost: 15.00,
            totalCost: 375.00,
            supplierName: "Apex Semiconductor Direct",
            supplierEmail: "orders@apexsemiconductor.com",
          },
        ],
      };

      const emailHtmlBody = generatePurchaseOrderHtml(samplePO);
      const emailTextBody = generatePurchaseOrderPlainText(samplePO);
      const emailSubject = `${settings.notificationPrefix} Reorder Request: ${samplePO.poNumber} for ${samplePO.supplierName} ($1,250.00)`;

      const testPayload = {
        event: "inventory.purchase_order.created",
        source: "Inventory Hub Zapier Webhook Dispatcher",
        timestamp: new Date().toISOString(),
        recipientEmail,
        notificationTitle: emailSubject,
        emailSubject,
        emailHtmlBody,
        emailTextBody,
        poNumber: samplePO.poNumber,
        supplier: {
          name: samplePO.supplierName,
          email: samplePO.supplierEmail,
        },
        items: samplePO.items.map((i) => ({
          sku: i.sku,
          name: i.name,
          currentStock: i.currentQty,
          orderQuantity: i.orderQty,
          unitCost: i.unitCost,
          lineTotal: i.totalCost,
        })),
        totalAmount: samplePO.totalAmount,
        currency: "USD",
        notes: samplePO.notes,
        autoGenerated: true,
      };

      const result = await dispatchWebhook(targetUrl, recipientEmail, testPayload);

      // Log notification to Supabase in background
      if (result.log) {
        logNotificationToSupabase(result.log).catch(() => {});
      }

      res.json({
        ...result,
        log: result.log
          ? {
              ...result.log,
              recipientEmail: maskEmail(result.log.recipientEmail),
            }
          : undefined,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Direct send proxy (backwards-compatibility)
  app.post("/api/zapier/send", async (req, res) => {
    const { payload } = req.body;
    const target = process.env.ZAPIER_WEBHOOK_URL;
    const email = process.env.NOTIFICATION_RECIPIENT_EMAIL || "procurement@company.com";

    const result = await dispatchWebhook(target, email, payload);
    return res.json(result);
  });

  app.get("/api/zapier/logs", (_req, res) => {
    try {
      const logs = getWebhookLogs();
      res.json({ logs });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Quarterly Reports
  app.get("/api/reports", (_req, res) => {
    res.json({ reports: QUARTERLY_TRENDS });
  });

  // -------------------------------------------------------------
  // VITE DEV SERVER OR PRODUCTION STATIC SERVE
  // -------------------------------------------------------------
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[Inventory Hub] Production server running on http://0.0.0.0:${PORT}`);
    });
  }
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
