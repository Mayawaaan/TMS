import React, { useEffect, useState } from 'react';
import { useAuthStore } from './stores/useAuthStore';
import { AdminPortal } from './portals/admin/AdminPortal';
import { ManagerPortal } from './portals/manager/ManagerPortal';
import { StaffPortal } from './portals/staff/StaffPortal';
import { DriverPortal } from './portals/driver/DriverPortal';
import { DevPortal } from './portals/dev/DevPortal';
import { DevQuickSwitchBar } from './components/layout/DevQuickSwitchBar';
import { CommandPalette } from './components/command/CommandPalette';
import { TripInspectorDrawer } from './components/drawers/TripInspectorDrawer';
import { 
  Shield, 
  Terminal, 
  Briefcase, 
  Users, 
  Truck, 
  Command, 
  Radio, 
  Clock, 
  LogOut,
  ArrowRight,
  Sparkles,
  X
} from 'lucide-react';
import { UserRole } from './types';

export const App: React.FC = () => {
  const {
    role,
    user,
    initialize,
    logout,
    setCommandPaletteOpen,
    isLoading,
    portalNotice,
    clearPortalNotice,
    navigateToPortal,
    focusedTripId,
    openInspector,
  } = useAuthStore();
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    initialize();
    const interval = setInterval(() => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const renderActivePortal = () => {
    if (isLoading && !user) {
      return (
        <div className="flex flex-col items-center justify-center py-32 gap-3 text-slate-400 font-mono text-xs">
          <Radio className="w-6 h-6 text-cyan-400 animate-spin" />
          <span>ESTABLISHING SECURE TELEMETRY SESSION...</span>
        </div>
      );
    }

    const portalKey = `${role}-${user?.id || 'active'}`;
    switch (role) {
      case 'DEV':
        return <DevPortal key={portalKey} />;
      case 'MANAGER':
        return <ManagerPortal key={portalKey} />;
      case 'STAFF':
        return <StaffPortal key={portalKey} />;
      case 'DRIVER':
        return <DriverPortal key={portalKey} />;
      case 'ADMIN':
      default:
        return <AdminPortal key={portalKey} />;
    }
  };

  return (
    <div className="min-h-screen bg-obsidian-bg text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-900">
      {/* Top Obsidian Glass Navigation Header */}
      <header className="sticky top-0 z-40 bg-obsidian-surface/85 backdrop-blur-xl border-b border-white/5 px-6 py-3.5 flex items-center justify-between">
        {/* Left: Brand & Telemetry Pulse */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600 to-cyan-400 flex items-center justify-center text-slate-950 font-black shadow-glow-cyan">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="text-sm font-extrabold tracking-wider font-mono text-white flex items-center gap-2">
                OBSIDIAN FLEET
                <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-cyan-950 text-cyan-400 border border-cyan-800">
                  COMMAND v2.6
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                ACID ERP • AI TELEMETRY • WEIBULL SURVIVAL
              </div>
            </div>
          </div>
        </div>

        {/* Center: Live UTC/IST Clock & Active Portal Pill */}
        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-mono text-slate-300">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>IST {time || '16:42:00'}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-mono">
            <span className="text-slate-500">PORTAL:</span>
            <span className="font-bold text-cyan-300">{role}</span>
          </div>
        </div>

        {/* Right: Global Command Search & User Profile */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-400 font-mono transition-colors"
          >
            <Command className="w-3.5 h-3.5" />
            <span>Search or command...</span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 border border-slate-700">⌘K</kbd>
          </button>

          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-slate-200 font-mono">{user?.name || 'Administrator'}</div>
              <div className="text-[10px] text-slate-400">{user?.email || 'admin@fleetcommand.internal'}</div>
            </div>
            <button
              onClick={() => logout()}
              title="Sign Out"
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Interactive Cross-Portal Workflow Pipeline Bar */}
      <div className="bg-slate-950/90 border-b border-slate-800/80 px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-bold text-slate-300 uppercase">Connected ERP Workflow:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
            {(
              [
                { id: 'STAFF', step: '1. STAFF DESK', sub: 'Book Bilty & Tyres' },
                { id: 'MANAGER', step: '2. MANAGER OPS', sub: 'Dispatch & Ledger' },
                { id: 'DRIVER', step: '3. DRIVER CABIN', sub: 'Transit, Fuel & POD' },
                { id: 'ADMIN', step: '4. ADMIN COMMAND', sub: 'P&L, PIN & Cashflow' },
                { id: 'DEV', step: '5. DEV CONSOLE', sub: 'Flags & Audit' },
              ] as { id: UserRole; step: string; sub: string }[]
            ).map((stage, idx, arr) => {
              const isActive = role === stage.id;
              return (
                <React.Fragment key={stage.id}>
                  <button
                    onClick={() => navigateToPortal(stage.id)}
                    className={`px-2.5 py-1 rounded-lg border text-left transition-all flex items-center gap-2 ${
                      isActive
                        ? 'bg-cyan-950/90 border-cyan-500/60 text-cyan-300 shadow-glow-cyan'
                        : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div>
                      <div className="text-[10px] font-bold leading-tight">{stage.step}</div>
                      <div className="text-[9px] text-slate-500 leading-tight">{stage.sub}</div>
                    </div>
                  </button>
                  {idx < arr.length - 1 && <ArrowRight className="w-3 h-3 text-slate-600 hidden sm:block" />}
                </React.Fragment>
              );
            })}
          </div>

          {focusedTripId && (
            <button
              onClick={() => openInspector(focusedTripId)}
              className="px-2.5 py-1 rounded-lg bg-purple-950/70 hover:bg-purple-900/70 border border-purple-700/60 text-[11px] font-mono text-purple-200 flex items-center gap-1.5"
            >
              <span>Active Trip Context</span>
              <span className="font-bold text-cyan-300">Inspect →</span>
            </button>
          )}
        </div>
      </div>

      {/* Cross-Portal Live Handoff Banner */}
      {portalNotice && (
        <div className="bg-gradient-to-r from-cyan-950/90 via-slate-900 to-purple-950/90 border-b border-cyan-500/40 px-6 py-2.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 font-mono text-xs">
            <div className="flex items-center gap-2.5">
              <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold text-[10px]">
                {portalNotice.fromRole} → {portalNotice.toRole} HANDOFF
              </span>
              <span className="text-slate-100">{portalNotice.message}</span>
              {portalNotice.tripId && (
                <button
                  onClick={() => openInspector(portalNotice.tripId!)}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-[10px]"
                >
                  Open Trip Inspector Drawer
                </button>
              )}
            </div>
            <button
              onClick={clearPortalNotice}
              className="text-slate-400 hover:text-white p-1 rounded"
              title="Dismiss notice"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main View Area with Spacious Canvas for Clean Portal Sidebars */}
      <main className="flex-1 w-full max-w-[1720px] mx-auto p-3 sm:p-5 lg:p-6">
        {renderActivePortal()}
      </main>

      {/* Slide-over Deep Trip Inspector Drawer */}
      <TripInspectorDrawer />

      {/* Global Command Palette */}
      <CommandPalette />

      {/* Bottom Floating Quick-Switch Dock */}
      <DevQuickSwitchBar />
    </div>
  );
};
