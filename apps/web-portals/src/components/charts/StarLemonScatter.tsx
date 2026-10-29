import React from 'react';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Cell } from 'recharts';

interface TruckEconomics {
  truckNumber: string;
  totalKm: number;
  totalRevenue: number;
  totalProfit: number;
  profitMarginPct: number;
  category: 'STAR' | 'WORKHORSE' | 'LEMON';
}

interface StarLemonScatterProps {
  data: TruckEconomics[];
}

export const StarLemonScatter: React.FC<StarLemonScatterProps> = ({ data }) => {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-800">
        <div>
          <div className="text-xs font-mono text-slate-400">FLEET UNIT ECONOMICS QUADRANT</div>
          <div className="text-sm font-semibold text-slate-100">Star vs Lemon Truck Classification</div>
        </div>
        <div className="flex gap-2">
          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
            ★ Star Fleet
          </span>
          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-rose-950 text-rose-300 border border-rose-800">
            ⚠ Lemon Assets
          </span>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              type="number"
              dataKey="totalKm"
              name="Distance Run (km)"
              stroke="#64748B"
              fontSize={11}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k km`}
            />
            <YAxis
              type="number"
              dataKey="profitMarginPct"
              name="Net Margin %"
              stroke="#64748B"
              fontSize={11}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{
                backgroundColor: '#11131C',
                borderColor: 'rgba(255,255,255,0.1)',
                borderRadius: '0.75rem',
                fontSize: '12px',
                fontFamily: 'monospace',
              }}
              formatter={(value: any, name: string) => [
                name === 'Distance Run (km)' ? `${value.toLocaleString()} km` : `${value}%`,
                name
              ]}
            />
            <ReferenceLine y={18} stroke="#10B981" strokeDasharray="3 3" label={{ value: '18% Target', fill: '#10B981', fontSize: 10 }} />
            <ReferenceLine y={0} stroke="#EF4444" strokeDasharray="3 3" label={{ value: '0% Break-even', fill: '#EF4444', fontSize: 10 }} />
            <Scatter name="Trucks" data={data}>
              {data.map((entry, index) => {
                let color = '#06B6D4'; // Star
                if (entry.profitMarginPct < 5) color = '#F43F5E'; // Lemon
                else if (entry.profitMarginPct < 18) color = '#F59E0B'; // Workhorse
                return <Cell key={`cell-${index}`} fill={color} />;
              })}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
