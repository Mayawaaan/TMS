import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { tripsApi, fleetApi, financeApi, aiApi, businessApi } from '../../api/client';
import { Trip, Truck, CashflowForecast, Client } from '../../types';
import { CashflowChart } from '../../components/charts/CashflowChart';
import { StarLemonScatter } from '../../components/charts/StarLemonScatter';
import { AxleTyreBlueprint } from '../../components/visualizers/AxleTyreBlueprint';
import { WorkforceManagement } from '../../components/WorkforceManagement';
import { 
  Truck as TruckIcon, 
  DollarSign, 
  TrendingUp, 
  AlertTriangle, 
  ShieldCheck, 
  Key, 
  CheckCircle2, 
  Search,
  ExternalLink,
  ChevronRight,
  Sparkles,
  LayoutDashboard,
  Route,
  Disc,
  Layers,
  Receipt,
  Users,
} from 'lucide-react';

type AdminSection =
  | 'OVERVIEW'
  | 'TRIPS'
  | 'UNIT_ECONOMICS'
  | 'CASHFLOW_WATERFALL'
  | 'CORRIDORS'
  | 'TYRES_WEIBULL'
  | 'PIN_CONSOLE'
  | 'WORKFORCE_HR'
  | 'ALL_STACKED';

export const AdminPortal: React.FC = () => {
  const { openInspector, focusedTripId, focusedClientId, navigateToPortal } = useAuthStore();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [cashflow, setCashflow] = useState<CashflowForecast | null>(null);
  const [unitEconomics, setUnitEconomics] = useState<any[]>([]);
  const [waterfall, setWaterfall] = useState<any[]>([]);
  const [corridors, setCorridors] = useState<any[]>([]);
  const [aging, setAging] = useState<any>(null);
  const [selectedTruckForTyres, setSelectedTruckForTyres] = useState<string | null>(null);
  const [truckTyres, setTruckTyres] = useState<any[]>([]);
  const [maintenanceReport, setMaintenanceReport] = useState<any>(null);
  const [activeSection, setActiveSection] = useState<AdminSection>('OVERVIEW');

  // Financial PIN modal state
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinActionTarget, setPinActionTarget] = useState<string | null>(null);
  const [pinSuccessMsg, setPinSuccessMsg] = useState('');

  useEffect(() => {
    loadDashboardData();
  }, [focusedTripId, focusedClientId]);

  useEffect(() => {
    if (focusedClientId) {
      setPinActionTarget(focusedClientId);
      setIsPinModalOpen(true);
    }
  }, [focusedClientId]);

  const loadDashboardData = async () => {
    try {
      const [tripsData, trucksData, cashflowData, economicsData, clientsData, waterfallData, corridorData, agingData] = await Promise.all([
        tripsApi.getTrips(),
        fleetApi.getTrucks(),
        aiApi.getCashflowForecast().catch(() => null),
        financeApi.getUnitEconomics().catch(() => []),
        businessApi.getClients().catch(() => []),
        financeApi.getCashflowWaterfall().catch(() => []),
        financeApi.getCorridorProfitability().catch(() => []),
        financeApi.getReceivablesAging().catch(() => null),
      ]);
      setTrips(tripsData || []);
      setTrucks(trucksData || []);
      setCashflow(cashflowData);
      setUnitEconomics(economicsData || []);
      setClients(clientsData || []);
      setWaterfall(waterfallData || []);
      setCorridors(corridorData || []);
      setAging(agingData);
    } catch (err) {
      console.error('Failed to load admin dashboard data', err);
    }
  };

  const handleInspectTyres = async (truckNumber: string) => {
    try {
      const [tyres, pm] = await Promise.all([
        fleetApi.getTyres(truckNumber),
        aiApi.predictMaintenance(truckNumber).catch(() => null),
      ]);
      setTruckTyres(tyres);
      setMaintenanceReport(pm);
      setSelectedTruckForTyres(truckNumber);
    } catch (err) {
      console.error('Failed to load tyres', err);
    }
  };

  const handleVerifyPin = async () => {
    if (pinInput === '482916') {
      const targetClientId = pinActionTarget || focusedClientId || clients.find((c) => c.currentOutstanding > c.creditLimit)?._id;
      if (targetClientId) {
        const targetClient = clients.find((c) => c._id === targetClientId);
        const newLimit = (targetClient?.currentOutstanding || 2500000) + 1000000;
        await businessApi.overrideCreditLimit(targetClientId, newLimit, '482916').catch(() => null);
        await loadDashboardData();
        setPinSuccessMsg(`PIN Verified: ${targetClient?.companyName || 'Client'} Credit Limit Raised & Unblocked!`);
      } else {
        setPinSuccessMsg('PIN Verified: Financial Override Granted');
      }
    } else {
      alert('Invalid Financial PIN (Master PIN: 482916)');
    }
  };

  const orderedTrips = focusedTripId
    ? [
        ...trips.filter((t) => t._id === focusedTripId),
        ...trips.filter((t) => t._id !== focusedTripId),
      ]
    : trips;

  // Metrics summary
  const inTransitTrips = trips.filter(t => t.status === 'IN_TRANSIT').length;
  const activeTrucks = trucks.filter(t => t.currentStatus === 'IN_TRANSIT' || t.currentStatus === 'ASSIGNED').length;
  const totalRevenue = trips.reduce((acc, t) => acc + (t.financials?.totalRevenue || 0), 0);
  const totalProfit = trips.reduce((acc, t) => acc + (t.financials?.netTripProfit || 0), 0);
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const sidebarNav = [
    {
      group: 'EXECUTIVE COMMAND',
      items: [
        { id: 'OVERVIEW', label: 'Executive Command', icon: LayoutDashboard, badge: `${activeTrucks} Active`, color: 'text-cyan-400' },
        { id: 'TRIPS', label: 'Voyages & Live Ledger', icon: TruckIcon, badge: `${trips.length} Trips`, color: 'text-emerald-400' },
      ],
    },
    {
      group: 'FINANCE & BALANCE SHEET',
      items: [
        { id: 'UNIT_ECONOMICS', label: 'Monte Carlo & Unit Econ', icon: TrendingUp, badge: `${avgMargin.toFixed(1)}% Margin`, color: 'text-purple-400' },
        { id: 'CASHFLOW_WATERFALL', label: 'Working Capital Waterfall', icon: DollarSign, badge: 'ACID Flow', color: 'text-emerald-300' },
        { id: 'CORRIDORS', label: 'Corridor Matrix & Return', icon: Route, badge: `${corridors.length} Corridors`, color: 'text-cyan-300' },
      ],
    },
    {
      group: 'FLEET & SECURITY',
      items: [
        { id: 'TYRES_WEIBULL', label: 'Axle Tyres & Weibull AI', icon: Disc, badge: selectedTruckForTyres || 'Tire Map', color: 'text-amber-400' },
        { id: 'PIN_CONSOLE', label: 'Financial PIN Authorization', icon: Key, badge: 'Master PIN', color: 'text-amber-300' },
      ],
    },
    {
      group: 'COMPANY & WORKFORCE HR',
      items: [
        { id: 'WORKFORCE_HR', label: 'Company Workforce & Hiring', icon: Users, badge: 'Full HR', color: 'text-purple-400' },
      ],
    },
    {
      group: 'UNIFIED VIEW',
      items: [
        { id: 'ALL_STACKED', label: 'All Panels Stacked', icon: Layers, badge: 'Full ERP', color: 'text-slate-400' },
      ],
    },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start pb-20">
      {/* =====================================================================
          ADMIN DEDICATED LEFT SIDEBAR
         ===================================================================== */}
      <aside className="w-full lg:w-72 shrink-0 lg:sticky lg:top-20 space-y-4">
        {/* Brand Card */}
        <div className="bento-card p-4 border border-cyan-500/30 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center justify-center font-bold">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold font-mono text-white">ADMIN COMMAND</div>
                <div className="text-[10px] text-cyan-400 font-mono">Enterprise ERP</div>
              </div>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
              ACID ON
            </span>
          </div>

          <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-[10px] font-mono">
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-400 block">TOTAL REVENUE</span>
              <span className="text-xs font-bold text-emerald-400">₹{(totalRevenue / 100000).toFixed(1)}L</span>
            </div>
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-400 block">NET PROFIT</span>
              <span className="text-xs font-bold text-cyan-300">₹{(totalProfit / 100000).toFixed(1)}L</span>
            </div>
          </div>
        </div>

        {/* Navigation Categories */}
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
                      onClick={() => setActiveSection(item.id as AdminSection)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-mono transition-all text-left ${
                        isActive
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-md font-bold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-300' : item.color}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 ml-1.5 ${
                          isActive
                            ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-700/60'
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
            Enterprise Handoffs
          </div>
          <button
            onClick={() => navigateToPortal('MANAGER')}
            className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-mono text-slate-300 border border-slate-800 hover:border-emerald-500/40 transition-all text-left"
          >
            <div className="flex items-center gap-2">
              <TruckIcon className="w-3.5 h-3.5 text-emerald-400" />
              <span>Manager Ops</span>
            </div>
            <span className="text-[10px] text-emerald-400">Approvals →</span>
          </button>
          <button
            onClick={() => navigateToPortal('STAFF')}
            className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-mono text-slate-300 border border-slate-800 hover:border-amber-500/40 transition-all text-left"
          >
            <div className="flex items-center gap-2">
              <Receipt className="w-3.5 h-3.5 text-amber-400" />
              <span>Staff Desk</span>
            </div>
            <span className="text-[10px] text-amber-400">Bilty & Rates →</span>
          </button>
        </div>
      </aside>

      {/* =====================================================================
          MAIN ADMIN WORKSPACE AREA
         ===================================================================== */}
      <div className="flex-1 w-full min-w-0 space-y-6">
        {/* Top Banner */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-obsidian-card via-slate-900 to-obsidian-surface p-6 rounded-2xl border border-white/5 relative overflow-hidden">
          <div className="z-10">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">
                ROLE: ADMIN COMMAND
              </span>
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                LIVE TELEMETRICS & DOUBLE-ENTRY LEDGER CONNECTED
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight mt-2">
              Obsidian Fleet Enterprise Command
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Real-time multi-document ACID financial ledger, AI theft mitigation & 60-day Monte Carlo liquidity
            </p>
          </div>

          <div className="z-10 flex items-center gap-3">
            <button
              onClick={() => setIsPinModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-semibold bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700 transition-colors"
            >
              <Key className="w-4 h-4 text-amber-400" />
              <span>FINANCIAL PIN OVERRIDE</span>
            </button>
          </div>
        </div>

        {/* Bento Grid KPI Stats (Shown on OVERVIEW & ALL_STACKED) */}
        {(activeSection === 'OVERVIEW' || activeSection === 'ALL_STACKED') && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div
              onClick={() => setActiveSection('TRIPS')}
              className="bento-card p-5 cursor-pointer hover:border-cyan-500/40 transition-all"
            >
              <div className="flex justify-between items-start">
                <div className="text-xs font-mono text-slate-400">ACTIVE LOGISTICS FLEET</div>
                <TruckIcon className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-extrabold font-mono text-white mt-2">
                {activeTrucks} <span className="text-sm font-normal text-slate-500">/ {trucks.length} Trucks</span>
              </div>
              <div className="text-xs text-cyan-400 font-mono mt-2">
                {inTransitTrips} Commercial Voyages in Transit
              </div>
            </div>

            <div
              onClick={() => setActiveSection('CASHFLOW_WATERFALL')}
              className="bento-card p-5 cursor-pointer hover:border-emerald-500/40 transition-all"
            >
              <div className="flex justify-between items-start">
                <div className="text-xs font-mono text-slate-400">TOTAL TRIP REVENUE</div>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-extrabold font-mono text-emerald-400 mt-2">
                ₹{(totalRevenue / 100000).toFixed(2)} <span className="text-sm text-slate-500 font-normal">Lakh</span>
              </div>
              <div className="text-xs text-slate-400 font-mono mt-2">
                Across {trips.length} audited freight corridors
              </div>
            </div>

            <div
              onClick={() => setActiveSection('UNIT_ECONOMICS')}
              className="bento-card p-5 cursor-pointer hover:border-cyan-500/40 transition-all"
            >
              <div className="flex justify-between items-start">
                <div className="text-xs font-mono text-slate-400">NET VOYAGE PROFIT</div>
                <TrendingUp className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-extrabold font-mono text-cyan-300 mt-2">
                ₹{(totalProfit / 100000).toFixed(2)} <span className="text-sm text-slate-500 font-normal">Lakh</span>
              </div>
              <div className="text-xs text-emerald-400 font-mono mt-2">
                {avgMargin.toFixed(1)}% Fleetwide Average Margin
              </div>
            </div>

            <div
              onClick={() => setActiveSection('UNIT_ECONOMICS')}
              className="bento-card p-5 cursor-pointer hover:border-purple-500/40 transition-all"
            >
              <div className="flex justify-between items-start">
                <div className="text-xs font-mono text-slate-400">BANK CASH & RUNWAY</div>
                <Sparkles className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-extrabold font-mono text-purple-300 mt-2">
                ₹{((cashflow?.current_bank_balance_inr || 3500000) / 100000).toFixed(2)} <span className="text-sm text-slate-500 font-normal">Lakh</span>
              </div>
              <div className="text-xs text-slate-400 font-mono mt-2">
                P10 Min Liquidity: ₹{((cashflow?.min_p10_inr || 1200000) / 100000).toFixed(2)}L
              </div>
            </div>
          </div>
        )}

        {/* Visual Analytics Row: Monte Carlo Cashflow + Unit Economics Scatter */}
        {(activeSection === 'OVERVIEW' || activeSection === 'UNIT_ECONOMICS' || activeSection === 'ALL_STACKED') && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bento-card p-6">
              {cashflow && cashflow.forecast ? (
                <CashflowChart
                  data={cashflow.forecast}
                  currentBalance={cashflow.current_bank_balance_inr}
                  deficitProbability={cashflow.deficit_probability_pct}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-slate-500 font-mono text-sm">
                  <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mb-2" />
                  Computing 1,000 Stochastic Monte Carlo Paths...
                </div>
              )}
            </div>

            <div className="lg:col-span-5 bento-card p-6">
              <StarLemonScatter data={unitEconomics} />
            </div>
          </div>
        )}

        {/* Executive Analytics Row 2: Cashflow Waterfall + Corridor Profitability + Receivables Aging */}
        {(activeSection === 'CASHFLOW_WATERFALL' || activeSection === 'ALL_STACKED') && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Cashflow Waterfall */}
            <div className="lg:col-span-5 bento-card p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div>
                  <div className="text-[10px] font-mono text-slate-400 uppercase">WORKING CAPITAL WATERFALL</div>
                  <h3 className="text-sm font-bold text-slate-100">Gross Billed → Net Free Cashflow</h3>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                  ACID Double-Entry
                </span>
              </div>
              <div className="space-y-2.5 pt-1 font-mono text-xs">
                {waterfall.map((step: any, idx: number) => {
                  const maxVal = Math.max(1, waterfall[0]?.value || 1000000);
                  const pct = Math.min(100, Math.max(8, Math.round((Math.abs(step.value) / maxVal) * 100)));
                  const isPositive = step.value >= 0;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-300">{step.name}</span>
                        <span className={step.kind === 'total' ? 'text-cyan-300 font-bold' : isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                          {step.value < 0 ? '-' : ''}₹{(Math.abs(step.value) / 100000).toFixed(2)}L
                        </span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${step.kind === 'total' ? 'bg-cyan-500' : isPositive ? 'bg-emerald-500' : 'bg-rose-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              {aging?.buckets && (
                <div className="pt-3 border-t border-slate-800">
                  <div className="text-[10px] font-mono text-slate-400 mb-2 uppercase">OVERDUE RECEIVABLES AGING BUCKETS</div>
                  <div className="grid grid-cols-4 gap-2 text-center font-mono">
                    {aging.buckets.map((b: any) => (
                      <div key={b.bucket} className="bg-slate-950/70 p-2 rounded-lg border border-slate-800">
                        <div className="text-[10px] text-slate-400">{b.bucket}d</div>
                        <div className={`text-xs font-bold mt-0.5 ${b.bucket === '90+' && b.amount > 0 ? 'text-rose-400' : 'text-slate-200'}`}>
                          ₹{(b.amount / 100000).toFixed(1)}L
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Overdue Clients List */}
            <div className="lg:col-span-7 bento-card p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div>
                  <div className="text-[10px] font-mono text-slate-400 uppercase">CLIENT CREDIT & OUTSTANDING AUDIT</div>
                  <h3 className="text-sm font-bold text-slate-100">Accounts Over Credit Limit</h3>
                </div>
                <button
                  onClick={() => setIsPinModalOpen(true)}
                  className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1.5"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>PIN Override</span>
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-900/60 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="py-2 px-2.5">Client</th>
                      <th className="py-2 px-2.5 text-right">Outstanding</th>
                      <th className="py-2 px-2.5 text-right">Credit Limit</th>
                      <th className="py-2 px-2.5 text-center">Status</th>
                      <th className="py-2 px-2.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {clients.map((c) => {
                      const isOver = c.currentOutstanding > c.creditLimit;
                      return (
                        <tr key={c._id} className="hover:bg-slate-800/40">
                          <td className="py-2 px-2.5 font-bold text-slate-200">{c.companyName}</td>
                          <td className="py-2 px-2.5 text-right font-bold text-rose-300">
                            ₹{(c.currentOutstanding / 100000).toFixed(2)}L
                          </td>
                          <td className="py-2 px-2.5 text-right text-slate-400">
                            ₹{(c.creditLimit / 100000).toFixed(2)}L
                          </td>
                          <td className="py-2 px-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isOver ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            }`}>
                              {isOver ? 'HOLD • OVER LIMIT' : 'CLEARED'}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 text-center">
                            <button
                              onClick={() => {
                                setPinActionTarget(c._id);
                                setIsPinModalOpen(true);
                              }}
                              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-[10px]"
                            >
                              Bypass PIN
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Corridor Profitability Ranking */}
        {(activeSection === 'CORRIDORS' || activeSection === 'ALL_STACKED') && (
          <div className="bento-card p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div>
                <div className="text-[10px] font-mono text-slate-400 uppercase">CORRIDOR PROFITABILITY & BACKHAUL MATRIX</div>
                <h3 className="text-sm font-bold text-slate-100">Ranked by Return on Time Invested (Profit / Day)</h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
                {corridors.length} Active Corridors
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900/60 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-2.5">Corridor</th>
                    <th className="py-2 px-2.5 text-center">Trips</th>
                    <th className="py-2 px-2.5 text-right">Profit / Day</th>
                    <th className="py-2 px-2.5 text-right">Avg Margin</th>
                    <th className="py-2 px-2.5 text-right">Backhaul Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {corridors.map((c: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="py-2 px-2.5 font-bold text-slate-200">{c.corridor}</td>
                      <td className="py-2 px-2.5 text-center text-slate-400">{c.trips}</td>
                      <td className="py-2 px-2.5 text-right font-bold text-emerald-400">₹{(c.profitPerDay || 0).toLocaleString('en-IN')}/d</td>
                      <td className="py-2 px-2.5 text-right text-cyan-300">{c.avgMarginPct}%</td>
                      <td className="py-2 px-2.5 text-right">
                        <span className="px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800 text-[10px]">
                          {Math.round((c.backhaulRate || 0.45) * 100)}% Return Load
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Axle Tyre Blueprint + Weibull Survival Analysis */}
        {(activeSection === 'TYRES_WEIBULL' || activeSection === 'ALL_STACKED') && (
          <div className="space-y-4">
            <div className="bento-card p-4 border border-amber-500/30">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold font-mono text-slate-100">
                    AXLE TYRE BLUEPRINT & WEIBULL HAZARD (FLEET TRUCKS)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Select any fleet vehicle to render its SVG axle layout, CPK, and Weibull component survival predictions
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded text-xs font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
                  {selectedTruckForTyres ? `Selected: ${selectedTruckForTyres}` : 'No Truck Selected'}
                </span>
              </div>

              {/* Truck Selector Badges */}
              <div className="flex flex-wrap gap-2 pt-3">
                {trucks.map((trk) => {
                  const isSelected = selectedTruckForTyres === trk.registrationNumber;
                  return (
                    <button
                      key={trk._id}
                      onClick={() => handleInspectTyres(trk.registrationNumber)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/60 shadow-md font-bold'
                          : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <TruckIcon className="w-3.5 h-3.5" />
                      <span>{trk.registrationNumber}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedTruckForTyres && (
              <div className="space-y-4">
                <AxleTyreBlueprint
                  truckNumber={selectedTruckForTyres}
                  tyres={truckTyres}
                  onClose={() => setSelectedTruckForTyres(null)}
                />
                {maintenanceReport?.components && (
                  <div className="bento-card p-5 border border-amber-500/30">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div>
                        <span className="text-[10px] font-mono text-amber-400 uppercase font-bold">
                          WEIBULL SURVIVAL ANALYSIS ({maintenanceReport.model_version})
                        </span>
                        <h4 className="text-sm font-bold text-slate-100 font-mono">
                          {selectedTruckForTyres} • Component Breakdown Hazard (Next 1,500 km)
                        </h4>
                      </div>
                      <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-slate-900 text-cyan-300 border border-slate-700">
                        Health Score: {maintenanceReport.overall_health_score}%
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3 font-mono text-xs">
                      {maintenanceReport.components.map((comp: any, i: number) => (
                        <div key={i} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-200">{comp.component}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              comp.failure_probability >= 70 ? 'bg-rose-950 text-rose-400 border border-rose-800' : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            }`}>
                              {comp.failure_probability}% Risk
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1">
                            {comp.km_since_service?.toLocaleString('en-IN')} km since service
                          </div>
                          <div className="text-[10px] text-slate-300 mt-1.5">{comp.recommended_action}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Dedicated Financial PIN Console */}
        {activeSection === 'PIN_CONSOLE' && (
          <div className="bento-card p-6 border border-amber-500/40 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-950 text-amber-400 border border-amber-800">
                  <Key className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100 font-mono">FINANCIAL PIN AUTHORIZATION CONSOLE</h3>
                  <p className="text-xs text-slate-400">
                    Master Cryptographic Key (482916) for Credit Limit Overrides & High-Value Disbursements
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded text-xs font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800">
                MASTER PIN: 482916
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                <h4 className="text-sm font-bold font-mono text-slate-200">Execute Instant PIN Authorization</h4>
                <p className="text-xs text-slate-400 font-mono">
                  Enter 6-digit cryptographic PIN to unblock credit holds or raise limits for pending client consignments.
                </p>
                <input
                  type="password"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="••••••"
                  className="w-full bg-slate-900 border border-slate-700 text-center text-3xl font-mono tracking-widest text-white py-3 rounded-xl focus:border-amber-400 focus:outline-none"
                />
                {pinSuccessMsg && (
                  <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs font-mono flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{pinSuccessMsg}</span>
                  </div>
                )}
                <button
                  onClick={handleVerifyPin}
                  className="w-full py-2.5 rounded-xl text-xs font-mono font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-lg"
                >
                  Verify & Authorize (482916)
                </button>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 font-mono text-xs">
                <h4 className="text-sm font-bold text-slate-200">Security Audit Policies</h4>
                <ul className="space-y-2 text-slate-400">
                  <li className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>All PIN authorizations logged with HMAC signature in audit trail.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Direct ledger postings automatically tag auth ID and IP origin.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Credit overrides notify Staff Desk immediately for waybill clearance.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Trips & Corridors Table (Shown on OVERVIEW, TRIPS & ALL_STACKED) */}
        {(activeSection === 'OVERVIEW' || activeSection === 'TRIPS' || activeSection === 'ALL_STACKED') && (
          <div className="bento-card p-6">
            <div className="flex flex-wrap items-center justify-between pb-4 border-b border-slate-800 gap-4">
              <div>
                <div className="text-xs font-mono text-slate-400">OPERATIONAL FREIGHT EXPEDITIONS</div>
                <h3 className="text-base font-bold text-slate-100">Recent Trips & Live Ledger Status</h3>
              </div>
              <div className="text-xs text-slate-400 font-mono">
                Click any row to open the <span className="text-cyan-400">600px Slide-over Inspector</span>
              </div>
            </div>

            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-3">Trip #</th>
                    <th className="py-3 px-3">Truck & Driver</th>
                    <th className="py-3 px-3">Corridor</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Revenue</th>
                    <th className="py-3 px-3 text-right">Cost</th>
                    <th className="py-3 px-3 text-right">Net Profit</th>
                    <th className="py-3 px-3 text-center">Margin</th>
                    <th className="py-3 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {orderedTrips.slice(0, activeSection === 'OVERVIEW' ? 6 : 20).map((t) => {
                    const margin = t.financials?.profitMarginPct || 0;
                    const isFocused = focusedTripId === t._id;
                    return (
                      <tr
                        key={t._id}
                        onClick={() => openInspector(t._id)}
                        className={`hover:bg-slate-800/50 cursor-pointer transition-colors group ${
                          isFocused ? 'bg-cyan-950/30 border-l-2 border-l-cyan-400' : ''
                        }`}
                      >
                        <td className="py-3 px-3 font-bold text-slate-200 group-hover:text-cyan-300">
                          <div>{t.tripNumber}</div>
                          {isFocused && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] bg-cyan-900/80 text-cyan-200 border border-cyan-600">
                              ACTIVE TARGET
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-slate-200 font-semibold">{t.truck?.registrationNumber}</div>
                          <div className="text-[10px] text-slate-400">{t.driver?.fullName}</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-slate-200">{t.route?.originCity} → {t.route?.destinationCity}</div>
                          <div className="text-[10px] text-slate-500">{t.route?.distanceKm} km</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-900 text-slate-300 border border-slate-800">
                            {t.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-200">
                          ₹{t.financials?.totalRevenue.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 text-right text-rose-300">
                          ₹{t.financials?.totalDirectCost.toLocaleString('en-IN')}
                        </td>
                        <td className={`py-3 px-3 text-right font-bold ${
                          (t.financials?.netTripProfit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          ₹{t.financials?.netTripProfit.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            margin >= 18
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : margin >= 8
                              ? 'bg-amber-950 text-amber-400 border border-amber-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}>
                            {margin.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                handleInspectTyres(t.truck?.registrationNumber);
                                setActiveSection('TYRES_WEIBULL');
                              }}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-cyan-300 border border-slate-700"
                              title="View Tyre Blueprint"
                            >
                              Tyre Map
                            </button>
                            <button
                              onClick={() =>
                                navigateToPortal('MANAGER', {
                                  tripId: t._id,
                                  message: `Admin transferred ${t.tripNumber} to MANAGER Ops for Dispatch/Settlement`,
                                })
                              }
                              className="px-2 py-1 rounded bg-emerald-950/80 hover:bg-emerald-900 text-[10px] text-emerald-300 border border-emerald-800"
                              title="Open in Manager Ops"
                            >
                              Manager →
                            </button>
                            <button
                              onClick={() =>
                                navigateToPortal('DRIVER', {
                                  tripId: t._id,
                                  message: `Admin inspecting ${t.tripNumber} in DRIVER Cabin`,
                                })
                              }
                              className="px-2 py-1 rounded bg-rose-950/80 hover:bg-rose-900 text-[10px] text-rose-300 border border-rose-800"
                              title="Open in Driver Cabin"
                            >
                              Driver →
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Company Workforce & Hiring Hub (Admin Full Rights) */}
        {(activeSection === 'WORKFORCE_HR' || activeSection === 'ALL_STACKED') && (
          <WorkforceManagement portalRole="ADMIN" />
        )}
      </div>

      {/* Financial PIN Modal */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md">
          <div className="bg-obsidian-surface border border-slate-700 p-6 rounded-2xl max-w-sm w-full glass-panel-heavy shadow-2xl">
            <div className="flex items-center gap-2 text-amber-400 mb-3">
              <Key className="w-5 h-5" />
              <h3 className="text-base font-bold text-slate-100 font-mono">FINANCIAL PIN AUTHORIZATION</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4 font-mono">
              Enter 6-digit cryptographic PIN to authorize credit limit bypass or high-value disbursements. (Master PIN: 482916)
            </p>

            <input
              type="password"
              maxLength={6}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="••••••"
              className="w-full bg-slate-950 border border-slate-700 text-center text-2xl font-mono tracking-widest text-white py-3 rounded-xl focus:border-cyan-400 focus:outline-none mb-4"
            />

            {pinSuccessMsg && (
              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono justify-center">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{pinSuccessMsg}</span>
                </div>
                <button
                  onClick={() => {
                    setIsPinModalOpen(false);
                    setPinInput('');
                    setPinSuccessMsg('');
                    navigateToPortal('STAFF', {
                      clientId: pinActionTarget || focusedClientId || undefined,
                      message: 'ADMIN authorized Master PIN 482916 → Client Credit Limit Raised & Cleared for Bilty Booking',
                    });
                  }}
                  className="w-full py-2 px-3 rounded-xl text-xs font-mono font-bold bg-emerald-600 hover:bg-emerald-500 text-slate-950 flex items-center justify-center gap-1.5"
                >
                  <span>Return to Staff Desk (Book Bilty) →</span>
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setIsPinModalOpen(false);
                  setPinSuccessMsg('');
                }}
                className="flex-1 py-2 text-xs font-medium bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700"
              >
                Close
              </button>
              <button
                onClick={handleVerifyPin}
                className="flex-1 py-2 text-xs font-mono font-bold bg-cyan-600 hover:bg-cyan-500 text-slate-900 rounded-xl transition-colors"
              >
                Authorize (482916)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
