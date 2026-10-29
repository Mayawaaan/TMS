import React from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { UserRole } from '../../types';
import { Terminal, Shield, Briefcase, Users, Truck, Command, Lock, Unlock } from 'lucide-react';

export const DevQuickSwitchBar: React.FC = () => {
  const { role, quickSwitchRole, isLoading, devGateToken, setCommandPaletteOpen } = useAuthStore();

  const roles: { id: UserRole; label: string; icon: any; color: string; activeColor: string }[] = [
    { id: 'DEV', label: 'DEV (/sys-internal)', icon: Terminal, color: 'hover:text-purple-400', activeColor: 'bg-purple-950/80 text-purple-300 border-purple-500/50 shadow-glow-violet' },
    { id: 'ADMIN', label: 'ADMIN', icon: Shield, color: 'hover:text-cyan-400', activeColor: 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50 shadow-glow-cyan' },
    { id: 'MANAGER', label: 'MANAGER', icon: Briefcase, color: 'hover:text-emerald-400', activeColor: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50 shadow-glow-emerald' },
    { id: 'STAFF', label: 'STAFF', icon: Users, color: 'hover:text-amber-400', activeColor: 'bg-amber-950/80 text-amber-300 border-amber-500/50' },
    { id: 'DRIVER', label: 'DRIVER', icon: Truck, color: 'hover:text-rose-400', activeColor: 'bg-rose-950/80 text-rose-300 border-rose-500/50' },
  ];

  return (
    <aside aria-label="Role Switcher Dock" className="fixed bottom-4 right-4 z-50 flex items-center gap-2 p-1.5 rounded-2xl glass-dock transition-all duration-300">
      {/* Dev Gate Status Badge */}
      <div 
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-xl bg-slate-900/60 border border-slate-700/50 text-slate-400 font-mono"
        title={devGateToken ? "DEV Gate Unlocked (x-dev-gate active)" : "Dev Routes Cloaked (Returns 404)"}
      >
        {devGateToken ? (
          <>
            <Unlock className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
            <span className="text-purple-300 font-medium">GATE ACTIVE</span>
          </>
        ) : (
          <>
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <span>CLOAKED</span>
          </>
        )}
      </div>

      <div className="h-4 w-px bg-slate-800" />

      {/* Role Switcher Pill Buttons */}
      <div className="flex items-center gap-1">
        {roles.map((r) => {
          const Icon = r.icon;
          const isActive = role === r.id;
          return (
            <button
              key={r.id}
              onClick={() => quickSwitchRole(r.id)}
              disabled={isLoading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wide border transition-all duration-200 ${
                isActive
                  ? `${r.activeColor} border-current`
                  : `border-transparent text-slate-400 ${r.color} hover:bg-slate-800/50`
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{r.label}</span>
            </button>
          );
        })}
      </div>

      <div className="h-4 w-px bg-slate-800" />

      {/* Command Palette Trigger */}
      <button
        onClick={() => setCommandPaletteOpen(true)}
        className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-xl transition-colors font-mono"
        title="Open Command Palette (Ctrl+K)"
      >
        <Command className="w-3.5 h-3.5" />
        <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">⌘K</span>
      </button>
    </aside>
  );
};
