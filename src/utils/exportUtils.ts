import { QuarterlyTrendReport, InventoryItem, PurchaseOrder } from '../types';

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportQuarterlyCSV(report: QuarterlyTrendReport) {
  const rows: string[] = [];

  // Metadata headers
  rows.push(`Quarterly Inventory & Sales Trends Report - ${report.quarter}`);
  rows.push(`Period: ${report.periodLabel}`);
  rows.push(`Exported On: ${new Date().toISOString()}`);
  rows.push('');

  // Key KPI Summary
  rows.push('--- EXECUTIVE SUMMARY ---');
  rows.push('Metric,Value');
  rows.push(`Gross Revenue,$${report.totalRevenue.toLocaleString()}`);
  rows.push(`Cost of Goods Sold (COGS),$${report.cogs.toLocaleString()}`);
  rows.push(`Gross Profit,$${report.grossProfit.toLocaleString()}`);
  rows.push(`Gross Margin,${report.profitMarginPercent}%`);
  rows.push(`Total Units Sold,${report.unitsSold.toLocaleString()}`);
  rows.push(`Inventory Turnover Rate,${report.inventoryTurnoverRate}x`);
  rows.push(`Estimated Carrying Cost,$${report.carryingCostEstimate.toLocaleString()}`);
  rows.push(`Quarter-over-Quarter Growth,+${report.growthComparedToPreviousQ}%`);
  rows.push('');

  // Category Breakdown
  rows.push('--- CATEGORY PERFORMANCE ---');
  rows.push('Category,Revenue ($),Units Sold,Gross Profit ($),Profit Margin (%)');
  report.categoryBreakdown.forEach((cat) => {
    const margin = ((cat.profit / cat.revenue) * 100).toFixed(1);
    rows.push(`"${cat.category}",${cat.revenue},${cat.units},${cat.profit},${margin}%`);
  });
  rows.push('');

  // Top Performing Items
  rows.push('--- TOP PERFORMING ITEMS ---');
  rows.push('SKU,Item Name,Revenue ($),Units Sold');
  report.topPerformingItems.forEach((item) => {
    rows.push(`"${item.sku}","${item.name.replace(/"/g, '""')}",${item.revenue},${item.units}`);
  });
  rows.push('');

  // Monthly Breakdown
  rows.push('--- MONTHLY BREAKDOWN ---');
  rows.push('Month,Revenue ($),Cost ($),Gross Profit ($),Units Sold');
  report.monthlyBreakdown.forEach((m) => {
    rows.push(`"${m.month}",${m.revenue},${m.cost},${m.profit},${m.units}`);
  });

  const csvContent = rows.join('\r\n');
  const filename = `Sales_Trend_Report_${report.quarter.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.csv`;
  downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
}

export function exportQuarterlyJSON(report: QuarterlyTrendReport) {
  const jsonString = JSON.stringify(
    {
      reportTitle: `Quarterly Inventory & Sales Trends Report - ${report.quarter}`,
      generatedAt: new Date().toISOString(),
      reportData: report,
    },
    null,
    2
  );
  const filename = `Sales_Trend_Report_${report.quarter.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
  downloadFile(jsonString, filename, 'application/json');
}

export function exportInventoryCSV(items: InventoryItem[]) {
  const rows: string[] = [];
  rows.push('SKU,Item Name,Category,Warehouse,Current Quantity,Min Threshold,Target Stock,Status,Unit Cost ($),Unit Price ($),Total Asset Value ($),Essential Item,Supplier Name,Supplier Email');

  items.forEach((item) => {
    const totalAssetVal = (item.quantity * item.unitCost).toFixed(2);
    rows.push(
      `"${item.sku}","${item.name.replace(/"/g, '""')}","${item.category}","${item.warehouse}",${item.quantity},${item.minThreshold},${item.targetStock},"${item.status}",${item.unitCost},${item.unitPrice},${totalAssetVal},${item.isEssential ? 'YES' : 'NO'},"${item.supplier.name}","${item.supplier.email}"`
    );
  });

  const csvContent = rows.join('\r\n');
  const filename = `Inventory_Stock_Audit_${new Date().toISOString().split('T')[0]}.csv`;
  downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
}

export function exportPurchaseOrderJSON(po: PurchaseOrder) {
  const jsonString = JSON.stringify(po, null, 2);
  const filename = `PO_${po.poNumber}_${po.supplierName.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
  downloadFile(jsonString, filename, 'application/json');
}
