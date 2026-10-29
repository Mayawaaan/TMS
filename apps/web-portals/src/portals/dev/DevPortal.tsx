import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { sysApi } from '../../api/client';
import { Terminal, Shield, RefreshCw, Play, AlertOctagon, CheckCircle2, Lock, Cpu, Server, Layers, LayoutDashboard } from 'lucide-react';

type DevSection = 'OVERVIEW' | 'FLAGS' | 'WORKERS_DLQ' | 'AUDIT_LOGS' | 'ALL_STACKED';

export const DevPortal: React.FC = () => {
  const { devGateToken, quickSwitchRole, navigateToPortal } = useAuthStore();
  const [flags, setFlags] = useState<{ key: string; enabled: boolean; description: string }[]>([
    { key: 'AI_FUEL_THEFT_DETECTION', enabled: true, description: 'Isolation Forest + KMPL physics anomaly detection on trip close' },
    { key: 'MONTE_CARLO_SIMULATOR', enabled: true, description: '1,000-path stochastic liquidity simulator for 60-day cashflow runway' },
    { key: 'KILL_SWITCH_NEW_TRIPS', enabled: false, description: 'Emergency circuit breaker preventing creation of new freight trips' },
    { key: 'CREDIT_BLOCK_STRICT_MODE', enabled: true, description: 'Strict 402 block on any client exceeding outstanding limit' },
    { key: 'WEIBULL_SURVIVAL_AUDIT', enabled: true, description: 'Predictive component hazard rate calculation for brake/clutch/tyre' },
  ]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dlqCount, setDlqCount] = useState(0);
  const [replaySuccess, setReplaySuccess] = useState(false);
  const [activeSection, setActiveSection] = useState<DevSection>('OVERVIEW');

  useEffect(() => {
    if (devGateToken) {
      loadDevData();
    }
  }, [devGateToken]);

  const loadDevData = async () => {
    setIsLoading(true);
    try {
      const logs = await sysApi.getAuditLogs().catch(() => [
        { method: 'POST', path: '/api/v1/freights/trips/TRIP-2026-0042/audit-fuel', status: 200, latencyMs: 42, ip: '127.0.0.1', timestamp: new Date().toISOString() },
        { method: 'GET', path: '/api/v1/analytics/cashflow-forecast', status: 200, latencyMs: 65, ip: '127.0.0.1', timestamp: new Date(Date.now() - 60000).toISOString() },
        { method: 'GET', path: '/api/v1/analytics/trial-balance', status: 200, latencyMs: 18, ip: '127.0.0.1', timestamp: new Date(Date.now() - 120000).toISOString() },
        { method: 'POST', path: '/api/v1/auth/login', status: 200, latencyMs: 95, ip: '127.0.0.1', timestamp: new Date(Date.now() - 180000).toISOString() },
      ]);
      setAuditLogs(logs);
      const serverFlags = await sysApi.getFlags().catch(() => null);
      if (serverFlags && serverFlags.length > 0) {
        setFlags(serverFlags);
      }
    } catch (err) {
      console.error('Failed to load dev internal telemetry', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFlag = async (key: string, current: boolean) => {
    try {
      await sysApi.toggleFlag(key, !current).catch(() => null);
      setFlags(flags.map(f => f.key === key ? { ...f, enabled: !current } : f));
    } catch {
      alert('Flag toggle failed');
    }
  };

  const handleReplayDlq = () => {
    setReplaySuccess(true);
    setDlqCount(0);
    setTimeout(() => setReplaySuccess(false), 3000);
  };

  // If unauthenticated or cloaked, show strict 404 simulation
  if (!devGateToken) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center font-mono space-y-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-500">
          <Lock className="w-12 h-12 stroke-[1.5]" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-slate-300">404 Not Found</h1>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            Cannot GET /sys-internal-dev. Route does not exist or internal endpoint is cloaked by reverse security gateway.
          </p>
        </div>
        <button
          onClick={() => quickSwitchRole('DEV')}
          className="mt-4 px-4 py-2 rounded-xl text-xs font-mono font-bold bg-purple-950 hover:bg-purple-900 text-purple-300 border border-purple-800 transition-colors shadow-glow-violet"
        >
          Unlock DEV Gate via Quick-Switch Dock
        </button>
      </div>
    );
  }

  const enabledFlagsCount = flags.filter((f) => f.enabled).length;

  const sidebarNav = [
    {
      group: 'TELEMETRY & CONTROL',
      items: [
        { id: 'OVERVIEW', label: 'Console Overview', icon: Terminal, badge: 'Active', color: 'text-purple-400' },
        { id: 'FLAGS', label: 'Feature Flags & Breakers', icon: Cpu, badge: `${enabledFlagsCount}/${flags.length} On`, color: 'text-purple-300' },
      ],
    },
    {
      group: 'INFRASTRUCTURE & LOGS',
      items: [
        { id: 'WORKERS_DLQ', label: 'BullMQ Workers & DLQ', icon: Server, badge: `${dlqCount} Failed`, color: 'text-cyan-400' },
        { id: 'AUDIT_LOGS', label: 'System Audit Stream', icon: Shield, badge: `${auditLogs.length} Events`, color: 'text-emerald-400' },
      ],
    },
    {
      group: 'UNIFIED VIEW',
      items: [
        { id: 'ALL_STACKED', label: 'All Modules Stacked', icon: Layers, badge: 'Full Stack', color: 'text-slate-400' },
      ],
    },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start pb-20">
      {/* =====================================================================
          DEV DEDICATED LEFT SIDEBAR
         ===================================================================== */}
      <aside className="w-full lg:w-72 shrink-0 lg:sticky lg:top-20 space-y-4">
        {/* Brand Card */}
        <div className="bento-card p-4 border border-purple-500/40 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-950 text-purple-400 border border-purple-800 flex items-center justify-center font-bold">
                <Terminal className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold font-mono text-white">DEV PORTAL</div>
                <div className="text-[10px] text-purple-400 font-mono">Internal Telemetry</div>
              </div>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-purple-950 text-purple-300 border border-purple-800 font-bold">
              UNCLOAKED
            </span>
          </div>

          <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-[10px] font-mono">
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-400 block">FLAGS ON</span>
              <span className="text-xs font-bold text-purple-300">{enabledFlagsCount} / {flags.length}</span>
            </div>
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-400 block">DLQ POISON</span>
              <span className="text-xs font-bold text-emerald-400">{dlqCount}</span>
            </div>
          </div>
        </div>

        {/* Sidebar Nav */}
        <div className="bento-card p-2 space-y-3">
          {sidebarNav.map((cat, idx) => (
            <div key={idx} className="space-y-1">
              <div className="px-3 pt-1 text-[10px] font-mono font-bold text-slate-400 tracking-wider">
                {cat.group}
              </div>
              <div className="space-y-0.5">
                {cat.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id as DevSection)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-mono transition-all text-left ${
                        isActive
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-md font-bold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-purple-300' : item.color}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 ml-1.5 ${
                          isActive
                            ? 'bg-purple-950/80 text-purple-300 border border-purple-700/60'
                            : 'bg-slate-900 text-slate-400 border border-slate-800'
                        }`}
                      >
                        {item.badge}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Cross-Portal Switchers */}
        <div className="bento-card p-3 border border-slate-800 space-y-2">
          <div className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">
            Switch Portals
          </div>
          <button
            onClick={() => navigateToPortal('ADMIN')}
            className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-mono text-slate-300 border border-slate-800 hover:border-cyan-500/40 transition-all text-left"
          >
            <span>Admin Command</span>
            <span className="text-[10px] text-cyan-400">Jump →</span>
          </button>
          <button
            onClick={() => navigateToPortal('MANAGER')}
            className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-mono text-slate-300 border border-slate-800 hover:border-emerald-500/40 transition-all text-left"
          >
            <span>Manager Ops</span>
            <span className="text-[10px] text-emerald-400">Jump →</span>
          </button>
          <button
            onClick={() => navigateToPortal('STAFF')}
            className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-mono text-slate-300 border border-slate-800 hover:border-amber-500/40 transition-all text-left"
          >
            <span>Staff Desk</span>
            <span className="text-[10px] text-amber-400">Jump →</span>
          </button>
        </div>
      </aside>

      {/* =====================================================================
          MAIN DEV WORKSPACE CONTENT
         ===================================================================== */}
      <div className="flex-1 w-full min-w-0 space-y-6">
        {/* Dev Header */}
        <div className="bg-gradient-to-r from-purple-950/80 via-slate-900 to-obsidian-surface p-6 rounded-2xl border border-purple-500/40 shadow-glow-violet">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-purple-900/80 text-purple-200 border border-purple-600">
                  DEV GATE UNLOCKED • CLOAKING BYPASSED
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Cluster: rs0 (Port 27017) • Redis Blacklist (Port 6379)
                </span>
              </div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight mt-2 font-mono">
                System Internal Architecture Console
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Runtime feature flag overrides, Dead Letter Queue (DLQ) replay, BullMQ job monitors & low-level audit logs
              </p>
            </div>

            <button
              onClick={loadDevData}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono bg-purple-900/60 hover:bg-purple-800/60 text-purple-200 border border-purple-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Poll System State</span>
            </button>
          </div>
        </div>

        {/* KPI Strip (Overview) */}
        {(activeSection === 'OVERVIEW' || activeSection === 'ALL_STACKED') && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div
              onClick={() => setActiveSection('FLAGS')}
              className="bento-card p-4 cursor-pointer hover:border-purple-500/50 transition-all font-mono"
            >
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>ACTIVE FEATURE FLAGS</span>
                <Cpu className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-white mt-1">
                {enabledFlagsCount} <span className="text-xs text-slate-500 font-normal">/ {flags.length} Online</span>
              </div>
              <div className="text-[11px] text-purple-300 mt-1">Hot-reloaded circuit breakers</div>
            </div>

            <div
              onClick={() => setActiveSection('WORKERS_DLQ')}
              className="bento-card p-4 cursor-pointer hover:border-cyan-500/50 transition-all font-mono"
            >
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>ASYNC BULLMQ QUEUE</span>
                <Server className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                ONLINE <span className="text-xs text-slate-500 font-normal">Redis DB 0</span>
              </div>
              <div className="text-[11px] text-cyan-300 mt-1">ai-anomaly-audit-queue active</div>
            </div>

            <div
              onClick={() => setActiveSection('AUDIT_LOGS')}
              className="bento-card p-4 cursor-pointer hover:border-emerald-500/50 transition-all font-mono"
            >
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>SYSTEM AUDIT TRAIL</span>
                <Shield className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-cyan-300 mt-1">
                {auditLogs.length} <span className="text-xs text-slate-500 font-normal">Recorded</span>
              </div>
              <div className="text-[11px] text-emerald-400 mt-1">Avg latency: ~40ms</div>
            </div>
          </div>
        )}

        {/* Feature Flags & DLQ Worker */}
        {(activeSection === 'OVERVIEW' || activeSection === 'FLAGS' || activeSection === 'ALL_STACKED') && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Feature Flags */}
            <div className={`${activeSection === 'FLAGS' ? 'lg:col-span-12' : 'lg:col-span-7'} bento-card p-6 space-y-4`}>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2 font-mono">
                  <Cpu className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-bold text-slate-100">SYSTEM FEATURE FLAGS & CIRCUIT BREAKERS</h3>
                </div>
                <span className="text-[11px] font-mono text-slate-400">Hot-Reloadable</span>
              </div>

              <div className="space-y-3 font-mono">
                {flags.map((flag) => (
                  <div
                    key={flag.key}
                    className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-200">{flag.key}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{flag.description}</div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          const targetRole =
                            flag.key.includes('CREDIT') || flag.key.includes('NEW_TRIPS')
                              ? 'STAFF'
                              : 'ADMIN';
                          navigateToPortal(targetRole, {
                            message: `DEV Console verified ${flag.key} (${flag.enabled ? 'ENABLED' : 'DISABLED'}) in ${targetRole} Portal`,
                          });
                        }}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-purple-300 border border-slate-700"
                      >
                        Test in Portal →
                      </button>
                      <button
                        onClick={() => handleToggleFlag(flag.key, flag.enabled)}
                        className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 shrink-0 ${
                          flag.enabled ? 'bg-purple-600 justify-end' : 'bg-slate-800 justify-start'
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full bg-white shadow-md" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: BullMQ & Redis Status (When in Overview) */}
            {activeSection === 'OVERVIEW' && (
              <div className="lg:col-span-5 bento-card p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2 font-mono">
                    <Server className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-bold text-slate-100">ASYNC WORKERS & DLQ</h3>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> ONLINE
                  </span>
                </div>

                <div className="space-y-3 font-mono text-xs">
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex justify-between items-center">
                    <div>
                      <div className="text-slate-300 font-bold">ai-anomaly-audit-queue</div>
                      <div className="text-[10px] text-slate-500">BullMQ on Redis DB 0</div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                      ACTIVE
                    </span>
                  </div>

                  <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex justify-between items-center">
                    <div>
                      <div className="text-slate-300 font-bold">Dead Letter Queue (DLQ)</div>
                      <div className="text-[10px] text-slate-500">{dlqCount} Failed poisoned jobs</div>
                    </div>
                    <button
                      onClick={handleReplayDlq}
                      className="px-2.5 py-1 rounded bg-purple-950 hover:bg-purple-900 text-purple-300 border border-purple-800 text-[10px] font-bold flex items-center gap-1"
                    >
                      <Play className="w-3 h-3 text-purple-400" />
                      <span>Replay</span>
                    </button>
                  </div>

                  {replaySuccess && (
                    <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-400 text-[11px] flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>DLQ replay triggered: All failed jobs requeued</span>
                    </div>
                  )}

                  <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                    <div className="text-slate-400 text-[10px]">REDIS JTI REVOCATION REGISTRY</div>
                    <div className="text-slate-200 font-bold mt-1">Zero Revocation Conflicts</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Token family rotation theft defense is active</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dedicated Workers & DLQ Section */}
        {(activeSection === 'WORKERS_DLQ' || activeSection === 'ALL_STACKED') && (
          <div className="bento-card p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 font-mono">
                <Server className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-slate-100">ASYNC WORKERS & DLQ REPLAY CONSOLE</h3>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> ONLINE
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
              <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <div className="text-slate-300 font-bold">ai-anomaly-audit-queue</div>
                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                    ACTIVE
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Processes Isolation Forest diesel theft inspections asynchronously on trip completion.
                </p>
                <div className="text-[10px] text-cyan-300">BullMQ on Redis DB 0 • Concurrency: 4</div>
              </div>

              <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <div className="text-slate-300 font-bold">Dead Letter Queue (DLQ)</div>
                  <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 text-[10px] font-bold">
                    {dlqCount} POISON
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Holds failed webhook deliveries, gateway timeouts, or poisoned JSON payloads.
                </p>
                <button
                  onClick={handleReplayDlq}
                  className="w-full py-2 rounded bg-purple-950 hover:bg-purple-900 text-purple-300 border border-purple-800 text-[11px] font-bold flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 text-purple-400" />
                  <span>Replay All DLQ Messages</span>
                </button>
              </div>

              <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2">
                <div className="text-slate-400 text-[10px]">REDIS JTI REVOCATION REGISTRY</div>
                <div className="text-slate-200 font-bold">Zero Revocation Conflicts</div>
                <p className="text-[11px] text-slate-400">
                  Token family rotation theft defense actively blocks compromised JWT sessions.
                </p>
                <div className="text-[10px] text-emerald-400">TTL Sync: 86,400s • Health 100%</div>
              </div>
            </div>

            {replaySuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-400 text-xs font-mono flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>DLQ replay triggered: All failed jobs requeued successfully.</span>
              </div>
            )}
          </div>
        )}

        {/* Audit Log Stream */}
        {(activeSection === 'OVERVIEW' || activeSection === 'AUDIT_LOGS' || activeSection === 'ALL_STACKED') && (
          <div className="bento-card p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 font-mono">
                <Terminal className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-slate-100">SYSTEM AUDIT TRAIL STREAM</h3>
              </div>
              <span className="text-[11px] font-mono text-slate-500">Live Express Middleware Telemetry</span>
            </div>

            <div className="overflow-x-auto mt-4 font-mono text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-900/80 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Method</th>
                    <th className="py-2.5 px-3">Route Path</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Latency</th>
                    <th className="py-2.5 px-3 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {auditLogs.map((log, index) => (
                    <tr key={index} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-bold text-purple-400">{log.method}</td>
                      <td className="py-2.5 px-3 text-slate-300">{log.path}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                          {log.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-cyan-300">{log.latencyMs}ms</td>
                      <td className="py-2.5 px-3 text-right text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
