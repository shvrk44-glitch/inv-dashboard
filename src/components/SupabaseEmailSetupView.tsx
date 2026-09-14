import { useState, useEffect } from 'react';
import {
  Database,
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Zap,
  Server,
  Key,
  Info,
  Smartphone,
  Eye,
  Code,
} from 'lucide-react';

interface SupabaseEmailSetupViewProps {
  onShowToast: (type: 'success' | 'alert' | 'info', title: string, message: string) => void;
}

interface TestDispatchResult {
  timestamp: string;
  mode: 'live' | 'simulation';
  httpStatus: number;
  poNumber: string;
  targetUrl: string;
  recipientEmail: string;
  responsePreview?: string;
  payload?: any;
}

export function SupabaseEmailSetupView({ onShowToast }: SupabaseEmailSetupViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'zapier' | 'supabase' | 'direct_email'>('zapier');

  const [supabaseStatus, setSupabaseStatus] = useState<{
    loading: boolean;
    connected: boolean;
    message: string;
    url?: string;
    tables?: { items: boolean; orders: boolean; logs: boolean };
  }>({
    loading: true,
    connected: false,
    message: 'Checking connection...',
  });

  const [emailStatus, setEmailStatus] = useState<{
    emailConfigured: boolean;
    zapierConfigured: boolean;
    recipientConfigured: boolean;
    maskedRecipient: string;
    maskedWebhookUrl?: string;
  }>({
    emailConfigured: false,
    zapierConfigured: false,
    recipientConfigured: false,
    maskedRecipient: 'Configured on Server',
  });

  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testZapierLoading, setTestZapierLoading] = useState(false);
  const [saveWebhookLoading, setSaveWebhookLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [copiedSQL, setCopiedSQL] = useState(false);
  const [copiedSampleJson, setCopiedSampleJson] = useState(false);
  const [copiedPayloadJson, setCopiedPayloadJson] = useState(false);
  const [customRecipient, setCustomRecipient] = useState('');
  const [zapierWebhookInput, setZapierWebhookInput] = useState('');
  const [showEmailHtmlPreview, setShowEmailHtmlPreview] = useState(true);
  const [showRawPayload, setShowRawPayload] = useState(false);
  const [lastTestResult, setLastTestResult] = useState<TestDispatchResult | null>(null);

  const sqlSchemaScript = `-- Run this in your Supabase Dashboard -> SQL Editor:
-- 1. Create Inventory Items table
CREATE TABLE IF NOT EXISTS inventory_items (
  id TEXT PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  warehouse TEXT DEFAULT 'Main Warehouse',
  quantity INTEGER NOT NULL DEFAULT 0,
  min_threshold INTEGER NOT NULL DEFAULT 10,
  target_stock INTEGER NOT NULL DEFAULT 20,
  unit_cost NUMERIC(10,2) DEFAULT 0.00,
  unit_price NUMERIC(10,2) DEFAULT 0.00,
  supplier_name TEXT,
  supplier_email TEXT,
  supplier_phone TEXT,
  supplier_lead_time_days INTEGER DEFAULT 3,
  last_restocked TEXT,
  is_essential BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'healthy',
  notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Purchase Orders table
CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  po_number TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  supplier_email TEXT,
  recipient_email TEXT,
  created_at TEXT NOT NULL,
  expected_delivery TEXT,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  currency TEXT DEFAULT 'USD',
  notes TEXT,
  auto_generated BOOLEAN DEFAULT FALSE,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  zapier_status TEXT,
  zapier_dispatched_at TEXT,
  zapier_http_code INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Notification & Webhook Logs table
CREATE TABLE IF NOT EXISTS notification_logs (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  po_number TEXT,
  target_url TEXT,
  recipient_email TEXT,
  status TEXT,
  http_code INTEGER,
  response_preview TEXT,
  payload JSONB
);

-- Enable Row Level Security (Optional: public anon access for prototype)
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read-write for inventory" ON inventory_items FOR ALL USING (true);
CREATE POLICY "Allow public read-write for orders" ON purchase_orders FOR ALL USING (true);
CREATE POLICY "Allow public read-write for logs" ON notification_logs FOR ALL USING (true);`;

  const fetchStatuses = async () => {
    setSupabaseStatus((prev) => ({ ...prev, loading: true }));
    try {
      const [supaRes, notifRes, settingsRes] = await Promise.all([
        fetch('/api/supabase/status'),
        fetch('/api/notifications/status'),
        fetch('/api/zapier/settings'),
      ]);

      if (supaRes.ok) {
        const supaData = await supaRes.json();
        setSupabaseStatus({
          loading: false,
          connected: supaData.connected,
          message: supaData.message,
          url: supaData.url,
          tables: supaData.tables,
        });
      } else {
        setSupabaseStatus({
          loading: false,
          connected: false,
          message: 'Could not contact server API endpoint.',
        });
      }

      if (notifRes.ok) {
        const notifData = await notifRes.json();
        setEmailStatus(notifData);
      }

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        if (settingsData?.settings?.webhookUrl) {
          setZapierWebhookInput((prev) => prev || settingsData.settings.webhookUrl);
        }
      }
    } catch (err: any) {
      setSupabaseStatus({
        loading: false,
        connected: false,
        message: err.message || 'Error checking status',
      });
    }
  };

  useEffect(() => {
    fetchStatuses();
  }, []);

  const handleCopySQL = () => {
    navigator.clipboard.writeText(sqlSchemaScript);
    setCopiedSQL(true);
    onShowToast('success', 'SQL Copied', 'Supabase SQL script copied to clipboard.');
    setTimeout(() => setCopiedSQL(false), 3000);
  };

  const handleSyncToSupabase = async () => {
    setSyncLoading(true);
    try {
      const res = await fetch('/api/supabase/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        onShowToast('success', 'Supabase Synchronized', data.message);
        fetchStatuses();
      } else {
        onShowToast('alert', 'Sync Failed', data.message || 'Check your Supabase credentials.');
      }
    } catch (err: any) {
      onShowToast('alert', 'Sync Error', err.message);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleSendTestEmail = async () => {
    setTestEmailLoading(true);
    try {
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientEmail: customRecipient }),
      });
      const data = await res.json();

      if (data.success) {
        onShowToast(
          'success',
          'Notification Sent',
          data.provider === 'resend'
            ? `Live email delivered via Resend!`
            : `Simulation test completed: email payload generated.`
        );
      } else {
        onShowToast('alert', 'Email Failed', data.error || 'Failed to dispatch email.');
      }
    } catch (err: any) {
      onShowToast('alert', 'Dispatch Error', err.message);
    } finally {
      setTestEmailLoading(false);
    }
  };

  const handleSendTestZapier = async () => {
    setTestZapierLoading(true);
    try {
      const res = await fetch('/api/zapier/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: zapierWebhookInput.trim() || undefined }),
      });
      const data = await res.json();

      if (data.success) {
        const resultInfo: TestDispatchResult = {
          timestamp: new Date().toLocaleTimeString(),
          mode: data.mode,
          httpStatus: data.httpStatus || 200,
          poNumber: data.log?.poNumber || 'PO-ZAP-SAMPLE',
          targetUrl: zapierWebhookInput.trim() ? emailStatus.maskedWebhookUrl || zapierWebhookInput.trim() : 'Simulation Mode',
          recipientEmail: emailStatus.maskedRecipient,
          responsePreview: data.responsePreview,
          payload: data.log?.payload,
        };
        setLastTestResult(resultInfo);

        onShowToast(
          'success',
          data.mode === 'live' ? 'Zapier Hook Received (200 OK)' : 'Zapier Simulation Validated',
          data.mode === 'live'
            ? 'Live payload with HTML email body delivered to your Zapier Catch Hook!'
            : 'Simulated payload generated with HTML email. Paste your live Catch Hook URL for real delivery.'
        );
        fetchStatuses();
      } else {
        onShowToast('alert', 'Zapier Webhook Failed', data.error || 'Failed to reach webhook URL.');
      }
    } catch (err: any) {
      onShowToast('alert', 'Webhook Error', err.message);
    } finally {
      setTestZapierLoading(false);
    }
  };

  const handleSaveWebhookUrl = async () => {
    if (!zapierWebhookInput.trim().startsWith('https://')) {
      onShowToast('alert', 'Invalid URL', 'Zapier Catch Hook URL must start with https://');
      return;
    }
    setSaveWebhookLoading(true);
    try {
      const res = await fetch('/api/zapier/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: zapierWebhookInput.trim() }),
      });
      if (res.ok) {
        onShowToast('success', 'Webhook Saved', 'Zapier Webhook Catch Hook URL saved securely on server!');
        fetchStatuses();
      } else {
        onShowToast('alert', 'Save Failed', 'Could not update webhook URL');
      }
    } catch (err: any) {
      onShowToast('alert', 'Save Error', err.message);
    } finally {
      setSaveWebhookLoading(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim().startsWith('https://')) {
          setZapierWebhookInput(text.trim());
          onShowToast('success', 'URL Pasted', 'Zapier Catch Hook URL pasted from clipboard!');
          return;
        }
      }
    } catch (e) {
      // ignore
    }
    const entered = window.prompt('Paste your Zapier Catch Hook URL (https://hooks.zapier.com/hooks/catch/...):');
    if (entered && entered.trim()) {
      setZapierWebhookInput(entered.trim());
      onShowToast('success', 'URL Pasted', 'Zapier Catch Hook URL entered!');
    }
  };

  const sampleZapierPayload = {
    event: "inventory.purchase_order.created",
    timestamp: "2026-09-14T11:15:00.000Z",
    notificationTitle: "[INVENTORY ALERT & PO REORDER] Reorder Request: PO-ZAP-SAMPLE for Apex Semiconductor Direct ($1,250.00)",
    emailSubject: "[INVENTORY ALERT & PO REORDER] Reorder Request: PO-ZAP-SAMPLE for Apex Semiconductor Direct ($1,250.00)",
    emailHtmlBody: "<!DOCTYPE html><html><body><h1>Purchase Order PO-ZAP-SAMPLE</h1>...<table>...</table></body></html>",
    emailTextBody: "[PURCHASE ORDER] PO-ZAP-SAMPLE\nSupplier: Apex Semiconductor Direct...",
    recipientEmail: "Protected server-side (your email)",
    poNumber: "PO-ZAP-SAMPLE",
    supplier: {
      name: "Apex Semiconductor Direct",
      email: "orders@apexsemiconductor.com"
    },
    totalAmount: 1250.00,
    currency: "USD",
    items: [
      { sku: "STM32-CORE-V2", name: "STM32 Microcontroller Core Boards", currentStock: 4, orderQuantity: 25, unitCost: 35.00, lineTotal: 875.00 },
      { sku: "LIPO-2500-3V7", name: "High-Drain 3.7V Lithium-Polymer Cells", currentStock: 8, orderQuantity: 25, unitCost: 15.00, lineTotal: 375.00 }
    ]
  };

  const handleCopySampleJson = () => {
    navigator.clipboard.writeText(JSON.stringify(sampleZapierPayload, null, 2));
    setCopiedSampleJson(true);
    setTimeout(() => setCopiedSampleJson(false), 2500);
    onShowToast('success', 'Copied Payload', 'Sample Zapier webhook JSON copied to clipboard.');
  };

  const handleCopyLastPayload = () => {
    if (lastTestResult?.payload) {
      navigator.clipboard.writeText(JSON.stringify(lastTestResult.payload, null, 2));
      setCopiedPayloadJson(true);
      setTimeout(() => setCopiedPayloadJson(false), 2500);
      onShowToast('success', 'Copied', 'Dispatched payload JSON copied!');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card with Mobile Tabs */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Zap className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Automations &amp; Notification Integrations
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                  <Smartphone className="w-3 h-3" />
                  Mobile-Ready
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Dispatch automated HTML purchase order emails via Zapier Catch Hook or connect Supabase for cloud sync.
              </p>
            </div>
          </div>

          <button
            onClick={fetchStatuses}
            disabled={supabaseStatus.loading}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer transition-colors shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${supabaseStatus.loading ? 'animate-spin' : ''}`} />
            <span>Refresh Status</span>
          </button>
        </div>

        {/* Mobile-Friendly Sub-Navigation Tabs */}
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 overflow-x-auto">
          <button
            id="tab-sub-zapier"
            onClick={() => setActiveSubTab('zapier')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer min-h-[40px] ${
              activeSubTab === 'zapier'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>⚡ Zapier Webhook (Email)</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </button>

          <button
            id="tab-sub-supabase"
            onClick={() => setActiveSubTab('supabase')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer min-h-[40px] ${
              activeSubTab === 'supabase'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>🗄️ Supabase Cloud DB</span>
          </button>

          <button
            id="tab-sub-direct-email"
            onClick={() => setActiveSubTab('direct_email')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer min-h-[40px] ${
              activeSubTab === 'direct_email'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>✉️ Direct Resend API</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: ZAPIER WEBHOOK & PHONE TESTING (PRIMARY) */}
      {activeSubTab === 'zapier' && (
        <div className="space-y-6">
          {/* Main Zapier Phone Testing Card */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border-2 border-amber-500/50 dark:border-amber-500/40 p-4 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Zapier Email Webhook Dispatcher</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Test live webhook delivery directly from your phone screen
                  </p>
                </div>
              </div>

              <span
                className={`self-start sm:self-center text-xs px-2.5 py-1 rounded-full font-bold border ${
                  emailStatus.zapierConfigured
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                    : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
                }`}
              >
                {emailStatus.zapierConfigured ? '🟢 Live Catch Hook Connected' : '🟡 Simulation Mode (Ready)'}
              </span>
            </div>

            {/* Recipient Protection Banner */}
            <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-xs text-slate-700 dark:text-slate-300">
                  Target Recipient Email: <strong className="font-mono text-slate-900 dark:text-white">{emailStatus.maskedRecipient}</strong>
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Injected server-side into webhook payload
              </span>
            </div>

            {/* Webhook URL Input with Mobile-Friendly Paste Button */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span>Zapier Catch Hook URL</span>
                  <span className="text-[11px] font-normal text-slate-500">(from your Zap)</span>
                </label>
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer py-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>Paste from Phone Clipboard</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  value={zapierWebhookInput}
                  onChange={(e) => setZapierWebhookInput(e.target.value)}
                  placeholder="https://hooks.zapier.com/hooks/catch/..."
                  className="flex-1 px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none min-h-[44px]"
                />
                <button
                  type="button"
                  onClick={handleSaveWebhookUrl}
                  disabled={saveWebhookLoading || !zapierWebhookInput.trim()}
                  className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-black dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-40 shrink-0 min-h-[44px]"
                >
                  {saveWebhookLoading ? 'Saving...' : 'Save URL'}
                </button>
              </div>

              {emailStatus.maskedWebhookUrl && (
                <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1.5 truncate">
                  Saved on server: {emailStatus.maskedWebhookUrl}
                </p>
              )}
            </div>

            {/* BIG MOBILE-FRIENDLY DISPATCH BUTTONS */}
            <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                id="btn-dispatch-zapier-test"
                onClick={handleSendTestZapier}
                disabled={testZapierLoading}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm transition-all shadow-md shadow-amber-500/20 active:scale-[0.98] cursor-pointer disabled:opacity-50 min-h-[48px]"
              >
                <Send className={`w-4 h-4 ${testZapierLoading ? 'animate-spin' : ''}`} />
                <span>
                  {testZapierLoading
                    ? 'Dispatching Webhook...'
                    : zapierWebhookInput.trim()
                    ? '⚡ Dispatch Live Test to Zapier'
                    : '⚡ Dispatch Test in Simulation Mode'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleCopySampleJson}
                className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold cursor-pointer transition-colors min-h-[44px]"
                title="Copy sample JSON payload for mapping in Zapier"
              >
                {copiedSampleJson ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                <span>{copiedSampleJson ? 'Copied to Clipboard' : 'Copy Sample JSON'}</span>
              </button>
            </div>

            {/* LIVE DISPATCH RESULT INSPECTOR */}
            {lastTestResult && (
              <div className="mt-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                    <strong className="text-slate-900 dark:text-white font-bold text-sm">
                      Latest Test Result ({lastTestResult.timestamp})
                    </strong>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                      lastTestResult.mode === 'live'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                        : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
                    }`}
                  >
                    {lastTestResult.mode === 'live'
                      ? `🟢 HTTP ${lastTestResult.httpStatus} OK — Delivered to Zapier`
                      : '🟡 Validated Simulation Mode'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div>• PO Number: <strong>{lastTestResult.poNumber}</strong></div>
                  <div>• Recipient: <strong>{lastTestResult.recipientEmail}</strong></div>
                  <div className="col-span-1 sm:col-span-2 truncate">
                    • Target: <strong>{lastTestResult.targetUrl}</strong>
                  </div>
                  {lastTestResult.responsePreview && (
                    <div className="col-span-1 sm:col-span-2 text-slate-600 dark:text-slate-400 break-words">
                      • Response: <em>{lastTestResult.responsePreview}</em>
                    </div>
                  )}
                </div>

                {/* Toggle between rendered email preview & raw JSON */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEmailHtmlPreview(true);
                      setShowRawPayload(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      showEmailHtmlPreview && !showRawPayload
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5 inline mr-1" />
                    <span>View Rendered Email</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowRawPayload(true);
                      setShowEmailHtmlPreview(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      showRawPayload
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Code className="w-3.5 h-3.5 inline mr-1" />
                    <span>View JSON Payload</span>
                  </button>
                </div>

                {/* Rendered Email Preview (Responsive Container) */}
                {showEmailHtmlPreview && !showRawPayload && (
                  <div className="mt-3 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-inner">
                    <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-2 pb-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <span>📱 Phone Email Preview (HTML Rendered)</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">Ready for Inbox</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="bg-slate-100 dark:bg-slate-800 p-2.5 rounded-lg text-slate-800 dark:text-slate-200 space-y-1 text-[11px]">
                        <div><strong>From:</strong> Inventory Hub Procurement &lt;procurement@company.com&gt;</div>
                        <div><strong>To:</strong> {lastTestResult.recipientEmail}</div>
                        <div><strong>Subject:</strong> {lastTestResult.payload?.emailSubject || `[INVENTORY ALERT & PO REORDER] Reorder Request: ${lastTestResult.poNumber}`}</div>
                      </div>

                      {/* Mock Rendered PO Table */}
                      <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden mt-3">
                        <div className="bg-slate-900 text-white p-3">
                          <div className="text-[10px] uppercase tracking-wider text-slate-400">Automated Reorder Purchase Order</div>
                          <div className="text-sm font-bold">{lastTestResult.poNumber}</div>
                          <div className="text-[11px] text-slate-300">Supplier: Apex Semiconductor Direct (orders@apexsemiconductor.com)</div>
                        </div>

                        <div className="p-3 bg-white dark:bg-slate-950 overflow-x-auto">
                          <table className="w-full text-[11px] text-left">
                            <thead>
                              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                                <th className="pb-1.5">SKU / Item</th>
                                <th className="pb-1.5 text-center">Stock</th>
                                <th className="pb-1.5 text-center">Order Qty</th>
                                <th className="pb-1.5 text-right">Line Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                              <tr>
                                <td className="py-2">
                                  <div className="font-mono font-bold">STM32-CORE-V2</div>
                                  <div className="text-slate-500 text-[10px]">STM32 Microcontroller Core Boards</div>
                                </td>
                                <td className="py-2 text-center text-red-500 font-bold">4</td>
                                <td className="py-2 text-center font-bold text-blue-600">25</td>
                                <td className="py-2 text-right font-bold">$875.00</td>
                              </tr>
                              <tr>
                                <td className="py-2">
                                  <div className="font-mono font-bold">LIPO-2500-3V7</div>
                                  <div className="text-slate-500 text-[10px]">High-Drain 3.7V Lithium-Polymer Cells</div>
                                </td>
                                <td className="py-2 text-center text-amber-500 font-bold">8</td>
                                <td className="py-2 text-center font-bold text-blue-600">25</td>
                                <td className="py-2 text-right font-bold">$375.00</td>
                              </tr>
                            </tbody>
                            <tfoot>
                              <tr className="border-t-2 border-slate-200 dark:border-slate-800 font-bold">
                                <td colSpan={3} className="pt-2 text-right">Total Order Balance:</td>
                                <td className="pt-2 text-right text-emerald-600 dark:text-emerald-400 font-extrabold text-xs">$1,250.00</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Raw JSON viewer */}
                {showRawPayload && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-mono text-slate-500">Payload JSON:</span>
                      <button
                        type="button"
                        onClick={handleCopyLastPayload}
                        className="text-[11px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {copiedPayloadJson ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedPayloadJson ? 'Copied' : 'Copy JSON'}</span>
                      </button>
                    </div>
                    <pre className="p-3 rounded-lg bg-slate-950 text-slate-300 font-mono text-[10px] overflow-x-auto max-h-60 border border-slate-800">
                      <code>{JSON.stringify(lastTestResult.payload || sampleZapierPayload, null, 2)}</code>
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3-Step Phone Setup Guide */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 shadow-xs">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
              <Smartphone className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
              <span>How to Set Up in Zapier on Your Phone in 3 Minutes</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
                <div className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 text-xs font-black flex items-center justify-center mb-2">
                  1
                </div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Create Zap Trigger
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  In Zapier, tap <strong>Create Zap</strong>. Select <strong>Webhooks by Zapier</strong> and event <strong>Catch Hook</strong>.
                </p>
                <div className="mt-2 text-[11px] font-mono bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                  Copy the Catch Hook URL
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
                <div className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 text-xs font-black flex items-center justify-center mb-2">
                  2
                </div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Dispatch Test from Phone
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Paste the URL in the box above and tap <strong>"Dispatch Live Test to Zapier"</strong>.
                </p>
                <div className="mt-2 text-[11px] font-mono bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                  Zapier receives HTML email fields
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
                <div className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 text-xs font-black flex items-center justify-center mb-2">
                  3
                </div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Add Gmail Action
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  In Zapier, add action <strong>Gmail → Send Email</strong> and map:
                </p>
                <div className="mt-2 text-[11px] font-mono bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 space-y-1">
                  <div>• To: <span className="text-amber-600 dark:text-amber-400">1. recipientEmail</span></div>
                  <div>• Subject: <span className="text-amber-600 dark:text-amber-400">1. emailSubject</span></div>
                  <div>• Body (HTML): <span className="text-amber-600 dark:text-amber-400">1. emailHtmlBody</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: SUPABASE DATABASE */}
      {activeSubTab === 'supabase' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Supabase Cloud Database</h3>
              </div>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
                  supabaseStatus.connected
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                    : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
                }`}
              >
                {supabaseStatus.connected ? 'Connected' : 'Credentials Awaiting'}
              </span>
            </div>

            <div className="mt-4 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300">
              <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Connection Diagnostics:</div>
              <p className="leading-relaxed">{supabaseStatus.message}</p>
              {supabaseStatus.url && (
                <p className="mt-1.5 font-mono text-[11px] text-slate-500 truncate">
                  Endpoint: {supabaseStatus.url}
                </p>
              )}
            </div>

            {/* Table Indicators */}
            {supabaseStatus.tables && (
              <div className="mt-4 space-y-2">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">Database Tables:</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="p-2 rounded border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="font-mono text-[11px]">inventory_items</span>
                    {supabaseStatus.tables.items ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                    )}
                  </div>
                  <div className="p-2 rounded border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="font-mono text-[11px]">purchase_orders</span>
                    {supabaseStatus.tables.orders ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                    )}
                  </div>
                  <div className="p-2 rounded border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="font-mono text-[11px]">notification_logs</span>
                    {supabaseStatus.tables.logs ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleSyncToSupabase}
                disabled={syncLoading || !supabaseStatus.connected}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncLoading ? 'animate-spin' : ''}`} />
                <span>{syncLoading ? 'Syncing...' : 'Sync Catalog to Supabase'}</span>
              </button>
            </div>
          </div>

          {/* SQL Script Accordion / Box */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-500" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Supabase Schema SQL Script</h4>
              </div>
              <button
                type="button"
                onClick={handleCopySQL}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
              >
                {copiedSQL ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSQL ? 'Copied!' : 'Copy SQL'}</span>
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-slate-950 text-slate-300 font-mono text-xs overflow-x-auto border border-slate-800 max-h-72">
              <code>{sqlSchemaScript}</code>
            </pre>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: DIRECT RESEND EMAIL (ALTERNATIVE) */}
      {activeSubTab === 'direct_email' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Direct Resend API Email</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Send emails directly from the server without intermediate webhooks
                  </p>
                </div>
              </div>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
                  emailStatus.emailConfigured
                    ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800'
                    : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                }`}
              >
                {emailStatus.emailConfigured ? 'Resend Key Configured' : 'Simulation Mode'}
              </span>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <div className="font-semibold text-slate-700 dark:text-slate-300">Recipient Email:</div>
                <div className="font-mono text-slate-900 dark:text-white font-bold mt-1">
                  {emailStatus.maskedRecipient}
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Test Recipient Override (Optional):
                </label>
                <input
                  type="email"
                  value={customRecipient}
                  onChange={(e) => setCustomRecipient(e.target.value)}
                  placeholder="Leave empty to use configured secure recipient"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSendTestEmail}
                  disabled={testEmailLoading}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Send className={`w-3.5 h-3.5 ${testEmailLoading ? 'animate-pulse' : ''}`} />
                  <span>{testEmailLoading ? 'Dispatching Direct Email...' : 'Dispatch Direct Test Email'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
