import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { tripsApi, aiApi } from '../../api/client';
import { Trip, FuelAnomaly } from '../../types';
import { X, Truck, Calendar, MapPin, Fuel, ShieldAlert, CheckCircle2, AlertTriangle, ArrowRight, DollarSign } from 'lucide-react';

export const TripInspectorDrawer: React.FC = () => {
  const { isInspectorOpen, closeInspector, selectedTripId, navigateToPortal } = useAuthStore();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [anomaly, setAnomaly] = useState<FuelAnomaly | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);

  useEffect(() => {
    if (isInspectorOpen && selectedTripId) {
      loadTripDetails(selectedTripId);
    } else {
      setTrip(null);
      setAnomaly(null);
    }
  }, [isInspectorOpen, selectedTripId]);

  const loadTripDetails = async (id: string) => {
    setIsLoading(true);
    try {
      const data = await tripsApi.getTrip(id);
      setTrip(data);
      // Auto-run AI audit for high-priority inspection
      runAiFuelAudit(id);
    } catch (err) {
      console.error('Failed to load trip', err);
    } finally {
      setIsLoading(false);
    }
  };

  const runAiFuelAudit = async (tripId: string) => {
    setIsAuditing(true);
    try {
      const auditResult = await aiApi.auditFuel(tripId);
      setAnomaly(auditResult);
    } catch (err) {
      console.error('AI audit failed', err);
    } finally {
      setIsAuditing(false);
    }
  };

  if (!isInspectorOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-[620px] h-full bg-obsidian-surface border-l border-slate-800 glass-panel-heavy shadow-2xl flex flex-col transform transition-transform duration-300">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-950/70 border border-cyan-800/60 text-cyan-400">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100 font-mono">
                  {trip?.tripNumber || selectedTripId}
                </h3>
                {trip && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono uppercase bg-slate-800 text-slate-300 border border-slate-700">
                    {trip.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                {trip?.client?.companyName} • {trip?.truck?.registrationNumber}
              </p>
            </div>
          </div>
          <button
            onClick={closeInspector}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading || !trip ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mb-3" />
              <span className="text-sm font-mono">Loading Real-Time Trip Telemetry & Ledger...</span>
            </div>
          ) : (
            <>
              {/* Route & Distance Card */}
              <div className="bento-card p-4 bg-slate-900/60">
                <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-3">
                  <span>CORRIDOR LOGISTICS</span>
                  <span>{trip.route.distanceKm} km transit</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-cyan-400" />
                    <div>
                      <div className="text-sm font-bold text-slate-200">{trip.route.originCity}</div>
                      <div className="text-[10px] text-slate-500">{trip.route.originState}</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-500" />
                  <div className="flex items-center gap-2 text-right">
                    <div>
                      <div className="text-sm font-bold text-slate-200">{trip.route.destinationCity}</div>
                      <div className="text-[10px] text-slate-500">{trip.route.destinationState}</div>
                    </div>
                    <MapPin className="w-4 h-4 text-emerald-400" />
                  </div>
                </div>
              </div>

              {/* AI Fuel Audit Anomaly Banner */}
              {anomaly && (
                <div className={`p-4 rounded-xl border ${
                  anomaly.is_theft_anomaly 
                    ? 'bg-rose-950/40 border-rose-500/50 shadow-glow-rose'
                    : 'bg-emerald-950/30 border-emerald-500/40'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className={`w-5 h-5 ${anomaly.is_theft_anomaly ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`} />
                      <h4 className="text-sm font-bold font-mono tracking-wide">
                        {anomaly.is_theft_anomaly ? 'AI FUEL THEFT ANOMALY DETECTED' : 'FUEL AUDIT: WITHIN NORMAL PHYSICS SPEC'}
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700">
                      Isolation Forest (Score: {anomaly.model_score.toFixed(3)})
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-800 font-mono text-center">
                    <div>
                      <div className="text-[10px] text-slate-400">EXPECTED KMPL</div>
                      <div className="text-xs font-bold text-slate-200">{anomaly.expected_kmpl.toFixed(2)} km/L</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">ACTUAL KMPL</div>
                      <div className={`text-xs font-bold ${anomaly.is_theft_anomaly ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {anomaly.actual_kmpl.toFixed(2)} km/L
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">SIPHON LOSS</div>
                      <div className={`text-xs font-bold ${anomaly.is_theft_anomaly ? 'text-rose-400' : 'text-slate-400'}`}>
                        {anomaly.is_theft_anomaly ? `₹${Math.round(anomaly.estimated_theft_loss_inr).toLocaleString('en-IN')}` : '₹0'}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 mt-3 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                    <span className="font-semibold text-cyan-300">Action:</span> {anomaly.recommendation}
                  </p>
                </div>
              )}

              {/* Deep Financial P&L Breakdown */}
              <div className="bento-card p-5 bg-slate-900/70 border-slate-800">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold font-mono tracking-wider text-slate-300 uppercase">
                      Trip Profit & Loss (ACID Ledger)
                    </h4>
                  </div>
                  <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                    trip.financials.profitMarginPct >= 18
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : trip.financials.profitMarginPct >= 8
                      ? 'bg-amber-950 text-amber-400 border border-amber-800'
                      : 'bg-rose-950 text-rose-400 border border-rose-800'
                  }`}>
                    {trip.financials.profitMarginPct.toFixed(1)}% Margin
                  </span>
                </div>

                <div className="space-y-2 mt-4 text-xs font-mono">
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Agreed Freight Billing:</span>
                    <span className="font-bold text-slate-200">₹{trip.financials.grossFreightAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60 text-slate-400">
                    <span>Detention / Loading Charges:</span>
                    <span>+₹{(trip.financials.detentionCharges + trip.financials.loadingCharges).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between py-1.5 font-bold text-slate-100 bg-slate-950/40 px-2 rounded">
                    <span>Total Net Revenue:</span>
                    <span className="text-emerald-400">₹{trip.financials.totalRevenue.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="pt-2 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                    Direct Operational Costs:
                  </div>
                  <div className="flex justify-between py-1 text-slate-400">
                    <span>Diesel Refueling:</span>
                    <span className="text-rose-300">-₹{trip.financials.dieselExpenses.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-400">
                    <span>FASTag Tolls:</span>
                    <span className="text-rose-300">-₹{trip.financials.tollExpenses.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-400">
                    <span>Driver Advance Given:</span>
                    <span className="text-rose-300">-₹{trip.financials.driverAdvanceGiven.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between py-1.5 font-bold text-slate-100 bg-slate-950/40 px-2 rounded">
                    <span>Total Direct Operating Cost:</span>
                    <span className="text-rose-400">-₹{trip.financials.totalDirectCost.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="flex justify-between py-2.5 font-bold text-sm bg-slate-800/50 px-3 rounded-lg border border-slate-700/60 mt-3">
                    <span className="text-slate-200">NET VOYAGE PROFIT:</span>
                    <span className={trip.financials.netTripProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      ₹{trip.financials.netTripProfit.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Trip Expenses Log Table */}
              <div className="bento-card p-4 bg-slate-900/60">
                <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-3">
                  Expense & FASTag Vouchers ({trip.expenses?.length || 0})
                </h4>
                {trip.expenses && trip.expenses.length > 0 ? (
                  <div className="divide-y divide-slate-800/60 max-h-48 overflow-y-auto">
                    {trip.expenses.map((exp, idx) => (
                      <div key={idx} className="py-2 flex items-center justify-between text-xs font-mono">
                        <div>
                          <div className="text-slate-200 font-semibold">{exp.category} • {exp.paymentMode}</div>
                          <div className="text-[10px] text-slate-500">
                            {exp.fuelStation || exp.tollPlazaName || exp.remarks || 'General voucher'} • {new Date(exp.date).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-slate-200">₹{exp.amount.toLocaleString('en-IN')}</div>
                          {exp.litres && <div className="text-[10px] text-cyan-400">{exp.litres} L @ ₹{exp.ratePerLitre}/L</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 py-4 text-center font-mono">
                    No individual expense vouchers filed yet.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/90 space-y-3">
          {trip && (
            <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
              <span className="text-slate-400">Cross-Portal Jump:</span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => {
                    closeInspector();
                    navigateToPortal('STAFF', {
                      truckNumber: trip.truck?.registrationNumber,
                      message: `Inspecting ${trip.truck?.registrationNumber} axle tyres & waybill in STAFF Desk`,
                    });
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-800"
                >
                  Staff Tyres →
                </button>
                <button
                  onClick={() => {
                    closeInspector();
                    navigateToPortal('MANAGER', {
                      tripId: trip._id,
                      message: `Inspecting ${trip.tripNumber} in MANAGER Dispatch Console`,
                    });
                  }}
                  className="px-2.5 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800"
                >
                  Manager Ops →
                </button>
                <button
                  onClick={() => {
                    closeInspector();
                    navigateToPortal('DRIVER', {
                      tripId: trip._id,
                      message: `Opened ${trip.tripNumber} in DRIVER Cabin Console`,
                    });
                  }}
                  className="px-2.5 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800"
                >
                  Driver Cabin →
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={() => trip && runAiFuelAudit(trip._id)}
              disabled={isAuditing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-semibold bg-purple-950/60 text-purple-300 border border-purple-800/60 hover:bg-purple-900/50 transition-colors"
            >
              <ShieldAlert className="w-4 h-4 text-purple-400" />
              <span>{isAuditing ? 'Auditing Telematics...' : 'Re-Run Isolation Forest'}</span>
            </button>

            <button
              onClick={closeInspector}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Close Inspector
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
