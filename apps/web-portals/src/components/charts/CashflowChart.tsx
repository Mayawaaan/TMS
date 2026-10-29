import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid } from 'recharts';
import { CashflowPoint } from '../../types';

interface CashflowChartProps {
  data: CashflowPoint[];
  currentBalance: number;
  deficitProbability: number;
}

export const CashflowChart: React.FC<CashflowChartProps> = ({ data, currentBalance, deficitProbability }) => {
  const formattedData = data.map((d) => ({
    ...d,
    dayLabel: `Day ${d.day}`,
    p10Lakh: Number((d.p10_inr / 100000).toFixed(2)),
    p50Lakh: Number((d.p50_inr / 100000).toFixed(2)),
    p90Lakh: Number((d.p90_inr / 100000).toFixed(2)),
  }));

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between pb-4 mb-2 border-b border-slate-800">
        <div>
          <div className="text-xs font-mono text-slate-400">LIQUIDITY RUNWAY (60-DAY MONTE CARLO)</div>
          <div className="text-sm font-semibold text-slate-100 mt-0.5">
            Current Bank Cash: <span className="font-mono text-emerald-400">₹{(currentBalance / 100000).toFixed(2)} Lakh</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${
            deficitProbability > 20
              ? 'bg-rose-950/80 text-rose-300 border-rose-800/80 shadow-glow-rose'
              : deficitProbability > 5
              ? 'bg-amber-950/80 text-amber-300 border-amber-800/80'
              : 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80'
          }`}>
            Deficit Risk: {deficitProbability.toFixed(1)}%
          </span>
          <span className="text-[11px] font-mono text-purple-400 bg-purple-950/40 px-2 py-1 rounded border border-purple-800/40">
            1,000 Stochastic Iterations
          </span>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="p90Grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="p50Grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="p10Grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="dayLabel" stroke="#64748B" fontSize={11} tickLine={false} />
            <YAxis
              stroke="#64748B"
              fontSize={11}
              tickLine={false}
              tickFormatter={(v) => `₹${v}L`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#11131C',
                borderColor: 'rgba(255,255,255,0.1)',
                borderRadius: '0.75rem',
                fontSize: '12px',
                fontFamily: 'monospace',
              }}
              formatter={(val: any, name: string) => [`₹${val} Lakh`, name === 'p90Lakh' ? 'P90 (Optimistic)' : name === 'p50Lakh' ? 'P50 (Median)' : 'P10 (Stress)'] as [string, string]}
            />
            <ReferenceLine y={0} stroke="#EF4444" strokeDasharray="3 3" label={{ value: '0 DEFICIT', fill: '#EF4444', fontSize: 10, position: 'right' }} />
            <Area type="monotone" dataKey="p90Lakh" stroke="#8B5CF6" strokeWidth={1.5} fillOpacity={1} fill="url(#p90Grad)" />
            <Area type="monotone" dataKey="p50Lakh" stroke="#06B6D4" strokeWidth={2.5} fillOpacity={1} fill="url(#p50Grad)" />
            <Area type="monotone" dataKey="p10Lakh" stroke="#F43F5E" strokeWidth={1.5} strokeDasharray="2 2" fillOpacity={1} fill="url(#p10Grad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-center gap-6 mt-3 text-xs font-mono text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-purple-500 inline-block" />
          <span>P90 (Optimistic 90th percentile)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-1 bg-cyan-400 inline-block" />
          <span className="text-cyan-300 font-semibold">P50 (Expected Median Path)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 border-b border-dashed border-rose-500 inline-block" />
          <span className="text-rose-400">P10 (Pessimistic Stress Test)</span>
        </div>
      </div>
    </div>
  );
};
