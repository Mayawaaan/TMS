import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { Search, Truck, MapPin, ShieldAlert, Cpu, DollarSign, X } from 'lucide-react';

interface SearchResult {
  id: string;
  category: 'NAVIGATION' | 'TRIP' | 'TRUCK' | 'AI_ACTION';
  title: string;
  subtitle: string;
  action: () => void;
}

export const CommandPalette: React.FC = () => {
  const { isCommandPaletteOpen, setCommandPaletteOpen, quickSwitchRole, openInspector } = useAuthStore();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!isCommandPaletteOpen);
      }
      if (e.key === 'Escape' && isCommandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, setCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  const sampleActions: SearchResult[] = [
    {
      id: 'role-dev',
      category: 'NAVIGATION',
      title: 'Switch to DEV Portal',
      subtitle: '/sys-internal-dev • Bypass cloaking with Dev Gate Token',
      action: () => { quickSwitchRole('DEV'); setCommandPaletteOpen(false); },
    },
    {
      id: 'role-admin',
      category: 'NAVIGATION',
      title: 'Switch to ADMIN Portal',
      subtitle: 'Fleet Command • Full P&L, PIN Overrides, Cashflow Monte Carlo',
      action: () => { quickSwitchRole('ADMIN'); setCommandPaletteOpen(false); },
    },
    {
      id: 'role-manager',
      category: 'NAVIGATION',
      title: 'Switch to MANAGER Portal',
      subtitle: 'Dispatch & Ops • Restricted financial ledger masking active',
      action: () => { quickSwitchRole('MANAGER'); setCommandPaletteOpen(false); },
    },
    {
      id: 'role-staff',
      category: 'NAVIGATION',
      title: 'Switch to STAFF Portal',
      subtitle: 'Waybills, Invoices & Tyre Blueprint Management',
      action: () => { quickSwitchRole('STAFF'); setCommandPaletteOpen(false); },
    },
    {
      id: 'role-driver',
      category: 'NAVIGATION',
      title: 'Switch to DRIVER Portal',
      subtitle: 'Active trip progress, Digital POD & Expense Uploads',
      action: () => { quickSwitchRole('DRIVER'); setCommandPaletteOpen(false); },
    },
    {
      id: 'inspect-theft-1',
      category: 'TRIP',
      title: 'Trip #LR/2026/01015 [FUEL THEFT ANOMALY]',
      subtitle: 'Indore -> Chennai • Tata Signa 2823.K • KMPL 2.55 vs 3.80 expected',
      action: () => { openInspector('LR/2026/01015'); setCommandPaletteOpen(false); },
    },
    {
      id: 'inspect-theft-2',
      category: 'TRIP',
      title: 'Trip #LR/2026/01001 [HIGH MARGIN STAR]',
      subtitle: 'Indore -> Mumbai • Tata Signa 4825.TK • High Net Margin',
      action: () => { openInspector('LR/2026/01001'); setCommandPaletteOpen(false); },
    },
    {
      id: 'ai-audit',
      category: 'AI_ACTION',
      title: 'Run Isolation Forest Fuel Theft Audit',
      subtitle: 'Audit fleet telemetry across 80 active and closed corridors',
      action: () => { setCommandPaletteOpen(false); },
    },
    {
      id: 'ai-monte-carlo',
      category: 'AI_ACTION',
      title: 'Run 60-Day Cashflow Monte Carlo (1,000 Paths)',
      subtitle: 'Evaluate P10 liquidity risks and projected deficit dates',
      action: () => { setCommandPaletteOpen(false); },
    },
  ];

  const filtered = query.trim() === '' 
    ? sampleActions 
    : sampleActions.filter(a => 
        a.title.toLowerCase().includes(query.toLowerCase()) || 
        a.subtitle.toLowerCase().includes(query.toLowerCase())
      );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/70 backdrop-blur-md transition-opacity">
      <div className="w-full max-w-2xl bg-obsidian-surface border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden glass-panel-heavy">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-800">
          <Search className="w-5 h-5 text-slate-400 mr-3" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, trip number, truck registration, or role..."
            className="w-full bg-transparent border-0 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-0 text-sm font-medium"
          />
          <button 
            onClick={() => setCommandPaletteOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action List */}
        <div className="max-h-96 overflow-y-auto p-2 divide-y divide-slate-800/40">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              No matching commands or entities found for "{query}"
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                onClick={item.action}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800/70 cursor-pointer transition-colors group"
              >
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 group-hover:text-cyan-400 group-hover:border-cyan-500/30 transition-colors">
                  {item.category === 'NAVIGATION' && <Cpu className="w-4 h-4" />}
                  {item.category === 'TRIP' && <Truck className="w-4 h-4" />}
                  {item.category === 'AI_ACTION' && <ShieldAlert className="w-4 h-4 text-purple-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-200 group-hover:text-white truncate">
                    {item.title}
                  </div>
                  <div className="text-xs text-slate-400 truncate">
                    {item.subtitle}
                  </div>
                </div>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800/60 text-slate-400 border border-slate-700/50">
                  {item.category}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <div className="flex items-center gap-2">
            <span>Navigate: <kbd className="px-1 bg-slate-800 rounded">↑</kbd> <kbd className="px-1 bg-slate-800 rounded">↓</kbd></span>
            <span>Select: <kbd className="px-1 bg-slate-800 rounded">↵</kbd></span>
          </div>
          <span>Close: <kbd className="px-1 bg-slate-800 rounded">ESC</kbd></span>
        </div>
      </div>
    </div>
  );
};
