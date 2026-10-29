import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { fleetApi, businessApi, tripsApi, aiApi, payrollApi } from '../../api/client';
import { Truck, Client, Tyre, Trip } from '../../types';
import { AxleTyreBlueprint } from '../../components/visualizers/AxleTyreBlueprint';
import { WorkforceManagement } from '../../components/WorkforceManagement';
import {
  FileText,
  Disc,
  AlertTriangle,
  Plus,
  Search,
  CheckCircle,
  Sparkles,
  ArrowRight,
  Printer,
  Receipt,
  Fuel,
  ShieldAlert,
  Wrench,
  UserCheck,
  Building2,
  Cpu,
  Layers,
  Clock,
  CheckCircle2,
  RefreshCw,
  LayoutDashboard,
  Truck as TruckIcon,
  ChevronRight,
  Users,
} from 'lucide-react';

type StaffTab =
  | 'OVERVIEW'
  | 'ALL'
  | 'BILTY_RECEIPTS'
  | 'VOUCHER_RECEIPTS'
  | 'CHALLAN_RAISER'
  | 'TYRE_WEIBULL'
  | 'ATTENDANCE_CREDIT'
  | 'DRIVER_ONBOARDING';

export const StaffPortal: React.FC = () => {
  const { navigateToPortal, focusedTruckNumber, focusedTripId, focusedClientId, setFocusedTripId } = useAuthStore();

  // Active workspace filter tab (defaults to OVERVIEW for clean layout)
  const [activeTab, setActiveTab] = useState<StaffTab>('OVERVIEW');

  // Master data state
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [fuelSlips, setFuelSlips] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>({});
  const [advances, setAdvances] = useState<any[]>([]);
  const [complianceItems, setComplianceItems] = useState<any[]>([]);
  const [challanBills, setChallanBills] = useState<any[]>([]);

  // Truck, Tyres & Weibull AI state
  const [selectedTruckNumber, setSelectedTruckNumber] = useState<string>(focusedTruckNumber || 'MH-04-GP-2819');
  const [tyres, setTyres] = useState<Tyre[]>([]);
  const [weibullReport, setWeibullReport] = useState<any>(null);
  const [searchTruck, setSearchTruck] = useState('');

  // Dynamic Freight Rate & Margin Predictor + Bilty Booking State
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [material, setMaterial] = useState('FMCG Consumer Goods');
  const [quoteOrigin, setQuoteOrigin] = useState('Indore');
  const [quoteDest, setQuoteDest] = useState('Mumbai');
  const [quoteDist, setQuoteDist] = useState('585');
  const [quoteWeight, setQuoteWeight] = useState('24');
  const [customRatePerTon, setCustomRatePerTon] = useState<string>('2680');
  const [haltingChargesInput, setHaltingChargesInput] = useState('1500');
  const [driverAdvanceInput, setDriverAdvanceInput] = useState('12000');
  const [onWayTollAllowance, setOnWayTollAllowance] = useState('4560');
  const [isLiveDraftReceipt, setIsLiveDraftReceipt] = useState<boolean>(true);
  const [quoteResult, setQuoteResult] = useState<any>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [bookedTrip, setBookedTrip] = useState<any>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Active Billing Receipt Preview State
  const [receiptTrip, setReceiptTrip] = useState<any>(null);

  // Smart Fuel Slip & Voucher Generator State
  const [fuelTripId, setFuelTripId] = useState<string>('');
  const [fuelPumpId, setFuelPumpId] = useState<string>('');
  const [fuelLiters, setFuelLiters] = useState('165');
  const [fuelRate, setFuelRate] = useState('92.50');
  const [fuelOdo, setFuelOdo] = useState('94520');
  const [fuelPaymentMode, setFuelPaymentMode] = useState<'PUMP_CREDIT' | 'FLEET_CARD' | 'CASH'>('PUMP_CREDIT');
  const [fuelSlipMsg, setFuelSlipMsg] = useState<string | null>(null);
  const [fuelAuditResult, setFuelAuditResult] = useState<any>(null);
  const [isAuditingFuel, setIsAuditingFuel] = useState(false);

  // RTO Fitness, Challans & Workshop Maintenance Bill Raiser State
  const [maintComponent, setMaintComponent] = useState<
    | 'RTO_FITNESS'
    | 'NATIONAL_PERMIT'
    | 'STATE_TAX_CHALLAN'
    | 'OVERLOAD_CHALLAN'
    | 'PUC_INSURANCE'
    | 'BRAKE_PAD'
    | 'CLUTCH_PLATE'
    | 'ENGINE_OIL'
    | 'TYRE'
    | 'GENERAL'
  >('RTO_FITNESS');
  const [maintType, setMaintType] = useState<'SCHEDULED' | 'BREAKDOWN'>('SCHEDULED');
  const [maintDesc, setMaintDesc] = useState('RTO Annual Fitness Certificate (Form 38) & Track Inspection Fee');
  const [maintCost, setMaintCost] = useState('4500');
  const [challanRefNo, setChallanRefNo] = useState('ECHL-MH04-88412');
  const [challanAuthority, setChallanAuthority] = useState('RTO Thane / NH-3 Sendhwa Border Checkpost');
  const [maintMsg, setMaintMsg] = useState<string | null>(null);
  const [raisedChallanBill, setRaisedChallanBill] = useState<any>(null);

  const todayIso = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    loadStaffData();
    handleRunQuote();
  }, []);

  useEffect(() => {
    if (focusedTruckNumber) {
      setSelectedTruckNumber(focusedTruckNumber);
    }
  }, [focusedTruckNumber]);

  useEffect(() => {
    if (focusedClientId) {
      setSelectedClientId(focusedClientId);
    }
  }, [focusedClientId]);

  useEffect(() => {
    if (selectedTruckNumber) {
      loadTruckTyresAndWeibull(selectedTruckNumber);
    }
  }, [selectedTruckNumber]);

  const loadStaffData = async () => {
    try {
      const [
        trucksData,
        clientsData,
        tripsData,
        vendorsData,
        slipsData,
        empData,
        attData,
        advData,
        compData,
        maintData,
      ] = await Promise.all([
        fleetApi.getTrucks(),
        businessApi.getClients(),
        tripsApi.getTrips(),
        businessApi.getVendors().catch(() => []),
        tripsApi.getFuelSlips().catch(() => []),
        payrollApi.getEmployees().catch(() => []),
        payrollApi.getAttendance(todayIso).catch(() => []),
        payrollApi.getAdvances().catch(() => []),
        fleetApi.getComplianceWatchdog().catch(() => []),
        fleetApi.getMaintenance().catch(() => []),
      ]);

      setTrucks(trucksData || []);
      setClients(clientsData || []);
      setTrips(tripsData || []);
      setVendors(vendorsData || []);
      setFuelSlips(slipsData || []);
      setEmployees(empData || []);
      setAdvances(advData || []);
      setComplianceItems(compData || []);
      setChallanBills(maintData || []);

      const attRecord: Record<string, string> = {};
      (attData || []).forEach((a: any) => {
        const empId = a.employee?._id || a.employee;
        if (empId) attRecord[empId] = a.status;
      });
      setAttendanceMap(attRecord);

      if (trucksData && trucksData.length > 0 && !focusedTruckNumber) {
        setSelectedTruckNumber(trucksData[0].registrationNumber);
      }
      if (clientsData && clientsData.length > 0 && !focusedClientId) {
        const clearedClient = clientsData.find((c: any) => c.currentOutstanding <= c.creditLimit) || clientsData[0];
        setSelectedClientId(clearedClient._id);
      }
      if (tripsData && tripsData.length > 0) {
        const target = focusedTripId ? tripsData.find((t: any) => t._id === focusedTripId) || tripsData[0] : tripsData[0];
        setReceiptTrip(target);
        setFuelTripId(target._id);
      }
      const pumps = (vendorsData || []).filter((v: any) => v.type === 'PETROL_PUMP');
      if (pumps.length > 0) {
        setFuelPumpId(pumps[0]._id);
      }
    } catch (err) {
      console.error('Failed to load staff data', err);
    }
  };

  const loadTruckTyresAndWeibull = async (reg: string) => {
    try {
      const [tyresData, weibull] = await Promise.all([
        fleetApi.getTyres(reg),
        aiApi.predictMaintenance(reg).catch(() => null),
      ]);
      setTyres(tyresData || []);
      setWeibullReport(weibull);
    } catch (err) {
      console.error('Failed to load tyres/weibull', err);
    }
  };

  const handleRunQuote = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsQuoting(true);
    setIsLiveDraftReceipt(true);
    try {
      const q = await aiApi.getOptimalRate({
        origin: quoteOrigin,
        destination: quoteDest,
        distance_km: Number(quoteDist) || 585,
        weight_tons: Number(quoteWeight) || 24,
      });
      setQuoteResult(q);
      if (q?.optimal_rate_per_ton || q?.recommended_optimal_rate_per_ton) {
        setCustomRatePerTon(String(q.optimal_rate_per_ton || q.recommended_optimal_rate_per_ton));
      }
      if (q?.cost_breakdown?.fastag_toll_inr) {
        setOnWayTollAllowance(String(q.cost_breakdown.fastag_toll_inr));
      }
    } catch (err) {
      console.error('Quote prediction failed', err);
    } finally {
      setIsQuoting(false);
    }
  };

  const handleBookBilty = async (overridePin?: string) => {
    if (!selectedClientId) return;
    setIsBooking(true);
    setBookingError(null);
    try {
      const ratePerTon =
        Number(customRatePerTon) ||
        quoteResult?.optimal_rate_per_ton ||
        quoteResult?.recommended_optimal_rate_per_ton ||
        2450;
      const advancePaid = Number(driverAdvanceInput) || 12000;
      const selectedTruckObj = trucks.find((t) => t.registrationNumber === selectedTruckNumber) || trucks[0];
      const newTrip = await tripsApi.createTrip(
        {
          client: selectedClientId,
          origin: quoteOrigin,
          destination: quoteDest,
          distanceKm: Number(quoteDist) || 585,
          weightTons: Number(quoteWeight) || 24,
          ratePerTon: Number(ratePerTon),
          haltingCharges: Number(haltingChargesInput) || 0,
          material,
          financialPin: overridePin,
        },
        overridePin
      );
      if (newTrip?._id && selectedTruckObj?._id) {
        await tripsApi
          .updateStatus(newTrip._id, 'ASSIGNED', `Assigned ${selectedTruckObj.registrationNumber} from Staff Desk`)
          .catch(() => null);
      }
      setBookedTrip(newTrip);
      if (newTrip?._id) {
        setFocusedTripId(newTrip._id);
      }
      await loadStaffData();
      // Set newly booked trip as active receipt
      const clientObj = clients.find((c) => c._id === selectedClientId);
      setIsLiveDraftReceipt(false);
      setReceiptTrip({
        ...newTrip,
        tripNumber: newTrip.lrNumber || newTrip.tripNumber,
        weightTons: Number(quoteWeight) || 24,
        ratePerTon: Number(ratePerTon),
        material,
        client: {
          _id: clientObj?._id,
          companyName: clientObj?.companyName || 'Corporate Client',
          gstin: clientObj?.gstin || '23AAACI1234F1Z1',
          gstMode: (clientObj as any)?.gstMode || 'RCM_5',
        },
        truck: {
          registrationNumber: selectedTruckNumber,
        },
        driver: {
          fullName: 'Assigned Fleet Captain',
        },
        route: {
          originCity: quoteOrigin,
          destinationCity: quoteDest,
          distanceKm: Number(quoteDist) || 585,
        },
        financials: {
          grossFreightAmount: Math.round((Number(quoteWeight) || 24) * Number(ratePerTon)),
          detentionCharges: Number(haltingChargesInput) || 0,
          totalRevenue: Math.round((Number(quoteWeight) || 24) * Number(ratePerTon)) + (Number(haltingChargesInput) || 0),
          driverAdvanceGiven: advancePaid,
        },
      });
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to create Bilty';
      setBookingError(msg);
    } finally {
      setIsBooking(false);
    }
  };

  const handleCreateFuelSlip = async (e: React.FormEvent) => {
    e.preventDefault();
    const truckObj = trucks.find((t) => t.registrationNumber === selectedTruckNumber) || trucks[0];
    if (!truckObj) return;
    try {
      const slip = await tripsApi.createFuelSlip({
        trip: fuelTripId || undefined,
        truck: truckObj._id,
        pump: fuelPumpId || undefined,
        liters: Number(fuelLiters) || 150,
        ratePerLiter: Number(fuelRate) || 92.5,
        odometer: Number(fuelOdo) || 94500,
        location: `${quoteOrigin} Highway Pump`,
        paymentMode: fuelPaymentMode,
        slipNo: `FSLIP-${Date.now().toString().slice(-5)}`,
      });
      setFuelSlipMsg(`Fuel Receipt ${slip.slipNo || 'Issued'} (₹${Math.round((Number(fuelLiters) || 150) * (Number(fuelRate) || 92.5)).toLocaleString('en-IN')}) posted to Ledger!`);
      setTimeout(() => setFuelSlipMsg(null), 4000);
      loadStaffData();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to issue fuel slip receipt');
    }
  };

  const handleRunFuelAudit = async (tripId: string) => {
    setIsAuditingFuel(true);
    try {
      const res = await aiApi.auditFuel(tripId);
      setFuelAuditResult(res);
    } catch (err) {
      console.error('Fuel audit failed', err);
    } finally {
      setIsAuditingFuel(false);
    }
  };

  const handleRaiseMaintenance = async (
    e?: React.FormEvent,
    customPayload?: { truckReg?: string; component?: any; description?: string; cost?: number; autoSwitchToManager?: boolean }
  ) => {
    if (e) e.preventDefault();
    const targetReg = customPayload?.truckReg || selectedTruckNumber;
    const truckObj = trucks.find((t) => t.registrationNumber === targetReg) || trucks[0];
    if (!truckObj) return;
    const comp = customPayload?.component || maintComponent;
    const baseDesc = customPayload?.description || maintDesc;
    const fullDesc = challanRefNo ? `[Ref: ${challanRefNo} | ${challanAuthority}] ${baseDesc}` : baseDesc;
    const cost = customPayload?.cost ?? (Number(maintCost) || 4500);
    try {
      const created = await fleetApi.raiseMaintenance({
        truck: truckObj._id,
        type: maintType,
        component: comp,
        description: fullDesc,
        labourCost: cost,
        downtimeHours: comp.includes('CHALLAN') || comp.includes('RTO') || comp.includes('PERMIT') ? 0 : 4,
      });
      setRaisedChallanBill(created);
      setMaintMsg(
        `Challan / RTO Bill ${created.jobNo || ''} raised by STAFF for ${targetReg} (${comp} • ₹${cost.toLocaleString(
          'en-IN'
        )}) — Sent to Manager Clearance Queue!`
      );
      await loadStaffData();
      if (customPayload?.autoSwitchToManager) {
        navigateToPortal('MANAGER', {
          truckNumber: targetReg,
          message: `STAFF raised Challan ${created.jobNo || ''} (${comp} • ₹${cost.toLocaleString('en-IN')}) for ${targetReg} → Ready for Manager Clearance`,
        });
      }
    } catch (err) {
      alert('Failed to raise RTO/Challan/Maintenance bill');
    }
  };

  const handleMarkAttendance = async (empId: string, status: 'PRESENT' | 'ON_TRIP' | 'ABSENT' | 'LEAVE') => {
    try {
      await payrollApi.markAttendance({
        employee: empId,
        date: todayIso,
        status,
      });
      setAttendanceMap((prev) => ({ ...prev, [empId]: status }));
    } catch (err) {
      console.error('Failed to mark attendance', err);
    }
  };

  const filteredTrucks = trucks.filter(
    (t) =>
      t.registrationNumber.toLowerCase().includes(searchTruck.toLowerCase()) ||
      t.model.toLowerCase().includes(searchTruck.toLowerCase())
  );

  // Live On-The-Way Freight & En-Route Transit Calculations while creating the bill
  const liveDistKm = Math.max(1, Number(quoteDist) || 585);
  const liveWeightTons = Math.max(0.5, Number(quoteWeight) || 24);
  const liveFloorRatePerTon =
    quoteResult?.floor_rate_per_ton ||
    Math.round(((liveDistKm / 3.2) * 92.5 + liveDistKm * 14.3) / liveWeightTons);
  const liveOptimalRatePerTon =
    quoteResult?.optimal_rate_per_ton || Math.round(liveFloorRatePerTon / 0.8);
  const liveRatePerTon = Math.max(1, Number(customRatePerTon) || liveOptimalRatePerTon);
  const liveBaseFreight = Math.round(liveWeightTons * liveRatePerTon);
  const liveHalting = Math.max(0, Number(haltingChargesInput) || 0);
  const liveTaxableFreight = liveBaseFreight + liveHalting;
  const liveFreightPerKm = Math.round(liveTaxableFreight / liveDistKm);

  // On-the-Way (En-Route) Transit Allowances & Deductions
  const liveExpectedKmpl = Math.max(2.3, +(3.7 - (liveWeightTons - 15) * 0.025).toFixed(2));
  const liveOnWayDieselLiters = Math.round(liveDistKm / liveExpectedKmpl);
  const liveOnWayDieselCost = Math.round(liveOnWayDieselLiters * 92.5);
  const liveOnWayTollCost = Math.max(0, Number(onWayTollAllowance) || Math.round(liveDistKm * 7.8));
  const liveDriverAdvance = Math.max(0, Number(driverAdvanceInput) || 0);
  const liveOnWayTotalTransitExpense = liveOnWayDieselCost + liveOnWayTollCost + liveDriverAdvance;

  const selectedClientObj = clients.find((c) => c._id === selectedClientId);

  // Derived Receipt Calculations for Active Receipt Preview (Live Draft vs Selected Saved Trip)
  const activeReceiptFreight = isLiveDraftReceipt
    ? liveBaseFreight
    : receiptTrip?.financials?.grossFreightAmount || liveBaseFreight;
  const activeReceiptHalting = isLiveDraftReceipt
    ? liveHalting
    : receiptTrip?.financials?.detentionCharges ?? liveHalting;
  const activeReceiptTaxable = activeReceiptFreight + activeReceiptHalting;
  const activeGstMode = isLiveDraftReceipt
    ? (selectedClientObj as any)?.gstMode || 'RCM_5'
    : receiptTrip?.client?.gstMode || 'RCM_5';
  const activeGstRate = activeGstMode === 'FCM_12' ? 0.12 : 0.05;
  const activeGstAmount = Math.round(activeReceiptTaxable * activeGstRate);
  const activeAdvance = isLiveDraftReceipt
    ? liveDriverAdvance
    : receiptTrip?.financials?.driverAdvanceGiven || 12000;
  const activeOnWayTransitAllowance = liveOnWayDieselCost + liveOnWayTollCost;
  const activeNetReceivable =
    activeGstMode === 'FCM_12'
      ? activeReceiptTaxable + activeGstAmount - activeAdvance
      : activeReceiptTaxable - activeAdvance;

  const clearedClientsCount = clients.filter((c) => c.currentOutstanding <= c.creditLimit).length;
  const blockedClientsCount = clients.length - clearedClientsCount;
  const pendingChallansCount = challanBills.filter((b) => b.status === 'PENDING').length;

  // Sidebar Navigation Structure
  const sidebarNav = [
    {
      group: 'COMMAND & DESK',
      items: [
        { id: 'OVERVIEW', label: 'Executive Desk Overview', icon: LayoutDashboard, badge: `${trips.length} Active`, color: 'text-amber-400' },
      ],
    },
    {
      group: 'COMMERCIAL BILLING & RECEIPT',
      items: [
        { id: 'BILTY_RECEIPTS', label: '1. AI Quote, Bilty & Invoices', icon: Receipt, badge: `${trips.length} Waybills`, color: 'text-cyan-400' },
        { id: 'CHALLAN_RAISER', label: '2. RTO & Challan Raiser', icon: ShieldAlert, badge: `${pendingChallansCount} Pending`, alert: pendingChallansCount > 0, color: 'text-amber-400' },
        { id: 'VOUCHER_RECEIPTS', label: '3. Fuel Slips & Vouchers', icon: Fuel, badge: `${fuelSlips.length} Slips`, color: 'text-emerald-400' },
      ],
    },
    {
      group: 'FLEET & CREW OPERATIONS',
      items: [
        { id: 'TYRE_WEIBULL', label: '4. Tyre Blueprint & Workshop', icon: Disc, badge: `${weibullReport?.overall_health_score ?? 84}%`, color: 'text-purple-400' },
        { id: 'ATTENDANCE_CREDIT', label: '5. Driver Attendance & Credit', icon: UserCheck, badge: `${employees.length} Crew`, color: 'text-cyan-300' },
        { id: 'DRIVER_ONBOARDING', label: '6. Driver Recruitment Desk', icon: Users, badge: 'Drivers Only', color: 'text-amber-400' },
      ],
    },
    {
      group: 'UNIFIED VIEW',
      items: [
        { id: 'ALL', label: 'All Modules Stacked', icon: Layers, badge: 'Full Desk', color: 'text-slate-400' },
      ],
    },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start pb-20">
      {/* =====================================================================
          STAFF DEDICATED LEFT SIDEBAR
         ===================================================================== */}
      <aside className="w-full lg:w-72 shrink-0 lg:sticky lg:top-20 space-y-4">
        {/* Sidebar Brand Card */}
        <div className="bento-card p-4 border border-amber-500/30 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-950 text-amber-400 border border-amber-800 flex items-center justify-center font-bold">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold font-mono text-white">STAFF DESK</div>
                <div className="text-[10px] text-amber-400 font-mono">Billing & Operations</div>
              </div>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
              DESK ACTIVE
            </span>
          </div>

          <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-[10px] font-mono">
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-400 block">WAYBILLS</span>
              <span className="text-sm font-bold text-white">{trips.length}</span>
            </div>
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-400 block">PENDING CHLN</span>
              <span className={`text-sm font-bold ${pendingChallansCount > 0 ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`}>
                {pendingChallansCount}
              </span>
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
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id as StaffTab)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-mono transition-all text-left ${
                        isActive
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-md font-bold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-300' : item.color}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 ml-1.5 ${
                          item.alert
                            ? 'bg-amber-950 text-amber-400 border border-amber-700 font-bold animate-pulse'
                            : isActive
                            ? 'bg-amber-950/80 text-amber-300 border border-amber-700/60'
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

        {/* Quick Cross-Portal Link */}
        <div className="bento-card p-3 border border-slate-800 space-y-2">
          <div className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">
            Quick Cross-Portal Link
          </div>
          <button
            onClick={() => navigateToPortal('MANAGER')}
            className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-mono text-slate-300 border border-slate-800 hover:border-emerald-500/40 transition-all text-left"
          >
            <div className="flex items-center gap-2">
              <TruckIcon className="w-3.5 h-3.5 text-emerald-400" />
              <span>Manager Portal</span>
            </div>
            <span className="text-[10px] text-emerald-400">Clear Challans →</span>
          </button>
          <button
            onClick={() => navigateToPortal('DRIVER')}
            className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-mono text-slate-300 border border-slate-800 hover:border-cyan-500/40 transition-all text-left"
          >
            <div className="flex items-center gap-2">
              <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Driver Console</span>
            </div>
            <span className="text-[10px] text-cyan-400">View Route →</span>
          </button>
        </div>
      </aside>

      {/* =====================================================================
          MAIN WORKSPACE CONTENT AREA
         ===================================================================== */}
      <div className="flex-1 w-full min-w-0 space-y-6">
        {/* Top Executive Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-obsidian-card via-slate-900 to-obsidian-surface p-6 rounded-2xl border border-white/5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-950/80 text-amber-400 border border-amber-800/60">
                ROLE: OPERATIONS, BILLING & DESK STAFF
              </span>
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono bg-cyan-950/60 text-cyan-300 border border-cyan-800/50 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                AI RATE ENGINE, WEIBULL & ISOLATION FOREST ACTIVE
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight mt-2">
              Commercial Billing, GST Receipts, AI Dispatch & Fleet Desk
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              End-to-end GTA Consignment Notes (Bilty), GST Tax Invoices, Pump Fuel Vouchers, Weibull Tyre Blueprint & Driver Attendance
            </p>
          </div>

          <button
            onClick={loadStaffData}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-cyan-400" />
            <span>Sync Desk Ledger</span>
          </button>
        </div>

        {/* OVERVIEW PANEL: KPI STRIP & QUICK ACTIONS */}
        {activeTab === 'OVERVIEW' && (
          <div className="space-y-6">
            {/* 5-Card Executive Desk KPI Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div
                onClick={() => setActiveTab('BILTY_RECEIPTS')}
                className="bento-card p-4 cursor-pointer hover:border-cyan-500/40 transition-all"
              >
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>CONSIGNMENT BILTIES & RECEIPTS</span>
                  <Receipt className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-2xl font-extrabold font-mono text-white mt-1.5">
                  {trips.length} <span className="text-xs font-normal text-slate-400">Waybills</span>
                </div>
                <div className="text-[11px] font-mono text-emerald-400 mt-1">
                  Active Receipt: {receiptTrip?.tripNumber || 'LR-2026-0001'}
                </div>
              </div>

              <div
                onClick={() => setActiveTab('BILTY_RECEIPTS')}
                className="bento-card p-4 cursor-pointer hover:border-purple-500/40 transition-all"
              >
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>AI LIGHTGBM OPTIMAL QUOTE</span>
                  <Sparkles className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-2xl font-extrabold font-mono text-emerald-400 mt-1.5">
                  ₹{(quoteResult?.optimal_rate_per_ton || 2680).toLocaleString('en-IN')}
                  <span className="text-xs font-normal text-slate-400">/Ton</span>
                </div>
                <div className="text-[11px] font-mono text-purple-300 mt-1">
                  {quoteOrigin} → {quoteDest} • {quoteResult?.backhaul_probability_pct ?? 72}% Backhaul
                </div>
              </div>

              <div
                onClick={() => setActiveTab('CHALLAN_RAISER')}
                className="bento-card p-4 cursor-pointer border-amber-500/30 hover:border-amber-400 transition-all"
              >
                <div className="flex items-center justify-between text-[11px] font-mono text-amber-300">
                  <span>RTO & TRAFFIC CHALLAN RAISER</span>
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-extrabold font-mono text-amber-300 mt-1.5">
                  {pendingChallansCount}{' '}
                  <span className="text-xs font-normal text-slate-400">Awaiting Manager</span>
                </div>
                <div className="text-[11px] font-mono text-emerald-400 mt-1">
                  {challanBills.filter((b) => b.status === 'APPROVED').length} Cleared by Manager ✓
                </div>
              </div>

              <div
                onClick={() => setActiveTab('VOUCHER_RECEIPTS')}
                className="bento-card p-4 cursor-pointer hover:border-amber-500/40 transition-all"
              >
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>FUEL SLIPS & PUMP VOUCHERS</span>
                  <Fuel className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-extrabold font-mono text-amber-400 mt-1.5">
                  {fuelSlips.length} <span className="text-xs font-normal text-slate-400">Issued Slips</span>
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-1">
                  Double-Entry Pump Credit Synced
                </div>
              </div>

              <div
                onClick={() => setActiveTab('TYRE_WEIBULL')}
                className="bento-card p-4 cursor-pointer hover:border-emerald-500/40 transition-all"
              >
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>WEIBULL AI & CREDIT GUARD</span>
                  <Disc className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-extrabold font-mono text-cyan-300 mt-1.5">
                  {weibullReport?.overall_health_score ?? 84}% <span className="text-xs font-normal text-slate-400">Health</span>
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-1">
                  Clients: <span className="text-emerald-400">{clearedClientsCount} Cleared</span> •{' '}
                  <span className="text-rose-400">{blockedClientsCount} Hold</span>
                </div>
              </div>
            </div>

            {/* Quick Action Hub */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div
                onClick={() => setActiveTab('BILTY_RECEIPTS')}
                className="bento-card p-4 cursor-pointer hover:border-cyan-500/50 hover:bg-cyan-950/20 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="font-bold font-mono text-sm text-slate-100 mt-3">Book Bilty & Tax Invoices</h3>
                <p className="text-xs text-slate-400 mt-1">AI-calculated on-the-way freight rates, GST breakdown and printable receipts.</p>
              </div>

              <div
                onClick={() => setActiveTab('CHALLAN_RAISER')}
                className="bento-card p-4 cursor-pointer hover:border-amber-500/50 hover:bg-amber-950/20 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-amber-950 text-amber-400 border border-amber-800">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="font-bold font-mono text-sm text-slate-100 mt-3">Raise RTO / Fitness Challan</h3>
                <p className="text-xs text-slate-400 mt-1">Upload on-road police/overload/fitness penalties to queue for Manager clearance.</p>
              </div>

              <div
                onClick={() => setActiveTab('VOUCHER_RECEIPTS')}
                className="bento-card p-4 cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-950/20 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800">
                    <Fuel className="w-5 h-5" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="font-bold font-mono text-sm text-slate-100 mt-3">Issue Fuel Slips & Vouchers</h3>
                <p className="text-xs text-slate-400 mt-1">Pump credit diesel slips with automated KMPL and fuel siphoning protection.</p>
              </div>

              <div
                onClick={() => setActiveTab('TYRE_WEIBULL')}
                className="bento-card p-4 cursor-pointer hover:border-purple-500/50 hover:bg-purple-950/20 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-purple-950 text-purple-400 border border-purple-800">
                    <Disc className="w-5 h-5" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="font-bold font-mono text-sm text-slate-100 mt-3">Axle Tyre Survival & Health</h3>
                <p className="text-xs text-slate-400 mt-1">Real-time axle SVG blueprint, retread history and Weibull hazard rate analysis.</p>
              </div>
            </div>
          </div>
        )}

      {/* =====================================================================
          SECTION 1: AI DYNAMIC QUOTE ENGINE + BILTY BOOKING + GST BILLING RECEIPT
         ===================================================================== */}
      {(activeTab === 'ALL' || activeTab === 'BILTY_RECEIPTS') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 7 Columns: AI Freight Quote Engine + Bilty Generator + Recent Billing Receipts Table */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bento-card p-6 border border-cyan-500/20 space-y-5">
              <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-100 font-mono">
                      PANEL 1A • AI FREIGHT QUOTE & BILTY GENERATOR (LightGBM)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Computes physics break-even floor rate, 20% margin optimal quote & 24h backhaul probability
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                  {quoteResult?.model_version || 'lgbm-corridor-quote-v2.6'}
                </span>
              </div>

              {/* Quote Parameters Form */}
              <form onSubmit={handleRunQuote} className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono text-xs">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">ORIGIN HUB</label>
                  <input
                    type="text"
                    value={quoteOrigin}
                    onChange={(e) => {
                      setQuoteOrigin(e.target.value);
                      setIsLiveDraftReceipt(true);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">DESTINATION HUB</label>
                  <input
                    type="text"
                    value={quoteDest}
                    onChange={(e) => {
                      setQuoteDest(e.target.value);
                      setIsLiveDraftReceipt(true);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">DISTANCE (KM)</label>
                  <input
                    type="number"
                    value={quoteDist}
                    onChange={(e) => {
                      const val = e.target.value;
                      setQuoteDist(val);
                      setOnWayTollAllowance(String(Math.round((Number(val) || 0) * 7.8)));
                      setIsLiveDraftReceipt(true);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">TONNAGE (T)</label>
                  <input
                    type="number"
                    value={quoteWeight}
                    onChange={(e) => {
                      setQuoteWeight(e.target.value);
                      setIsLiveDraftReceipt(true);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={isQuoting}
                    className="w-full py-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold transition-colors"
                  >
                    {isQuoting ? 'Pricing...' : 'AI Price →'}
                  </button>
                </div>
              </form>

              {/* AI Pricing Output + Itemized Cost Physics Breakdown */}
              {quoteResult && (
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
                    <div
                      onClick={() => {
                        setCustomRatePerTon(String(liveFloorRatePerTon));
                        setIsLiveDraftReceipt(true);
                      }}
                      className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-amber-500/60 cursor-pointer transition-all"
                      title="Click to apply Floor Rate to Bill"
                    >
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>FLOOR RATE (BREAK-EVEN)</span>
                        <span className="text-[9px] text-amber-400">Apply →</span>
                      </div>
                      <div className="text-lg font-extrabold text-amber-400 mt-0.5">
                        ₹{liveFloorRatePerTon.toLocaleString('en-IN')}/T
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Min Total: ₹{Math.round(liveWeightTons * liveFloorRatePerTon).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div
                      onClick={() => {
                        setCustomRatePerTon(String(liveOptimalRatePerTon));
                        setIsLiveDraftReceipt(true);
                      }}
                      className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/60 hover:border-cyan-400 cursor-pointer transition-all"
                      title="Click to apply Optimal Quote to Bill"
                    >
                      <div className="flex items-center justify-between text-[10px] text-cyan-300">
                        <span>OPTIMAL QUOTE (20% MARGIN)</span>
                        <span className="text-[9px] text-emerald-400">Apply →</span>
                      </div>
                      <div className="text-lg font-extrabold text-emerald-400 mt-0.5">
                        ₹{liveOptimalRatePerTon.toLocaleString('en-IN')}/T
                      </div>
                      <div className="text-[10px] text-slate-300">
                        Recommended Bilty: ₹{Math.round(liveWeightTons * liveOptimalRatePerTon).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                      <div className="text-[10px] text-slate-400">24H RETURN BACKHAUL</div>
                      <div className="text-lg font-extrabold text-purple-400 mt-0.5">
                        {quoteResult.backhaul_probability_pct ?? 72}% Prob
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Reverse load from {quoteDest}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Consignor Selection & On-The-Way Live Freight Bill Calculator */}
              <div className="pt-3 border-t border-slate-800/80 space-y-4 font-mono text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">BILLED CORPORATE CLIENT</label>
                    <select
                      value={selectedClientId}
                      onChange={(e) => {
                        setSelectedClientId(e.target.value);
                        setIsLiveDraftReceipt(true);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-200"
                    >
                      {clients.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.companyName} {c.currentOutstanding > c.creditLimit ? '(OVER LIMIT)' : '(CLEARED)'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">CARGO DESCRIPTION</label>
                    <input
                      type="text"
                      value={material}
                      onChange={(e) => {
                        setMaterial(e.target.value);
                        setIsLiveDraftReceipt(true);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-cyan-300 font-bold block mb-1">AGREED RATE / TON (₹/T)</label>
                    <input
                      type="number"
                      value={customRatePerTon}
                      onChange={(e) => {
                        setCustomRatePerTon(e.target.value);
                        setIsLiveDraftReceipt(true);
                      }}
                      className="w-full bg-slate-950 border border-cyan-500/60 rounded-lg px-2.5 py-2 text-emerald-400 font-extrabold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">HALTING / LOADING (₹)</label>
                    <input
                      type="number"
                      value={haltingChargesInput}
                      onChange={(e) => {
                        setHaltingChargesInput(e.target.value);
                        setIsLiveDraftReceipt(true);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-amber-300 block mb-1">ON-THE-WAY DRIVER ADVANCE (₹)</label>
                    <input
                      type="number"
                      value={driverAdvanceInput}
                      onChange={(e) => {
                        setDriverAdvanceInput(e.target.value);
                        setIsLiveDraftReceipt(true);
                      }}
                      className="w-full bg-slate-950 border border-amber-500/40 rounded-lg px-2.5 py-2 text-amber-300 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">ON-THE-WAY FASTAG TOLL (₹)</label>
                    <input
                      type="number"
                      value={onWayTollAllowance}
                      onChange={(e) => {
                        setOnWayTollAllowance(e.target.value);
                        setIsLiveDraftReceipt(true);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-200"
                    />
                  </div>
                </div>

                {/* LIVE ON-THE-WAY CALCULATED FREIGHT & TRANSIT BREAKDOWN PANEL */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-cyan-950/30 border border-emerald-500/40 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider">
                        ON-THE-WAY LIVE FREIGHT & TRANSIT BILL CALCULATOR
                      </span>
                    </div>
                    <span className="text-[10px] text-cyan-300 bg-slate-950/80 px-2.5 py-0.5 rounded-full border border-cyan-800/60">
                      {liveWeightTons} MT × ₹{liveRatePerTon.toLocaleString('en-IN')}/T • ₹{liveFreightPerKm}/km
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                      <div className="text-[9px] text-slate-400">1. BASE FREIGHT</div>
                      <div className="text-sm font-extrabold text-white mt-0.5">
                        ₹{liveBaseFreight.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[9px] text-slate-500">
                        +₹{liveHalting.toLocaleString('en-IN')} Halting
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                      <div className="text-[9px] text-amber-300">2. ON-WAY DIESEL ({liveOnWayDieselLiters}L)</div>
                      <div className="text-sm font-extrabold text-amber-400 mt-0.5">
                        ₹{liveOnWayDieselCost.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[9px] text-slate-500">
                        @ {liveExpectedKmpl} km/L Est
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                      <div className="text-[9px] text-purple-300">3. ON-WAY TOLL + ADV</div>
                      <div className="text-sm font-extrabold text-purple-300 mt-0.5">
                        ₹{(liveOnWayTollCost + liveDriverAdvance).toLocaleString('en-IN')}
                      </div>
                      <div className="text-[9px] text-slate-500">
                        Toll ₹{liveOnWayTollCost.toLocaleString('en-IN')} + Adv ₹{liveDriverAdvance.toLocaleString('en-IN')}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                      <div className="text-[9px] text-cyan-300">4. GROSS + GST ({activeGstMode === 'FCM_12' ? '12%' : '5% RCM'})</div>
                      <div className="text-sm font-extrabold text-cyan-300 mt-0.5">
                        ₹{liveTaxableFreight.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[9px] text-slate-400">
                        GST: ₹{activeGstAmount.toLocaleString('en-IN')}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/50">
                      <div className="text-[9px] text-emerald-300 font-bold">5. NET BALANCE TO PAY</div>
                      <div className="text-base font-extrabold text-emerald-400 mt-0.5">
                        ₹{activeNetReceivable.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[9px] text-emerald-300/80">
                        After ₹{liveDriverAdvance.toLocaleString('en-IN')} Advance
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="text-[11px] text-slate-400">
                    Assigned Vehicle: <strong className="text-cyan-300">{selectedTruckNumber}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleBookBilty()}
                    disabled={isBooking}
                    className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold flex items-center gap-2 transition-all shadow-glow-emerald"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isBooking ? 'Generating LR & Tax Receipt...' : 'Generate Bilty & GST Receipt'}</span>
                  </button>
                </div>

                {bookingError && (
                  <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-700 text-rose-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{bookingError}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleBookBilty('482916')}
                        className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px]"
                      >
                        Authorize PIN (482916)
                      </button>
                      <button
                        onClick={() =>
                          navigateToPortal('ADMIN', {
                            clientId: selectedClientId,
                            message: `Credit limit override requested by STAFF for client booking (${quoteOrigin} → ${quoteDest})`,
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700 text-[11px] flex items-center gap-1"
                      >
                        <span>Escalate to Admin</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}

                {bookedTrip && (
                  <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/50 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-emerald-300">
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        Official Bilty & Receipt <strong>{bookedTrip.lrNumber || bookedTrip.tripNumber}</strong> generated!
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() =>
                          navigateToPortal('MANAGER', {
                            tripId: bookedTrip._id,
                            message: `New Bilty ${bookedTrip.lrNumber} created in STAFF Desk → Ready for Highway Dispatch`,
                          })
                        }
                        className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-[11px] flex items-center gap-1"
                      >
                        <span>Dispatch in Manager Ops</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          navigateToPortal('DRIVER', {
                            tripId: bookedTrip._id,
                            message: `Voyage ${bookedTrip.lrNumber} assigned to Driver Cabin (${selectedTruckNumber})`,
                          })
                        }
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] flex items-center gap-1"
                      >
                        <span>Driver Cabin</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Issued Consignment Bilties & Billing Receipts Register */}
            <div className="bento-card p-5 space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-slate-100 font-mono">
                    PANEL 1B • CONSIGNMENT WAYBILLS & BILLING RECEIPT REGISTER
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  Click any row to load Official GST Receipt →
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-900/70 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-2.5">LR / Bilty #</th>
                      <th className="py-2.5 px-2.5">Client & GST</th>
                      <th className="py-2.5 px-2.5">Corridor</th>
                      <th className="py-2.5 px-2.5 text-right">Billed Freight</th>
                      <th className="py-2.5 px-2.5 text-center">Status</th>
                      <th className="py-2.5 px-2.5 text-center">Receipt / Handoff</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {trips.slice(0, 7).map((t) => {
                      const isSelected = !isLiveDraftReceipt && receiptTrip?._id === t._id;
                      return (
                        <tr
                          key={t._id}
                          onClick={() => {
                            setReceiptTrip(t);
                            setIsLiveDraftReceipt(false);
                          }}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-amber-950/25 border-l-2 border-l-amber-400' : 'hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="py-2.5 px-2.5 font-bold text-amber-300">{t.tripNumber}</td>
                          <td className="py-2.5 px-2.5">
                            <div className="text-slate-200 font-semibold truncate max-w-[140px]">
                              {t.client?.companyName}
                            </div>
                            <div className="text-[10px] text-slate-500">{(t.client as any)?.gstMode || 'RCM_5'}</div>
                          </td>
                          <td className="py-2.5 px-2.5 text-slate-300">
                            {t.route?.originCity} → {t.route?.destinationCity}
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-bold text-emerald-400">
                            ₹{t.financials?.totalRevenue?.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-2.5 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-900 text-slate-300 border border-slate-800">
                              {t.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => {
                                  setReceiptTrip(t);
                                  setIsLiveDraftReceipt(false);
                                }}
                                className="px-2 py-1 rounded bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-800 text-[10px]"
                              >
                                Receipt
                              </button>
                              <button
                                onClick={() =>
                                  navigateToPortal('MANAGER', {
                                    tripId: t._id,
                                    message: `Waybill ${t.tripNumber} sent from STAFF Billing Desk to MANAGER Ops`,
                                  })
                                }
                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-[10px]"
                              >
                                Ops →
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
          </div>

          {/* Right 5 Columns: Official Printable GTA Consignment Note (Bilty) & GST Billing Receipt */}
          <div className="lg:col-span-5">
            <div className="bento-card p-6 border-2 border-amber-500/30 bg-gradient-to-b from-slate-900 via-slate-950 to-obsidian-surface space-y-4 sticky top-20">
              {/* Receipt Header */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-amber-400" />
                    <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold">
                      {isLiveDraftReceipt
                        ? 'LIVE ON-THE-WAY BILL CALCULATOR RECEIPT'
                        : 'OFFICIAL GTA CONSIGNMENT NOTE & TAX RECEIPT'}
                    </span>
                  </div>
                  <h3 className="text-lg font-extrabold text-white font-mono mt-1">
                    {isLiveDraftReceipt ? 'DRAFT-LR-2026-LIVE' : receiptTrip?.tripNumber || 'LR-2026-0081'}
                  </h3>
                  <div className="text-[11px] font-mono text-slate-400">
                    E-Way Bill:{' '}
                    <span className="text-cyan-300">
                      {isLiveDraftReceipt ? 'EWB-LIVE-CALC-8921' : receiptTrip?.ewayBillNo || 'EWB-202600818921'}
                    </span>
                  </div>
                </div>

                <div className="text-right font-mono space-y-1">
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 block">
                    {activeGstMode === 'FCM_12' ? 'GST FCM 12% INVOICE' : 'GTA RCM 5% BILTY'}
                  </span>
                  {!isLiveDraftReceipt && (
                    <button
                      onClick={() => setIsLiveDraftReceipt(true)}
                      className="text-[10px] text-cyan-400 hover:underline block ml-auto"
                    >
                      Switch to Live Bill Draft →
                    </button>
                  )}
                </div>
              </div>

              {/* Consignor / Consignee & Vehicle Details */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 font-mono text-xs">
                <div>
                  <div className="text-[9px] text-slate-500 uppercase">BILLED CONSIGNOR PARTY</div>
                  <div className="font-bold text-slate-100 mt-0.5 truncate">
                    {isLiveDraftReceipt
                      ? selectedClientObj?.companyName || 'Corporate Freight Consignor'
                      : receiptTrip?.client?.companyName || 'Reliance Retail Supply Chain'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    GSTIN:{' '}
                    {isLiveDraftReceipt
                      ? selectedClientObj?.gstin || '27AAACR5055K1Z7'
                      : receiptTrip?.client?.gstin || '27AAACR5055K1Z7'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] text-slate-500 uppercase">PRIME MOVER & CAPTAIN</div>
                  <div className="font-bold text-cyan-300 mt-0.5">
                    {isLiveDraftReceipt
                      ? selectedTruckNumber
                      : receiptTrip?.truck?.registrationNumber || selectedTruckNumber}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {isLiveDraftReceipt ? 'Assigned Fleet Captain' : receiptTrip?.driver?.fullName || 'Rajendra Singh Yadav'}
                  </div>
                </div>
              </div>

              {/* Route & Commodity Manifest Box */}
              <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800/90 font-mono text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[9px] text-slate-500 block">ORIGIN</span>
                    <span className="font-bold text-white text-sm">
                      {isLiveDraftReceipt ? quoteOrigin : receiptTrip?.route?.originCity || quoteOrigin}
                    </span>
                  </div>
                  <div className="text-center px-2">
                    <span className="text-[10px] text-cyan-400 block">
                      {isLiveDraftReceipt ? liveDistKm : receiptTrip?.route?.distanceKm || quoteDist} KM
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-500 mx-auto" />
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-500 block">DESTINATION</span>
                    <span className="font-bold text-white text-sm">
                      {isLiveDraftReceipt ? quoteDest : receiptTrip?.route?.destinationCity || quoteDest}
                    </span>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-800/80 flex justify-between text-[11px] text-slate-300">
                  <span>Commodity: {isLiveDraftReceipt ? material : receiptTrip?.material || material}</span>
                  <span>
                    Net Wt:{' '}
                    <strong>{isLiveDraftReceipt ? liveWeightTons : receiptTrip?.weightTons || quoteWeight} MT</strong> @ ₹
                    {(isLiveDraftReceipt
                      ? liveRatePerTon
                      : receiptTrip?.ratePerTon || liveRatePerTon
                    ).toLocaleString('en-IN')}
                    /T
                  </span>
                </div>
              </div>

              {/* Itemized Billing & Tax Receipt Table */}
              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 font-mono text-xs space-y-2">
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider pb-1 border-b border-slate-800">
                  ITEMIZED FREIGHT & ON-THE-WAY BILLING BREAKDOWN
                </div>

                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Basic Lorry Freight Charges:</span>
                  <span className="text-slate-100 font-semibold">₹{activeReceiptFreight.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Halting / Detention & Hamali:</span>
                  <span className="text-slate-200">+₹{activeReceiptHalting.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1.5 border-t border-slate-800 font-bold text-slate-100">
                  <span>Taxable Consignment Value:</span>
                  <span>₹{activeReceiptTaxable.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1 text-[11px]">
                  <span className="text-amber-300">
                    {activeGstMode === 'FCM_12'
                      ? 'Add: IGST @ 12% (Forward Charge):'
                      : 'GTA GST @ 5% (Reverse Charge by Consignee):'}
                  </span>
                  <span className="text-amber-300 font-semibold">
                    ₹{activeGstAmount.toLocaleString('en-IN')}{' '}
                    {activeGstMode === 'RCM_5' ? '(RCM)' : ''}
                  </span>
                </div>
                <div className="flex justify-between py-1 text-[11px] text-cyan-300/90">
                  <span>On-the-Way Transit Allowance (Diesel + FASTag):</span>
                  <span>₹{activeOnWayTransitAllowance.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1 text-[11px] text-slate-400">
                  <span>Less: On-the-Way Driver Advance Paid:</span>
                  <span className="text-rose-300">-₹{activeAdvance.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between items-center pt-2.5 mt-2 border-t-2 border-slate-700 text-sm font-extrabold">
                  <span className="text-white">NET BILLED BALANCE RECEIPT:</span>
                  <span className="text-emerald-400 text-base">
                    ₹{activeNetReceivable.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* AI Audit & Digital Signature Stamp */}
              <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-800/50 flex items-center justify-between text-[10px] font-mono text-emerald-300">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>ACID Double-Entry Voucher & LightGBM Rate Verified</span>
                </div>
                <span className="text-slate-400">SAC: 996511</span>
              </div>

              {/* Receipt Actions */}
              <div className="grid grid-cols-2 gap-2.5 pt-1 font-mono text-xs">
                <button
                  onClick={() => window.print()}
                  className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print GST Receipt</span>
                </button>
                <button
                  onClick={() =>
                    receiptTrip &&
                    navigateToPortal('MANAGER', {
                      tripId: receiptTrip._id,
                      message: `Official Bilty Receipt ${receiptTrip.tripNumber} forwarded to MANAGER Ops for Dispatch`,
                    })
                  }
                  className="py-2.5 px-3 rounded-xl bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Send to Manager</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SECTION 1.5: STAFF RTO, FITNESS, PERMIT & TRAFFIC E-CHALLAN RAISER
          (RAISED BY STAFF DESK → CLEARED BY MANAGER IN ACID LEDGER)
         ===================================================================== */}
      {(activeTab === 'ALL' || activeTab === 'CHALLAN_RAISER') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 5 Columns: Staff Challan & RTO Bill Raiser Form */}
          <div className="lg:col-span-5 bento-card p-6 border border-amber-500/35 space-y-4">
            <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-950 text-amber-400 border border-amber-800">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 font-mono">
                    STAFF CHALLAN & RTO FITNESS RAISER DESK
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Raise RTO Fitness, Permits & Traffic E-Challans here → Cleared by Manager in Ledger
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800">
                MAKER: STAFF RAISER
              </span>
            </div>

            {/* 1-Click RTO & Traffic Challan Presets */}
            <div>
              <div className="text-[10px] font-mono text-slate-400 uppercase mb-1.5">
                1-CLICK RTO, PERMIT & TRAFFIC CHALLAN PRESETS
              </div>
              <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                {[
                  {
                    comp: 'RTO_FITNESS',
                    label: 'RTO Fitness ₹4,500',
                    cost: '4500',
                    ref: 'FORM38-MH04-2910',
                    auth: 'RTO Thane / Fitness Track',
                    desc: 'RTO Annual Fitness Certificate (Form 38) Renewal & Track Inspection Challan',
                  },
                  {
                    comp: 'NATIONAL_PERMIT',
                    label: 'National Permit ₹16,500',
                    cost: '16500',
                    ref: 'NP-AIB-2026-4418',
                    auth: 'Vahan 4.0 National Permit Portal',
                    desc: 'All-India National Permit (NP Part A & B) Annual Authorization Fee',
                  },
                  {
                    comp: 'STATE_TAX_CHALLAN',
                    label: 'Border Tax ₹3,800',
                    cost: '3800',
                    ref: 'BTAX-MPMH-7731',
                    auth: 'NH-3 Sendhwa Inter-State Checkpost',
                    desc: 'Inter-State Checkpost Border Tax & Green Cess Challan',
                  },
                  {
                    comp: 'OVERLOAD_CHALLAN',
                    label: 'Traffic E-Challan ₹12,000',
                    cost: '12000',
                    ref: 'ECHL-NH48-99204',
                    auth: 'Highway Weighbridge / Enforcement Squad',
                    desc: 'Highway Weighbridge Overload / RTO Traffic E-Challan Requisition',
                  },
                  {
                    comp: 'PUC_INSURANCE',
                    label: 'PUC & Ins ₹8,200',
                    cost: '8200',
                    ref: 'PUCC-2026-6102',
                    auth: 'Authorized Emission & Transit Ins Desk',
                    desc: 'Pollution Under Control (PUC) & Third-Party Transit Insurance Renewal',
                  },
                ].map((preset) => (
                  <button
                    key={preset.comp}
                    type="button"
                    onClick={() => {
                      setMaintComponent(preset.comp as any);
                      setMaintCost(preset.cost);
                      setChallanRefNo(preset.ref);
                      setChallanAuthority(preset.auth);
                      setMaintDesc(preset.desc);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg border transition-colors ${
                      maintComponent === preset.comp
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 font-bold'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={(e) => handleRaiseMaintenance(e)} className="space-y-3 font-mono text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">TRUCK ASSET</label>
                  <select
                    value={selectedTruckNumber}
                    onChange={(e) => setSelectedTruckNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-cyan-300 font-bold"
                  >
                    {trucks.map((tr) => (
                      <option key={tr._id} value={tr.registrationNumber}>
                        {tr.registrationNumber} ({tr.axleConfiguration})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">CHALLAN / RTO BILL CATEGORY</label>
                  <select
                    value={maintComponent}
                    onChange={(e) => setMaintComponent(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                  >
                    <option value="RTO_FITNESS">RTO_FITNESS (Form 38 Renewal)</option>
                    <option value="NATIONAL_PERMIT">NATIONAL_PERMIT (All-India NP)</option>
                    <option value="STATE_TAX_CHALLAN">STATE_TAX_CHALLAN (Border Tax)</option>
                    <option value="OVERLOAD_CHALLAN">OVERLOAD_CHALLAN (Traffic Fine)</option>
                    <option value="PUC_INSURANCE">PUC_INSURANCE (Pollution/Ins)</option>
                    <option value="BRAKE_PAD">BRAKE_PAD (Workshop Liner)</option>
                    <option value="CLUTCH_PLATE">CLUTCH_PLATE (Clutch Overhaul)</option>
                    <option value="ENGINE_OIL">ENGINE_OIL (15W-40 Service)</option>
                    <option value="TYRE">TYRE (Mount / Retread Bill)</option>
                    <option value="GENERAL">GENERAL (Other Challan/Repair)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">CHALLAN / RECEIPT REF NO</label>
                  <input
                    type="text"
                    value={challanRefNo}
                    onChange={(e) => setChallanRefNo(e.target.value)}
                    placeholder="e.g. ECHL-MH04-88412"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-amber-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-amber-300 font-bold block mb-1">CHALLAN AMOUNT (₹)</label>
                  <input
                    type="number"
                    value={maintCost}
                    onChange={(e) => setMaintCost(e.target.value)}
                    className="w-full bg-slate-950 border border-amber-500/50 rounded-lg p-2 text-amber-300 font-extrabold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">ISSUING RTO / CHECKPOST AUTHORITY</label>
                  <input
                    type="text"
                    value={challanAuthority}
                    onChange={(e) => setChallanAuthority(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">CHALLAN NARRATION & REMARKS</label>
                  <input
                    type="text"
                    value={maintDesc}
                    onChange={(e) => setMaintDesc(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                  />
                </div>
              </div>

              {maintMsg && (
                <div className="p-3 rounded-xl bg-emerald-950/80 text-emerald-300 border border-emerald-600 text-[11px] space-y-2">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{maintMsg}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      navigateToPortal('MANAGER', {
                        truckNumber: selectedTruckNumber,
                        message: `STAFF raised ${maintComponent} Challan (₹${Number(maintCost).toLocaleString(
                          'en-IN'
                        )}) for ${selectedTruckNumber} → Awaiting Manager Bill Clearance`,
                      })
                    }
                    className="w-full py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center justify-center gap-1.5"
                  >
                    <span>Switch to Manager Portal to Clear This Challan</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <button
                  type="submit"
                  className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Receipt className="w-4 h-4" />
                  <span>Raise Challan (₹{Number(maintCost || 0).toLocaleString('en-IN')})</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleRaiseMaintenance(undefined, {
                      autoSwitchToManager: true,
                    })
                  }
                  className="py-2.5 px-3 rounded-xl bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Raise & Send to Manager</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>

          {/* Right 7 Columns: Staff-Raised Challans & Manager Clearance Status Tracker */}
          <div className="lg:col-span-7 bento-card p-6 border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-100 font-mono">
                  STAFF-RAISED CHALLANS & MANAGER CLEARANCE QUEUE
                </h3>
                <p className="text-[11px] text-slate-400">
                  Live status of RTO Fitness, Permits & Traffic Challans raised by Staff awaiting Manager clearance
                </p>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-amber-950/80 text-amber-300 border border-amber-800 font-bold">
                  {challanBills.filter((b) => b.status === 'PENDING').length} Pending Manager
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-950/80 text-emerald-300 border border-emerald-800 font-bold">
                  {challanBills.filter((b) => b.status === 'APPROVED').length} Cleared ✓
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900/60 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-2.5">Challan #</th>
                    <th className="py-2.5 px-2.5">Truck</th>
                    <th className="py-2.5 px-2.5">Category</th>
                    <th className="py-2.5 px-2.5">Ref & Narration</th>
                    <th className="py-2.5 px-2.5 text-right">Amount (₹)</th>
                    <th className="py-2.5 px-2.5 text-center">Manager Status</th>
                    <th className="py-2.5 px-2.5 text-center">Handoff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {[
                    ...challanBills.filter((b) => b.status === 'PENDING'),
                    ...challanBills.filter((b) => b.status !== 'PENDING'),
                  ]
                    .slice(0, 8)
                    .map((bill) => {
                      const truckReg = bill.truck?.regNumber || bill.truck?.registrationNumber || selectedTruckNumber;
                      const amt = bill.totalCost || bill.labourCost || 4500;
                      return (
                        <tr
                          key={bill._id}
                          className={`hover:bg-slate-800/40 ${
                            bill.status === 'PENDING' ? 'bg-amber-950/15' : ''
                          }`}
                        >
                          <td className="py-2.5 px-2.5 font-bold text-amber-300">{bill.jobNo}</td>
                          <td className="py-2.5 px-2.5 font-semibold text-cyan-300">{truckReg}</td>
                          <td className="py-2.5 px-2.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-purple-300 border border-slate-700">
                              {bill.component || 'RTO_FITNESS'}
                            </span>
                          </td>
                          <td className="py-2.5 px-2.5 text-slate-300 max-w-[200px] truncate">{bill.description}</td>
                          <td className="py-2.5 px-2.5 text-right font-extrabold text-slate-100">
                            ₹{amt.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-2.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                bill.status === 'APPROVED'
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  : bill.status === 'REJECTED'
                                  ? 'bg-rose-950 text-rose-400 border border-rose-800'
                                  : 'bg-amber-950 text-amber-300 border border-amber-700'
                              }`}
                            >
                              {bill.status === 'APPROVED'
                                ? 'CLEARED BY MANAGER ✓'
                                : bill.status === 'PENDING'
                                ? 'AWAITING MANAGER'
                                : bill.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-2.5 text-center">
                            {bill.status === 'PENDING' ? (
                              <button
                                onClick={() =>
                                  navigateToPortal('MANAGER', {
                                    truckNumber: truckReg,
                                    message: `STAFF forwarded Challan ${bill.jobNo} (${bill.component} • ₹${amt.toLocaleString(
                                      'en-IN'
                                    )}) for ${truckReg} → Clear in Manager Console`,
                                  })
                                }
                                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] inline-flex items-center gap-1"
                              >
                                <span>Manager Clear</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            ) : (
                              <span className="text-[10px] text-emerald-400">Ledger Posted ✓</span>
                            )}
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

      {/* =====================================================================
          SECTION 2: SMART FUEL SLIPS, PUMP CREDIT VOUCHERS & AI KMPL AUDIT
         ===================================================================== */}
      {(activeTab === 'ALL' || activeTab === 'VOUCHER_RECEIPTS') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 5 Columns: Issue Fuel Slip / Pump Credit Voucher Receipt */}
          <div className="lg:col-span-5 bento-card p-6 space-y-4 border border-amber-500/20">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Fuel className="w-4 h-4 text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-100 font-mono">
                    PANEL 2A • ISSUE FUEL SLIP & PUMP CREDIT RECEIPT
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Posts directly to Double-Entry Ledger (Dr FUEL_EXPENSE / Cr VENDOR_PAYABLE)
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleCreateFuelSlip} className="space-y-3 font-mono text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">LINKED VOYAGE (LR #)</label>
                  <select
                    value={fuelTripId}
                    onChange={(e) => setFuelTripId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-200"
                  >
                    {trips.slice(0, 15).map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.tripNumber} ({t.truck?.registrationNumber})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">HIGHWAY PETROL PUMP</label>
                  <select
                    value={fuelPumpId}
                    onChange={(e) => setFuelPumpId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-200"
                  >
                    {vendors
                      .filter((v) => v.type === 'PETROL_PUMP')
                      .map((v) => (
                        <option key={v._id} value={v._id}>
                          {v.name} ({v.city || 'NH-48'})
                        </option>
                      ))}
                    {vendors.filter((v) => v.type === 'PETROL_PUMP').length === 0 && (
                      <option value="">IOCL Highway Fleet Outlet</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">DIESEL LITRES</label>
                  <input
                    type="number"
                    step="0.1"
                    value={fuelLiters}
                    onChange={(e) => setFuelLiters(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-100 font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">RATE / LITRE (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={fuelRate}
                    onChange={(e) => setFuelRate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">ODOMETER (KM)</label>
                  <input
                    type="number"
                    value={fuelOdo}
                    onChange={(e) => setFuelOdo(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-center pt-1">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">PAYMENT INSTRUMENT</label>
                  <select
                    value={fuelPaymentMode}
                    onChange={(e) => setFuelPaymentMode(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-200"
                  >
                    <option value="PUMP_CREDIT">PUMP CREDIT ACCOUNT</option>
                    <option value="FLEET_CARD">IOCL / BPCL FLEET CARD</option>
                    <option value="CASH">DRIVER CASH ADVANCE</option>
                  </select>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-right">
                  <div className="text-[9px] text-slate-400">VOUCHER RECEIPT TOTAL</div>
                  <div className="text-base font-extrabold text-amber-400">
                    ₹{Math.round((Number(fuelLiters) || 0) * (Number(fuelRate) || 0)).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {fuelSlipMsg && (
                <div className="p-2.5 rounded-xl bg-emerald-950/70 border border-emerald-600 text-emerald-300 text-[11px] flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>{fuelSlipMsg}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <Receipt className="w-4 h-4" />
                <span>Issue Fuel Slip Receipt & Post Journal</span>
              </button>
            </form>
          </div>

          {/* Right 7 Columns: Fuel Slips Register + AI Isolation Forest Siphon Audit */}
          <div className="lg:col-span-7 bento-card p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-purple-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-100 font-mono">
                    PANEL 2B • FUEL VOUCHER RECEIPTS & AI ISOLATION FOREST AUDIT
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Cross-verifies dispensed diesel receipts against corridor gradient & payload KMPL physics
                  </p>
                </div>
              </div>
              <button
                onClick={() => fuelTripId && handleRunFuelAudit(fuelTripId)}
                disabled={isAuditingFuel}
                className="px-3 py-1.5 rounded-xl bg-purple-950 hover:bg-purple-900 text-purple-300 border border-purple-700 font-mono text-xs font-bold flex items-center gap-1.5"
              >
                <Cpu className="w-3.5 h-3.5 text-purple-400" />
                <span>{isAuditingFuel ? 'Running Isolation Forest...' : 'Run AI Fuel Audit on Selected Trip'}</span>
              </button>
            </div>

            {fuelAuditResult && (
              <div
                className={`p-3.5 rounded-xl border font-mono text-xs ${
                  fuelAuditResult.is_theft_anomaly
                    ? 'bg-rose-950/50 border-rose-500/60 text-rose-200'
                    : 'bg-emerald-950/40 border-emerald-600/50 text-emerald-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">
                    {fuelAuditResult.is_theft_anomaly
                      ? 'ALERT: AI ISOLATION FOREST DETECTED PILFERAGE ANOMALY'
                      : 'AI AUDIT PASSED: FUEL RECEIPTS MATCH PHYSICS ENVELOPE'}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-900 text-[10px]">
                    Score: {fuelAuditResult.model_score?.toFixed(3)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-800/80 text-[11px]">
                  <div>Expected: <strong>{fuelAuditResult.expected_kmpl?.toFixed(2)} km/L</strong></div>
                  <div>Actual: <strong>{fuelAuditResult.actual_kmpl?.toFixed(2)} km/L</strong></div>
                  <div>Est. Loss: <strong>₹{Math.round(fuelAuditResult.estimated_theft_loss_inr || 0).toLocaleString('en-IN')}</strong></div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900/70 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-2.5">Slip Receipt #</th>
                    <th className="py-2.5 px-2.5">Truck</th>
                    <th className="py-2.5 px-2.5">Pump Station</th>
                    <th className="py-2.5 px-2.5 text-right">Litres</th>
                    <th className="py-2.5 px-2.5 text-right">Amount (₹)</th>
                    <th className="py-2.5 px-2.5 text-center">Mode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {fuelSlips.slice(0, 6).map((slip: any, idx: number) => (
                    <tr key={slip._id || idx} className="hover:bg-slate-800/40">
                      <td className="py-2 px-2.5 font-bold text-amber-300">
                        {slip.slipNo || `FSLIP-2026-${104 + idx}`}
                      </td>
                      <td className="py-2 px-2.5 text-cyan-300 font-semibold">
                        {slip.truck?.regNumber || selectedTruckNumber}
                      </td>
                      <td className="py-2 px-2.5 text-slate-300">
                        {slip.pump?.name || slip.location || 'Highway IOCL Outlet'}
                      </td>
                      <td className="py-2 px-2.5 text-right text-slate-200">{slip.liters} L</td>
                      <td className="py-2 px-2.5 text-right font-bold text-emerald-400">
                        ₹{(slip.amount || Math.round((slip.liters || 150) * (slip.ratePerLiter || 92))).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 px-2.5 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-900 text-slate-300 border border-slate-800">
                          {slip.paymentMode || 'PUMP_CREDIT'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SECTION 3: FLEET TYRES SVG, AI WEIBULL SURVIVAL & WORKSHOP JOB CARDS
         ===================================================================== */}
      {(activeTab === 'ALL' || activeTab === 'TYRE_WEIBULL') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 4 Columns: Truck Selector + Workshop Job Card Generator */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bento-card p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2 text-xs font-mono text-slate-200 font-bold uppercase">
                  <Disc className="w-4 h-4 text-cyan-400" />
                  <span>PANEL 3A • SELECT TRUCK ASSET</span>
                </div>
                <span className="text-[11px] font-mono text-slate-500">{trucks.length} Units</span>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search registration..."
                  value={searchTruck}
                  onChange={(e) => setSearchTruck(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 font-mono focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
                {filteredTrucks.map((truck) => {
                  const isSelected = selectedTruckNumber === truck.registrationNumber;
                  return (
                    <div
                      key={truck._id}
                      onClick={() => setSelectedTruckNumber(truck.registrationNumber)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-cyan-950/60 border-cyan-500/50 shadow-glow-cyan text-cyan-200'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold font-mono">{truck.registrationNumber}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {truck.make} {truck.model} • {truck.axleConfiguration}
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-slate-950 border border-slate-800">
                        {truck.tyresCount || 10}W
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Raise RTO Fitness, Traffic Challans & Workshop Bills to Manager */}
            <div className="bento-card p-4 space-y-3 border border-amber-500/30">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-mono font-bold text-slate-200">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-amber-400" />
                  <span>RTO, FITNESS, CHALLAN & BILL RAISER</span>
                </div>
                <span className="text-[10px] text-cyan-300">{selectedTruckNumber}</span>
              </div>

              {/* 1-Click RTO & Challan Presets */}
              <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                {[
                  { comp: 'RTO_FITNESS', label: 'RTO Fitness ₹4.5k', cost: '4500', desc: 'RTO Annual Fitness Certificate (Form 38) Renewal & Track Inspection Fee' },
                  { comp: 'NATIONAL_PERMIT', label: 'Nat. Permit ₹16.5k', cost: '16500', desc: 'All-India National Permit (NP Part A & B) Annual Authorization Fee' },
                  { comp: 'STATE_TAX_CHALLAN', label: 'Border Tax ₹3.8k', cost: '3800', desc: 'Inter-State Checkpost Border Tax & Green Cess Challan' },
                  { comp: 'OVERLOAD_CHALLAN', label: 'E-Challan ₹12k', cost: '12000', desc: 'Highway Weighbridge Overload / RTO Traffic E-Challan Settlement' },
                ].map((preset) => (
                  <button
                    key={preset.comp}
                    type="button"
                    onClick={() => {
                      setMaintComponent(preset.comp as any);
                      setMaintCost(preset.cost);
                      setMaintDesc(preset.desc);
                    }}
                    className={`px-2 py-1 rounded-lg border transition-colors ${
                      maintComponent === preset.comp
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 font-bold'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <form onSubmit={(e) => handleRaiseMaintenance(e)} className="space-y-2.5 font-mono text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">CHALLAN / BILL TYPE</label>
                    <select
                      value={maintComponent}
                      onChange={(e) => setMaintComponent(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                    >
                      <option value="RTO_FITNESS">RTO_FITNESS (Form 38 Renewal)</option>
                      <option value="NATIONAL_PERMIT">NATIONAL_PERMIT (All-India NP)</option>
                      <option value="STATE_TAX_CHALLAN">STATE_TAX_CHALLAN (Border Tax)</option>
                      <option value="OVERLOAD_CHALLAN">OVERLOAD_CHALLAN (Highway Fine)</option>
                      <option value="PUC_INSURANCE">PUC_INSURANCE (Pollution/Ins)</option>
                      <option value="BRAKE_PAD">BRAKE_PAD (Workshop Liner)</option>
                      <option value="CLUTCH_PLATE">CLUTCH_PLATE (Clutch Overhaul)</option>
                      <option value="ENGINE_OIL">ENGINE_OIL (15W-40 Service)</option>
                      <option value="TYRE">TYRE (Mount / Retread Bill)</option>
                      <option value="GENERAL">GENERAL (Other Challan/Repair)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">CHALLAN / BILL AMT (₹)</label>
                    <input
                      type="number"
                      value={maintCost}
                      onChange={(e) => setMaintCost(e.target.value)}
                      className="w-full bg-slate-950 border border-amber-500/40 rounded-lg p-2 text-amber-300 font-bold"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">CHALLAN / RTO NARRATION & REF NO</label>
                  <input
                    type="text"
                    value={maintDesc}
                    onChange={(e) => setMaintDesc(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                  />
                </div>
                {maintMsg && (
                  <div className="p-2.5 rounded-xl bg-emerald-950/80 text-emerald-300 border border-emerald-600 text-[10px] space-y-2">
                    <div>{maintMsg}</div>
                    <button
                      type="button"
                      onClick={() =>
                        navigateToPortal('MANAGER', {
                          truckNumber: selectedTruckNumber,
                          message: `STAFF raised ${maintComponent} Bill (₹${Number(maintCost).toLocaleString('en-IN')}) for ${selectedTruckNumber} → Awaiting Manager Bill Clearance`,
                        })
                      }
                      className="w-full py-1.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center justify-center gap-1"
                    >
                      <span>Open Manager Portal to Clear Bill</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Receipt className="w-4 h-4" />
                  <span>Raise Challan / Bill to Manager (₹{Number(maintCost || 0).toLocaleString('en-IN')}) →</span>
                </button>
              </form>
            </div>
          </div>

          {/* Right 8 Columns: Interactive SVG Tyre Blueprint + AI Weibull Survival Analysis + RTO Compliance Watchdog */}
          <div className="lg:col-span-8 space-y-6">
            <AxleTyreBlueprint truckNumber={selectedTruckNumber} tyres={tyres} />

            {/* AI Weibull Component Survival Hazard Panel */}
            {weibullReport?.components && (
              <div className="bento-card p-5 border border-cyan-500/25">
                <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-2">
                  <div>
                    <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold">
                      PANEL 3B • AI WEIBULL SURVIVAL ANALYSIS ({weibullReport.model_version})
                    </span>
                    <h4 className="text-sm font-bold text-slate-100 font-mono">
                      {selectedTruckNumber} • Component Failure Hazard (Next 1,500 km Window)
                    </h4>
                  </div>
                  <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-slate-900 text-emerald-400 border border-slate-700">
                    Survival Health: {weibullReport.overall_health_score}%
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-3 font-mono text-xs">
                  {weibullReport.components.map((comp: any, i: number) => (
                    <div key={i} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-200">{comp.component}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            comp.failure_probability >= 70
                              ? 'bg-rose-950 text-rose-400 border border-rose-800'
                              : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          }`}
                        >
                          {comp.failure_probability}% Hazard
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

            {/* RTO & Insurance Compliance Watchdog Strip */}
            {complianceItems.length > 0 && (
              <div className="bento-card p-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 font-mono text-xs">
                  <span className="font-bold text-slate-200 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    RTO PERMIT, FITNESS & INSURANCE COMPLIANCE WATCHDOG
                  </span>
                  <span className="text-[10px] text-slate-400">{complianceItems.length} Alerts • Click to Raise Bill to Manager</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-3 font-mono text-[11px]">
                  {complianceItems.slice(0, 6).map((item: any, idx: number) => {
                    const reg = item.regNumber || item.truck || selectedTruckNumber;
                    const docKind = String(item.document || item.kind || 'fitness').toLowerCase();
                    const mappedComp = docKind.includes('permit')
                      ? 'NATIONAL_PERMIT'
                      : docKind.includes('tax')
                      ? 'STATE_TAX_CHALLAN'
                      : docKind.includes('puc') || docKind.includes('ins')
                      ? 'PUC_INSURANCE'
                      : 'RTO_FITNESS';
                    const defaultFee = mappedComp === 'NATIONAL_PERMIT' ? 16500 : mappedComp === 'RTO_FITNESS' ? 4500 : 3800;
                    return (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between gap-2"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-bold text-slate-200">{reg}</div>
                            <div className="text-[10px] text-slate-400 uppercase">{item.document || item.kind || 'RTO Fitness'}</div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-amber-950 text-amber-300 border border-amber-800">
                            {item.daysRemaining !== undefined ? `${item.daysRemaining}d left` : item.status || 'DUE'}
                          </span>
                        </div>
                        <button
                          onClick={async () => {
                            await handleRaiseMaintenance(undefined, {
                              truckReg: reg,
                              component: mappedComp,
                              description: `RTO Compliance Renewal (${item.document || item.kind || 'Fitness'}) for ${reg}`,
                              cost: defaultFee,
                            });
                            navigateToPortal('MANAGER', {
                              truckNumber: reg,
                              message: `STAFF raised ${mappedComp} Renewal Bill (₹${defaultFee.toLocaleString('en-IN')}) for ${reg} → Ready for Manager Clearance`,
                            });
                          }}
                          className="w-full py-1 px-2 rounded-lg bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-800 text-[10px] font-bold flex items-center justify-center gap-1"
                        >
                          <span>Raise Renewal to Manager (₹{defaultFee.toLocaleString('en-IN')})</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          SECTION 4: DRIVER ATTENDANCE ROSTER, BHATTA & CORPORATE CREDIT GUARD
         ===================================================================== */}
      {(activeTab === 'ALL' || activeTab === 'ATTENDANCE_CREDIT') && (
        <div className="space-y-6">
          {/* Driver Daily Attendance & Bhatta Advance Panel */}
          <div className="bento-card p-6">
            <div className="flex flex-wrap items-center justify-between pb-4 border-b border-slate-800 gap-2">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-base font-bold text-slate-100 font-mono">
                    PANEL 4A • DRIVER & CREW DAILY ATTENDANCE & TRIP BHATTA ROSTER ({todayIso})
                  </h3>
                  <p className="text-xs text-slate-400">
                    1-click attendance logging synced directly with monthly Payroll & KM Incentive calculation
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded text-xs font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                {employees.length} Active Crew Members
              </span>
            </div>

            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900/60 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Code & Captain Name</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Assigned Truck</th>
                    <th className="py-2.5 px-3 text-right">Daily Bhatta</th>
                    <th className="py-2.5 px-3 text-center">Today's Status</th>
                    <th className="py-2.5 px-3 text-center">Log Attendance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {employees.slice(0, 8).map((emp: any) => {
                    const currentStatus = attendanceMap[emp._id] || 'ON_TRIP';
                    return (
                      <tr key={emp._id} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-bold text-slate-200">
                          {emp.code} • {emp.name}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">{emp.designation}</td>
                        <td className="py-2.5 px-3 text-cyan-300 font-semibold">
                          {emp.assignedTruck?.regNumber || 'Fleet Pool'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-400">
                          ₹{(emp.bhattaPerDay || 350).toLocaleString('en-IN')}/day
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-cyan-300 border border-slate-700">
                            {currentStatus}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {(['PRESENT', 'ON_TRIP', 'LEAVE'] as const).map((st) => (
                              <button
                                key={st}
                                onClick={() => handleMarkAttendance(emp._id, st)}
                                className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${
                                  currentStatus === st
                                    ? 'bg-emerald-600 text-slate-950 border-emerald-500'
                                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                                }`}
                              >
                                {st}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Client Credit Limit & Overdue Aging Table */}
          <div className="bento-card p-6">
            <div className="flex flex-wrap items-center justify-between pb-4 border-b border-slate-800 gap-2">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-400" />
                <div>
                  <h3 className="text-base font-bold text-slate-100 font-mono">
                    PANEL 4B • CORPORATE CLIENT CREDIT GUARD & BILLING LEDGER
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Automated 402 Payment Required block active when outstanding balance exceeds credit limit
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded text-xs font-mono bg-purple-950 text-purple-300 border border-purple-800">
                Automated Credit Guard: STRICT
              </span>
            </div>

            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-3">Client Name</th>
                    <th className="py-3 px-3">GSTIN</th>
                    <th className="py-3 px-3">Location</th>
                    <th className="py-3 px-3 text-right">Credit Limit</th>
                    <th className="py-3 px-3 text-right">Current Outstanding</th>
                    <th className="py-3 px-3 text-center">Credit Health</th>
                    <th className="py-3 px-3 text-center">Dispatch & PIN Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {clients.map((client) => {
                    const isOverLimit = client.currentOutstanding > client.creditLimit;
                    const utilizationPct = (client.currentOutstanding / client.creditLimit) * 100;
                    return (
                      <tr key={client._id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-3 font-bold text-slate-200">{client.companyName}</td>
                        <td className="py-3 px-3 text-slate-400">{client.gstin}</td>
                        <td className="py-3 px-3 text-slate-400">
                          {client.billingAddress?.city}, {client.billingAddress?.state}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-300">
                          ₹{client.creditLimit.toLocaleString('en-IN')}
                        </td>
                        <td
                          className={`py-3 px-3 text-right font-bold ${
                            isOverLimit ? 'text-rose-400' : 'text-slate-200'
                          }`}
                        >
                          ₹{client.currentOutstanding.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <div className="w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  isOverLimit
                                    ? 'bg-rose-500'
                                    : utilizationPct > 80
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, utilizationPct)}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-slate-400">{utilizationPct.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {isOverLimit ? (
                            <button
                              onClick={() =>
                                navigateToPortal('ADMIN', {
                                  clientId: client._id,
                                  message: `STAFF requested Executive PIN Credit Limit Override for ${client.companyName}`,
                                })
                              }
                              className="px-2.5 py-1 rounded text-[10px] font-bold bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-700 flex items-center justify-center gap-1 w-max mx-auto transition-colors"
                            >
                              <AlertTriangle className="w-3 h-3 text-rose-400" />
                              <span>Request Admin PIN Override →</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedClientId(client._id);
                                setActiveTab('BILTY_RECEIPTS');
                              }}
                              className="px-2.5 py-1 rounded text-[10px] font-bold bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 flex items-center justify-center gap-1 w-max mx-auto"
                            >
                              <CheckCircle className="w-3 h-3 text-emerald-400" />
                              <span>CLEARED • Book Bilty →</span>
                            </button>
                          )}
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

      {/* =====================================================================
          VIEW: DRIVER RECRUITMENT DESK (STAFF ROLE: CAN ONLY HIRE DRIVER)
         ===================================================================== */}
      {(activeTab === 'DRIVER_ONBOARDING' || activeTab === 'ALL') && (
        <WorkforceManagement portalRole="STAFF" />
      )}
      </div>
    </div>
  );
};
