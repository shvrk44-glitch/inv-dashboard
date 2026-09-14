import { Resend } from 'resend';
import dotenv from 'dotenv';
import { PurchaseOrder, InventoryItem } from '../src/types';

dotenv.config();

let resendInstance: Resend | null = null;

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('MY_RESEND_API_KEY')) {
    return null;
  }

  if (!resendInstance) {
    try {
      resendInstance = new Resend(apiKey);
    } catch (err) {
      console.error('[Email] Failed to initialize Resend:', err);
      return null;
    }
  }

  return resendInstance;
}

export function isEmailConfigured(): boolean {
  const apiKey = process.env.RESEND_API_KEY;
  return Boolean(apiKey && apiKey.trim() !== '' && !apiKey.includes('MY_RESEND_API_KEY'));
}

export function generatePurchaseOrderHtml(po: PurchaseOrder): string {
  const itemsRows = po.items
    .map(
      (item) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 12px; font-weight: 500; font-family: monospace; font-size: 13px;">${item.sku}</td>
        <td style="padding: 10px 12px; font-size: 14px;">${item.name}</td>
        <td style="padding: 10px 12px; text-align: center; font-size: 14px;">${item.currentQty}</td>
        <td style="padding: 10px 12px; text-align: center; font-size: 14px; font-weight: bold; color: #2563eb;">${item.orderQty}</td>
        <td style="padding: 10px 12px; text-align: right; font-size: 14px;">$${item.unitCost.toFixed(2)}</td>
        <td style="padding: 10px 12px; text-align: right; font-size: 14px; font-weight: 600;">$${item.totalCost.toFixed(2)}</td>
      </tr>
    `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
        <div style="max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="background: #0f172a; padding: 24px 32px; color: #ffffff;">
            <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 4px;">Inventory Hub • Purchase Order</div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff;">${po.poNumber}</h1>
            <p style="margin: 6px 0 0 0; color: #cbd5e1; font-size: 14px;">Supplier: <strong>${po.supplierName}</strong> (${po.supplierEmail})</p>
          </div>

          <div style="padding: 32px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 24px; background: #f1f5f9; padding: 16px; border-radius: 8px;">
              <div>
                <span style="font-size: 11px; color: #64748b; text-transform: uppercase; display: block;">Issue Date</span>
                <strong style="font-size: 14px; color: #0f172a;">${po.createdAt}</strong>
              </div>
              <div>
                <span style="font-size: 11px; color: #64748b; text-transform: uppercase; display: block;">Status</span>
                <strong style="font-size: 14px; color: #0f172a; text-transform: capitalize;">${po.status.replace('_', ' ')}</strong>
              </div>
              <div>
                <span style="font-size: 11px; color: #64748b; text-transform: uppercase; display: block;">Total Amount</span>
                <strong style="font-size: 16px; color: #059669;">$${po.totalAmount.toLocaleString()} USD</strong>
              </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-top: 16px; text-align: left;">
              <thead>
                <tr style="background-color: #f8fafc; border-bottom: 2px solid #cbd5e1; font-size: 12px; text-transform: uppercase; color: #64748b;">
                  <th style="padding: 10px 12px;">SKU</th>
                  <th style="padding: 10px 12px;">Item Name</th>
                  <th style="padding: 10px 12px; text-align: center;">Stock</th>
                  <th style="padding: 10px 12px; text-align: center;">Order Qty</th>
                  <th style="padding: 10px 12px; text-align: right;">Unit Cost</th>
                  <th style="padding: 10px 12px; text-align: right;">Line Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows}
              </tbody>
            </table>

            ${po.notes ? `<div style="margin-top: 24px; padding: 12px 16px; background-color: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 4px; font-size: 13px; color: #92400e;"><strong>Notes:</strong> ${po.notes}</div>` : ''}

            <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center;">
              Dispatched automatically by Inventory Hub Procurement System.
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

export function generatePurchaseOrderPlainText(po: PurchaseOrder): string {
  const itemsText = po.items
    .map(
      (item) =>
        `- [${item.sku}] ${item.name} | Current: ${item.currentQty} -> Ordered: ${item.orderQty} units @ $${item.unitCost.toFixed(2)} = $${item.totalCost.toFixed(2)}`
    )
    .join('\n');

  return `[PURCHASE ORDER] ${po.poNumber}\n` +
    `Supplier: ${po.supplierName} (${po.supplierEmail})\n` +
    `Total Amount: $${po.totalAmount.toLocaleString()} USD\n` +
    `Date: ${po.createdAt}\n` +
    `Status: ${po.status}\n\n` +
    `ORDERED ITEMS:\n${itemsText}\n\n` +
    `Notes: ${po.notes || 'No special instructions'}\n\n` +
    `Automated dispatch by Inventory Hub Procurement System`;
}

export async function sendPurchaseOrderEmail(params: {
  po: PurchaseOrder;
  recipientEmail?: string;
}): Promise<{
  success: boolean;
  provider: 'resend' | 'simulated';
  id?: string;
  error?: string;
}> {
  const { po, recipientEmail } = params;
  // If a real environment recipient or explicitly passed recipient exists, use it
  const configuredEmail = process.env.NOTIFICATION_RECIPIENT_EMAIL;
  const targetEmail = recipientEmail || configuredEmail || po.recipientEmail || 'procurement@company.com';
  const resend = getResendClient();

  const subject = `[Purchase Order] ${po.poNumber} for ${po.supplierName} ($${po.totalAmount.toLocaleString()})`;
  const html = generatePurchaseOrderHtml(po);

  if (!resend) {
    console.log(`[Email Simulation] Would send PO email to ${targetEmail}: ${subject}`);
    return {
      success: true,
      provider: 'simulated',
      id: `sim_email_${Date.now()}`,
    };
  }

  try {
    const fromAddress = process.env.EMAIL_FROM || 'Inventory Hub <onboarding@resend.dev>';
    const data = await resend.emails.send({
      from: fromAddress,
      to: [targetEmail],
      subject,
      html,
    });

    if (data.error) {
      console.error('[Email Error] Resend returned error:', data.error);
      return {
        success: false,
        provider: 'resend',
        error: data.error.message,
      };
    }

    return {
      success: true,
      provider: 'resend',
      id: data.data?.id,
    };
  } catch (err: any) {
    console.error('[Email Error] Failed to send email via Resend:', err);
    return {
      success: false,
      provider: 'resend',
      error: err.message || 'Failed to dispatch email via Resend API',
    };
  }
}

export async function sendTestEmail(targetEmail: string): Promise<{
  success: boolean;
  provider: 'resend' | 'simulated';
  id?: string;
  error?: string;
  message: string;
}> {
  const resend = getResendClient();
  const recipient = targetEmail || process.env.NOTIFICATION_RECIPIENT_EMAIL || 'procurement@company.com';

  const subject = `[Inventory Hub Test Notification] System Connectivity Verified`;
  const html = `
    <div style="font-family: sans-serif; padding: 24px; color: #1e293b;">
      <h2 style="color: #2563eb;">Inventory Hub Email Notification Active</h2>
      <p>This is a verified test dispatch from your Inventory Hub system.</p>
      <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0; font-size: 14px;"><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <p style="margin: 8px 0 0 0; font-size: 14px;"><strong>Recipient:</strong> ${recipient}</p>
        <p style="margin: 8px 0 0 0; font-size: 14px;"><strong>Status:</strong> Connected & Operational</p>
      </div>
      <p style="font-size: 12px; color: #64748b;">Whenever critical inventory breaches or automated reorder purchase orders are generated, alerts will be dispatched directly to this inbox.</p>
    </div>
  `;

  if (!resend) {
    return {
      success: true,
      provider: 'simulated',
      id: `sim_${Date.now()}`,
      message: 'Simulation Mode: RESEND_API_KEY is not configured yet. Configure your RESEND_API_KEY in Settings to send live emails.',
    };
  }

  try {
    const fromAddress = process.env.EMAIL_FROM || 'Inventory Hub <onboarding@resend.dev>';
    const res = await resend.emails.send({
      from: fromAddress,
      to: [recipient],
      subject,
      html,
    });

    if (res.error) {
      return {
        success: false,
        provider: 'resend',
        error: res.error.message,
        message: `Resend error: ${res.error.message}`,
      };
    }

    return {
      success: true,
      provider: 'resend',
      id: res.data?.id,
      message: `Live email successfully delivered to ${recipient} via Resend (ID: ${res.data?.id}).`,
    };
  } catch (err: any) {
    return {
      success: false,
      provider: 'resend',
      error: err.message || 'Resend API call rejected',
      message: `Failed to deliver email: ${err.message}`,
    };
  }
}
