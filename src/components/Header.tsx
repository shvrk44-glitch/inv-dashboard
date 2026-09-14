import { Package, AlertTriangle, FileText, TrendingUp, Zap, Bell, CheckCircle2, Moon, Sun, Database } from 'lucide-react';
import { InventoryItem } from '../types';

interface HeaderProps {
  activeTab: 'inventory' | 'alerts' | 'orders' | 'analytics' | 'integrations';
  setActiveTab: (tab: 'inventory' | 'alerts' | 'orders' | 'analytics' | 'integrations') => void;
  items: InventoryItem[];
  isDarkMode?: boolean;
  setIsDarkMode?: (dark: boolean) => void;
}

interface NavItem {
  id: 'inventory' | 'alerts' | 'orders' | 'analytics' | 'integrations';
  label: string;
  icon: any;
  count?: number;
  badge?: number;
  badgeColor?: string;
  indicator?: boolean;
}

export function Header({ activeTab, setActiveTab, items, isDarkMode, setIsDarkMode }: HeaderProps) {
  const lowStockCount = items.filter((i) => i.status === 'low' || i.status === 'critical').length;
  const criticalCount = items.filter((i) => i.status === 'critical').length;

  const navItems: NavItem[] = [
    { id: 'inventory', label: 'Stock & Inventory', icon: Package, count: items.length },
    {
      id: 'alerts',
      label: 'Low Stock Alerts',
      icon: AlertTriangle,
      badge: lowStockCount > 0 ? lowStockCount : undefined,
      badgeColor: criticalCount > 0 ? 'bg-red-500 text-white' : 'bg-amber-500 text-white',
    },
    { id: 'orders', label: 'Purchase Orders', icon: FileText },
    { id: 'analytics', label: 'Sales Trends & Export', icon: TrendingUp },
    { id: 'integrations', label: 'Zapier & Email', icon: Zap },
  ];

  return (
    <header className="sticky top-0 z-30 bg-slate-900 dark:bg-slate-950 border-b border-slate-800 text-white">
      {/* Top utility bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 font-bold">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-lg tracking-tight text-white">Inventory Hub</span>
                <span className="text-[11px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Real-Time
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Automated stock tracking & procurement
              </p>
            </div>
          </div>

          {/* Right Status & Alert Pill */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              id="btn-header-zapier-quicktest"
              onClick={() => setActiveTab('integrations')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 transition-all text-xs font-semibold"
              title="Test Zapier Email Webhook"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Zapier Webhook</span>
              <span className="sm:hidden">Zapier</span>
            </button>

            {lowStockCount > 0 ? (
              <button
                id="btn-header-alerts"
                onClick={() => setActiveTab('alerts')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20 transition-all text-xs font-medium"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                <span>
                  {lowStockCount} {lowStockCount === 1 ? 'item requires' : 'items require'} restock
                </span>
              </button>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>All stock levels healthy</span>
              </div>
            )}

            {/* Theme Toggle */}
            {setIsDarkMode && (
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                title="Toggle Dark Mode"
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-slate-300" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-800/80">
        <nav className="flex space-x-1 sm:space-x-4 overflow-x-auto py-2 no-scrollbar" aria-label="Tabs">
          {navItems.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-nav-${tab.id}`}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`ml-1.5 px-1.5 py-0.5 text-[11px] font-bold rounded-full ${tab.badgeColor || 'bg-slate-700 text-white'}`}
                  >
                    {tab.badge}
                  </span>
                )}
                {tab.indicator && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 ring-2 ring-amber-400/30"></span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
