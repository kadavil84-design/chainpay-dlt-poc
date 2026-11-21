import { Plus, RotateCcw } from 'lucide-react';
import { ActiveTab } from '../types/chainpay';

interface TopNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onNewTransaction: () => void;
  onResetDemo: () => void;
  isResettingDemo?: boolean;
  pendingExceptionsCount: number;
  activeVpoCount: number;
  blockCount: number;
}

export function TopNav({
  activeTab,
  onSelectTab,
  onNewTransaction,
  onResetDemo,
  isResettingDemo = false,
  pendingExceptionsCount,
  activeVpoCount,
  blockCount,
}: TopNavProps) {
  const navItems: { id: ActiveTab; label: string; count?: number }[] = [
    { id: 'workflow', label: 'P2P Workflow', count: pendingExceptionsCount > 0 ? pendingExceptionsCount : undefined },
    { id: 'liquidity', label: 'VPO Liquidity', count: activeVpoCount },
    { id: 'ledger', label: 'Audit Ledger', count: blockCount },
    { id: 'dashboard', label: 'KPIs & Contract' },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between gap-6">
          {/* Zone 1: Single-element Brand Wordmark */}
          <button
            type="button"
            onClick={() => onSelectTab('workflow')}
            className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 rounded"
          >
            ChainPay
          </button>

          {/* Zone 2: 4 Clean Single-Line Navigation Links */}
          <nav aria-label="Primary modules" className="hidden md:flex items-center gap-7 h-full">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`relative h-full inline-flex items-center gap-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:text-slate-900 ${
                    isActive
                      ? 'text-slate-900'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <span>{item.label}</span>
                  {typeof item.count === 'number' && (
                    <span
                      className={`font-mono text-xs tabular-nums ${
                        item.id === 'workflow' && pendingExceptionsCount > 0
                          ? 'text-amber-600 font-semibold'
                          : isActive
                            ? 'text-slate-900'
                            : 'text-slate-400'
                      }`}
                    >
                      ({item.count})
                    </span>
                  )}
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 inset-x-0 h-0.5 bg-slate-900"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Reset Demo Data (subtle) + Primary Action */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              disabled={isResettingDemo}
              onClick={onResetDemo}
              title="Clear newly created transactions and restore the initial 2 pre-populated transactions"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-white hover:text-slate-900 hover:bg-slate-50 border border-slate-200 hover:border-slate-300 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isResettingDemo ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span className="hidden sm:inline">Reset Demo Data</span>
              <span className="sm:hidden">Reset</span>
            </button>
            <button
              type="button"
              onClick={onNewTransaction}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>New Transaction</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Strip */}
        <nav
          aria-label="Mobile modules"
          className="flex md:hidden items-center gap-5 overflow-x-auto pb-2.5 -mx-1 px-1"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`text-xs font-medium py-1 whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                  isActive
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                {item.label}
                {typeof item.count === 'number' ? ` (${item.count})` : ''}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
