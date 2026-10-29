import React, { useState } from 'react';
import { Tyre } from '../../types';
import { ShieldCheck, AlertTriangle, AlertCircle, RefreshCw, X } from 'lucide-react';

interface AxleTyreBlueprintProps {
  truckNumber: string;
  tyres: Tyre[];
  onClose?: () => void;
}

export const AxleTyreBlueprint: React.FC<AxleTyreBlueprintProps> = ({ truckNumber, tyres, onClose }) => {
  const [selectedPosition, setSelectedPosition] = useState<string | null>('FL');

  // Helper to find tyre for given position
  const getTyre = (pos: string) => tyres.find((t) => t.position === pos);

  const selectedTyre = selectedPosition ? getTyre(selectedPosition) : null;

  const getTreadColor = (treadMm: number) => {
    if (treadMm >= 8) return { stroke: '#10B981', fill: '#064E3B', label: 'HEALTHY', text: 'text-emerald-400' };
    if (treadMm >= 4) return { stroke: '#F59E0B', fill: '#78350F', label: 'WEAR DANGER', text: 'text-amber-400' };
    return { stroke: '#F43F5E', fill: '#881337', label: 'CRITICAL SCRAP', text: 'text-rose-400' };
  };

  const renderTyreSvg = (pos: string, x: number, y: number, label: string) => {
    const tyre = getTyre(pos);
    const isSelected = selectedPosition === pos;
    const treadMm = tyre ? tyre.currentTreadDepthMm : 10;
    const colors = getTreadColor(treadMm);

    return (
      <g
        className="cursor-pointer group transition-transform"
        onClick={() => setSelectedPosition(pos)}
      >
        {/* Glow if selected */}
        {isSelected && (
          <rect
            x={x - 4}
            y={y - 4}
            width="38"
            height="68"
            rx="8"
            fill="none"
            stroke="#22D3EE"
            strokeWidth="2"
            className="animate-pulse"
          />
        )}
        {/* Tyre Body */}
        <rect
          x={x}
          y={y}
          width="30"
          height="60"
          rx="6"
          fill={colors.fill}
          stroke={isSelected ? '#22D3EE' : colors.stroke}
          strokeWidth={isSelected ? '2.5' : '1.5'}
          className="transition-colors group-hover:brightness-125"
        />
        {/* Tread grooves */}
        <line x1={x + 4} y1={y + 12} x2={x + 26} y2={y + 12} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
        <line x1={x + 4} y1={y + 24} x2={x + 26} y2={y + 24} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
        <line x1={x + 4} y1={y + 36} x2={x + 26} y2={y + 36} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
        <line x1={x + 4} y1={y + 48} x2={x + 26} y2={y + 48} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
        {/* Position Label */}
        <text
          x={x + 15}
          y={y + 33}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#FFFFFF"
          fontSize="9"
          fontWeight="bold"
          fontFamily="monospace"
        >
          {label}
        </text>
      </g>
    );
  };

  return (
    <div className="bg-obsidian-surface border border-slate-700/60 rounded-2xl p-5 shadow-2xl glass-panel relative">
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-100 font-mono tracking-tight">
              {truckNumber} • AXLE & TYRE BLUEPRINT
            </h3>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-cyan-950/60 text-cyan-400 border border-cyan-800/50">
              6-WHEELER 4x2 RIGID
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time Laser Tread Depth, Telemetric PSI & Wear Lifecycle Map
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Left: Interactive Top-down SVG Truck Chassis */}
        <div className="md:col-span-7 flex justify-center bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 relative">
          <svg width="280" height="380" viewBox="0 0 280 380" className="select-none">
            {/* Chassis Outline */}
            <rect x="70" y="30" width="140" height="300" rx="16" fill="#141724" stroke="#334155" strokeWidth="2" />
            {/* Cabin glass front */}
            <path d="M 85 45 Q 140 35 195 45 L 185 85 Q 140 80 95 85 Z" fill="#1E293B" stroke="#475569" strokeWidth="1.5" />
            <text x="140" y="66" textAnchor="middle" fill="#64748B" fontSize="9" fontWeight="bold" fontFamily="monospace">
              CABIN / STEER
            </text>

            {/* Front Axle */}
            <line x1="45" y1="90" x2="235" y2="90" stroke="#475569" strokeWidth="4" />
            {/* Rear Drive Axle */}
            <line x1="30" y1="280" x2="250" y2="280" stroke="#475569" strokeWidth="5" />
            {/* Differential Gearbox */}
            <circle cx="140" cy="280" r="14" fill="#0F172A" stroke="#64748B" strokeWidth="2" />

            {/* FRONT AXLE (Steer) */}
            {renderTyreSvg('FL', 30, 60, 'FL')}
            {renderTyreSvg('FR', 220, 60, 'FR')}

            {/* REAR AXLE (Drive Duals) */}
            {renderTyreSvg('RLO', 20, 250, 'RLO')}
            {renderTyreSvg('RLI', 55, 250, 'RLI')}
            {renderTyreSvg('RRI', 195, 250, 'RRI')}
            {renderTyreSvg('RRO', 230, 250, 'RRO')}

            {/* STEPNEY (Spare tyre mounted mid-chassis) */}
            {renderTyreSvg('STEPNEY', 125, 140, 'SP')}
          </svg>
        </div>

        {/* Right: Selected Tyre Deep Diagnostic Card */}
        <div className="md:col-span-5 flex flex-col justify-between h-full bg-slate-900/80 p-5 rounded-xl border border-slate-800">
          {selectedTyre ? (
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <span className="text-[10px] uppercase font-mono text-cyan-400 font-semibold tracking-wider">
                    Position {selectedPosition}
                  </span>
                  <h4 className="text-base font-bold font-mono text-slate-100">
                    {selectedTyre.serialNumber}
                  </h4>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold uppercase border ${
                  selectedTyre.currentTreadDepthMm >= 8 
                    ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60'
                    : selectedTyre.currentTreadDepthMm >= 4
                    ? 'bg-amber-950/80 text-amber-400 border-amber-800/60'
                    : 'bg-rose-950/80 text-rose-400 border-rose-800/60'
                }`}>
                  {selectedTyre.currentTreadDepthMm >= 8 ? 'IN SPEC' : selectedTyre.currentTreadDepthMm >= 4 ? 'WEAR WARNING' : 'SCRAP DUE'}
                </span>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 gap-3 my-4">
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                  <div className="text-[10px] text-slate-400 font-mono">BRAND & SIZE</div>
                  <div className="text-xs font-semibold text-slate-200 mt-0.5">{selectedTyre.brand} {selectedTyre.model}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{selectedTyre.size}</div>
                </div>

                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                  <div className="text-[10px] text-slate-400 font-mono">TELEMETRY</div>
                  <div className="text-xs font-bold font-mono text-cyan-300 mt-0.5">{selectedTyre.psi || 118} PSI</div>
                  <div className="text-[10px] text-slate-400 font-mono">{selectedTyre.temperatureC || 34}°C Normal</div>
                </div>

                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                  <div className="text-[10px] text-slate-400 font-mono">MILEAGE RUN</div>
                  <div className="text-xs font-bold font-mono text-slate-200 mt-0.5">{(selectedTyre.totalKmRun || 32000).toLocaleString('en-IN')} km</div>
                </div>

                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                  <div className="text-[10px] text-slate-400 font-mono">ORIGINAL VALUE</div>
                  <div className="text-xs font-bold font-mono text-slate-200 mt-0.5">₹{(selectedTyre.cost || 22500).toLocaleString('en-IN')}</div>
                </div>
              </div>

              {/* Tread Depth Gauge Bar */}
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 mb-4">
                <div className="flex justify-between text-xs font-mono mb-1.5">
                  <span className="text-slate-400">Current Tread Depth:</span>
                  <span className="font-bold text-slate-100">
                    {selectedTyre.currentTreadDepthMm} mm / {selectedTyre.originalTreadDepthMm} mm
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      selectedTyre.currentTreadDepthMm >= 8 ? 'bg-emerald-500' : selectedTyre.currentTreadDepthMm >= 4 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(100, (selectedTyre.currentTreadDepthMm / selectedTyre.originalTreadDepthMm) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                  <span>0 mm (Condemned)</span>
                  <span>4 mm (Retread Min)</span>
                  <span>{selectedTyre.originalTreadDepthMm} mm (New)</span>
                </div>
              </div>

              {/* Recommended Action */}
              <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/50 flex items-start gap-2 text-xs text-slate-300">
                <RefreshCw className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  {selectedTyre.currentTreadDepthMm < 4
                    ? 'Rotate to dummy axle or send to Bandag retreading vendor immediately.'
                    : selectedTyre.currentTreadDepthMm < 7
                    ? 'Scheduled rotation due at next 10,000 km depot maintenance service.'
                    : 'Optimal wear pattern detected across outer tread shoulders.'}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500 text-sm">
              <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
              <span>Select a tyre position on the chassis to inspect</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
