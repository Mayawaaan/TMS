import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { driverApi, tripsApi } from '../../api/client';
import { Trip } from '../../types';
import { 
  Truck, 
  MapPin, 
  Fuel, 
  ShieldAlert, 
  CheckCircle, 
  Navigation, 
  Upload, 
  DollarSign, 
  ArrowRight, 
  LayoutDashboard, 
  Wallet, 
  Receipt, 
  Layers,
  AlertTriangle,
  FileText,
  User,
  Wrench,
  Calendar,
  Clock,
  Award,
  ShieldCheck,
  CheckCircle2,
  X,
  Eye,
  Phone,
  AlertOctagon,
  Sparkles,
  ChevronRight,
  RefreshCw,
  Flame,
} from 'lucide-react';

type DriverSection = 
  | 'ACTIVE_VOYAGE' 
  | 'FREIGHT_ANALYTICS' 
  | 'PROFILE_VEHICLE' 
  | 'WAGES_PAYROLL' 
  | 'DEDUCTIONS_FINES' 
  | 'RECEIPTS_VOUCHERS' 
  | 'LEAVE_REQUESTS' 
  | 'WRECKDOWN_SOS' 
  | 'VEHICLE_INSPECTIONS' 
  | 'ALL_STACKED';

export const DriverPortal: React.FC = () => {
  const { focusedTripId, navigateToPortal, setFocusedTripId } = useAuthStore();
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [allTrips, setAllTrips] = useState<Trip[]>([]);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<DriverSection>('ACTIVE_VOYAGE');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals & Forms State
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState<'FUEL' | 'TOLL' | 'REPAIR' | 'OTHER'>('FUEL');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [litres, setLitres] = useState('');
  const [stationName, setStationName] = useState('');

  // Leave Request Form State
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveType, setLeaveType] = useState<'CASUAL_LEAVE' | 'SICK_LEAVE' | 'EMERGENCY_FAMILY' | 'ANNUAL_PRIVILEGE'>('CASUAL_LEAVE');
  const [leaveFrom, setLeaveFrom] = useState('2026-11-05');
  const [leaveTo, setLeaveTo] = useState('2026-11-08');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveReliefDriver, setLeaveReliefDriver] = useState('Sukhwinder Gill');

  // Breakdown SOS Form State
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [breakdownType, setBreakdownType] = useState<'ENGINE_BREAKDOWN' | 'TYRE_BLOWOUT' | 'BRAKE_AIR_LEAK' | 'ACCIDENT_COLLISION' | 'POLICE_INTERCEPTION' | 'ELECTRICAL_FAILURE'>('BRAKE_AIR_LEAK');
  const [sosLocation, setSosLocation] = useState('NH-48 KM Marker 218 near Bharuch Bypass, Gujarat');
  const [sosDescription, setSosDescription] = useState('Secondary brake air pressure dropped below 60 PSI. Parked safely on shoulder.');
  const [sosUrgency, setSosUrgency] = useState<'CRITICAL_HALT' | 'MODERATE_SAFE_SHOULDER' | 'HIGHWAY_HAZARD'>('CRITICAL_HALT');

  // Vehicle Inspection (DVIR) State
  const [dvirType, setDvirType] = useState<'PRE_TRIP' | 'POST_TRIP'>('PRE_TRIP');
  const [dvirOdometer, setDvirOdometer] = useState('84620');
  const [dvirFuel, setDvirFuel] = useState('68');
  const [dvirDef, setDvirDef] = useState('82');
  const [dvirVerdict, setDvirVerdict] = useState<'ROAD_READY_CLEARED' | 'DEFECT_REPORTED_TO_WORKSHOP'>('ROAD_READY_CLEARED');
  const [dvirRemarks, setDvirRemarks] = useState('All 10 safety checkpoints inspected and verified road-ready.');
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    brakeAirPressure: true,
    tyreLugNutsAndTreads: true,
    engineOilAndCoolant: true,
    windshieldAndWipers: true,
    lightsAndIndicators: true,
    reverseBeeper: true,
    tarpaulinAndLashings: true,
    fireExtinguisher: true,
    fastagAndPucDocs: true,
    suspensionAndLeafSprings: true,
  });

  // Receipt Preview Modal
  const [previewReceipt, setPreviewReceipt] = useState<any>(null);

  useEffect(() => {
    loadDriverData();
  }, [focusedTripId]);

  const loadDriverData = async () => {
    setIsLoading(true);
    try {
      const [rawDashboard, fleetTrips] = await Promise.all([
        driverApi.getDashboard().catch(() => null),
        tripsApi.getTrips().catch(() => []),
      ]);

      if (rawDashboard) {
        setDashboardData(rawDashboard);
      }
      setAllTrips(fleetTrips || []);

      if (focusedTripId) {
        const target =
          fleetTrips.find((t: Trip) => t._id === focusedTripId) ||
          (await tripsApi.getTrip(focusedTripId).catch(() => null));
        if (target) {
          setActiveTrip(target);
          setIsLoading(false);
          return;
        }
      }

      if (rawDashboard?.activeTrip) {
        setActiveTrip(rawDashboard.activeTrip);
      } else if (fleetTrips && fleetTrips.length > 0) {
        setActiveTrip(fleetTrips[0]);
      }
    } catch (err) {
      console.error('Failed to load driver dashboard data', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (nextStatus: string) => {
    if (!activeTrip) return;
    try {
      await tripsApi.updateStatus(activeTrip._id, nextStatus, 'GPS Geofence: NH-48 Corridor');
      setFocusedTripId(activeTrip._id);
      setSuccessMsg(`Voyage status updated to ${nextStatus} & synced with Manager Ops.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      loadDriverData();
    } catch {
      alert('Failed to update voyage status');
    }
  };

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrip) return;
    try {
      await driverApi.uploadExpense(activeTrip._id, {
        category: expenseCategory,
        amount: Number(expenseAmount),
        litres: litres ? Number(litres) : undefined,
        fuelStation: stationName || undefined,
        paymentMode: 'PETRO_CARD',
      });
      setSuccessMsg('Expense voucher logged successfully & appended to Freight Direct Cost Ledger!');
      setTimeout(() => {
        setSuccessMsg('');
        setExpenseModalOpen(false);
        setExpenseAmount('');
        setLitres('');
        setStationName('');
        loadDriverData();
      }, 1500);
    } catch {
      alert('Failed to upload expense voucher');
    }
  };

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await driverApi.submitLeaveRequest({
        leaveType,
        fromDate: leaveFrom,
        toDate: leaveTo,
        reason: leaveReason,
        reliefDriver: leaveReliefDriver,
      });
      setSuccessMsg('Leave request submitted successfully & queued for Manager approval!');
      setLeaveModalOpen(false);
      setLeaveReason('');
      setTimeout(() => setSuccessMsg(''), 4000);
      loadDriverData();
    } catch {
      alert('Failed to submit leave request');
    }
  };

  const handleApproveLeave = async (leaveId: string) => {
    try {
      await driverApi.approveLeaveRequest(leaveId);
      setSuccessMsg(`Leave request ${leaveId} approved! Attendance roster updated.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      loadDriverData();
    } catch {
      alert('Failed to approve leave');
    }
  };

  const handleSubmitSOS = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await driverApi.submitBreakdownAlert({
        truckNumber: dashboardData?.truck?.registrationNumber || activeTrip?.truck?.registrationNumber || 'MH-04-GP-2819',
        breakdownType,
        location: sosLocation,
        description: sosDescription,
        urgency: sosUrgency,
      });
      setSuccessMsg('Emergency Highway SOS Broadcasted! Roadside mechanic patrol alerted.');
      setSosModalOpen(false);
      setTimeout(() => setSuccessMsg(''), 4000);
      loadDriverData();
    } catch {
      alert('Failed to broadcast SOS alert');
    }
  };

  const handleSubmitInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await driverApi.submitVehicleReport({
        truckNumber: dashboardData?.truck?.registrationNumber || activeTrip?.truck?.registrationNumber || 'MH-04-GP-2819',
        type: dvirType,
        odometer: Number(dvirOdometer),
        fuelLevelPct: Number(dvirFuel),
        defLevelPct: Number(dvirDef),
        verdict: dvirVerdict,
        checklist,
        remarks: dvirRemarks,
      });
      setSuccessMsg(`Vehicle Inspection Report (${dvirType}) submitted & recorded.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      loadDriverData();
    } catch {
      alert('Failed to submit vehicle inspection');
    }
  };

  // Safe Fallback Data Points
  const driverProfile = dashboardData?.driverProfile || {
    name: 'Rameshwar Singh Yadav',
    code: 'DRV-1042',
    phone: '+91 98201 55419',
    designation: 'SENIOR HEAVY COMMERCIAL DRIVER (HCV)',
    badgeNumber: 'MH-TR-2018-9921',
    licenseNumber: 'MH0420160082194',
    licenseExpiry: '2031-08-14',
    bloodGroup: 'O+',
    emergencyContactName: 'Sunita Yadav (Wife)',
    emergencyContactPhone: '+91 98201 44821',
    homeTown: 'Varanasi, Uttar Pradesh',
    aadhaarMasked: 'XXXX-XXXX-8921',
    bankAccountMasked: 'HDFC Bank •••• 4410',
    safetyRating: 4.92,
    joiningDate: '2022-04-10',
    totalVoyagesCompleted: 42,
    totalKilometersDriven: 46200,
    onTimeDeliveryRatePct: 98.4,
    fuelEfficiencyScore: 3.62,
  };

  const vehicleDetails = dashboardData?.truck || {
    registrationNumber: activeTrip?.truck?.registrationNumber || 'MH-04-GP-2819',
    make: 'Tata Motors',
    model: 'Signa 4825.TK 16-Wheeler Heavy Hauler',
    manufactureYear: 2023,
    axleConfiguration: '16W',
    bodyType: 'HEAVY CONTAINER CARRIER',
    capacityTons: 42,
    chassisNumber: 'MAT928194XJ882194',
    engineNumber: 'TC8294B678912',
    fastagTagId: 'FASTAG-AIRTEL-6629104',
    gpsDeviceId: 'TELTONIKA-FMB125-9921',
    currentOdometerKm: 84620,
    baselineKmpl: 3.5,
    liveTelematics: {
      speedKmph: 58,
      highwayName: 'NH-48 (Golden Quadrilateral Corridor)',
      locationMarker: 'Near Bharuch Bypass (Mile Marker KM 218)',
      dieselTankLevelPct: 68,
      dieselLitersAvailable: 210,
      dieselTankCapacityLiters: 310,
      defTankLevelPct: 82,
      batteryVoltage: 24.2,
      engineCoolantTempC: 84,
      engineOilPressurePsi: 55,
      tyrePressures: {
        frontAxlePsi: 120,
        driveAxlesPsi: 118,
        trailerAxlesPsi: 116,
        stepneyPsi: 120,
      },
    },
    compliance: {
      insurance: { policyNumber: 'ICICI-LOMBARD-TRK-882194', issuer: 'ICICI Lombard', expiryDate: '2027-03-31', status: 'ACTIVE_CLEARED' },
      fitness: { certificateNumber: 'MH04-FIT-2025-00912', issuer: 'RTO Thane Central', expiryDate: '2026-12-15', status: 'ACTIVE_CLEARED' },
      nationalPermit: { permitNumber: 'NP-IND-2024-88219', issuer: 'MoRTH Central', expiryDate: '2029-06-30', status: 'ALL_INDIA_VALID' },
      puc: { pucNumber: 'PUC-MH04-882910', issuer: 'Green Fuel Audit Agency', expiryDate: '2027-01-10', status: 'BS-VI_COMPLIANT' },
      roadTax: { receiptNumber: 'TAX-MH-2026-4412', issuer: 'Maharashtra Motor Vehicles Dept', expiryDate: '2027-04-30', status: 'PAID_ANNUAL' },
    },
  };

  const wages = dashboardData?.wagesSummary || {
    monthly: {
      month: '2026-10',
      baseSalary: 18000,
      tripBhatta: 14250,
      kmIncentive: 11400,
      safeDrivingBonus: 2500,
      grossEarnings: 46150,
      deductions: {
        trafficChallanFines: 1500,
        fuelShortagePenalties: 1410,
        cashAdvancesRecovered: 8000,
        totalDeductions: 10910,
      },
      netInHandDisbursed: 35240,
      disbursementStatus: 'PROCESSED_ACID_CLEARED',
      daysWorked: 24,
    },
    yearly: {
      financialYear: 'FY 2026-27 (Apr 2026 – Mar 2027)',
      totalGrossEarnings: 432500,
      totalBhattaDisbursed: 162000,
      totalKmIncentives: 124500,
      totalFinesDeducted: 8500,
      totalFuelPenalties: 4230,
      totalNetInHandReceived: 342200,
      monthsOnPayroll: 7,
      avgMonthlyPayout: 48885,
    },
    pastPayslips: [
      { month: '2026-09', base: 18000, bhatta: 15000, kmIncentive: 12000, deductions: 9500, net: 35500, status: 'PAID' },
      { month: '2026-08', base: 18000, bhatta: 13500, kmIncentive: 10800, deductions: 7200, net: 35100, status: 'PAID' },
      { month: '2026-07', base: 18000, bhatta: 14250, kmIncentive: 11400, deductions: 8000, net: 35650, status: 'PAID' },
    ],
  };

  const completedTripsList = dashboardData?.completedTrips || allTrips.filter((t) =>
    ['POD_UPLOADED', 'POD_RECEIVED', 'INVOICED', 'SETTLED', 'COMPLETED', 'UNLOADED'].includes(t.status)
  );

  const challanReceiptsList = dashboardData?.challanReceipts || [
    {
      id: 'CHL-MH-2026-9921',
      noticeNumber: 'MH-RTO-THANE-2026-00412',
      challanType: 'SPEED_OVER_LIMIT',
      description: 'Exceeded 60 km/h limit on Expressway (Recorded: 68 km/h)',
      location: 'Khopoli Ghat Section, MH',
      fineAmount: 1500,
      date: '2026-10-14',
      paymentStatus: 'DEDUCTED_FROM_PAYSLIP',
      receiptNumber: 'REC-EXP-449102',
    },
    {
      id: 'CHL-GJ-2026-4410',
      noticeNumber: 'GJ-RTO-SURAT-2026-00819',
      challanType: 'NO_PARKING_HIGHWAY_LANE',
      description: 'Temporary breakdown halting without emergency triangle placed at 50m.',
      location: 'Kamrej Bypass, Gujarat',
      fineAmount: 1000,
      date: '2026-09-22',
      paymentStatus: 'CLEARED_BY_COMPANY',
      receiptNumber: 'REC-RTO-88210',
    },
  ];

  const fuelReceiptsList = dashboardData?.fuelReceipts || [
    {
      slipNo: 'SLIP-IOCL-88219',
      pumpName: 'Indian Oil Highway RO, Surat',
      liters: 115,
      ratePerLiter: 92.5,
      totalAmount: 10637.5,
      odometer: 84200,
      paymentMode: 'FLEET_CARD',
      state: 'APPROVED',
      date: '2026-10-28 07:15',
    },
    {
      slipNo: 'SLIP-BPCL-44120',
      pumpName: 'Bharat Petroleum Oasis Hub, Vapi',
      liters: 95,
      ratePerLiter: 92.8,
      totalAmount: 8816,
      odometer: 83850,
      paymentMode: 'FLEET_CARD',
      state: 'APPROVED',
      date: '2026-10-27 19:30',
    },
  ];

  const tollReceiptsList = dashboardData?.tollReceipts || [
    { plazaName: 'Charoti Toll Plaza (NH-48)', transactionId: 'FTAG-TXN-99821041', amount: 345, dateTime: '2026-10-28 08:42', lane: 'Lane 04' },
    { plazaName: 'Khadki Toll Plaza (NH-48)', transactionId: 'FTAG-TXN-99821098', amount: 285, dateTime: '2026-10-28 11:15', lane: 'Lane 02' },
    { plazaName: 'Boriach Toll Plaza (NH-48)', transactionId: 'FTAG-TXN-99821144', amount: 410, dateTime: '2026-10-28 15:20', lane: 'Lane 06' },
  ];

  const leavesData = dashboardData?.leaves || {
    balance: { totalAllowedYearly: 18, takenYearToDate: 4, remainingBalance: 14 },
    requests: [
      {
        id: 'LV-2026-001',
        driverName: 'Rameshwar Singh Yadav',
        leaveType: 'CASUAL_LEAVE',
        fromDate: '2026-11-05',
        toDate: '2026-11-08',
        daysCount: 3,
        reason: 'Family wedding ceremony in hometown (Varanasi, UP)',
        reliefDriver: 'Sukhwinder Gill',
        status: 'APPROVED_BY_MANAGER',
        appliedAt: '2026-10-24T10:30:00.000Z',
        approvedBy: 'MANAGER_OPS',
      },
      {
        id: 'LV-2026-002',
        driverName: 'Rameshwar Singh Yadav',
        leaveType: 'SICK_LEAVE',
        fromDate: '2026-11-18',
        toDate: '2026-11-20',
        daysCount: 2,
        reason: 'Routine eye checkup and dental treatment',
        reliefDriver: 'Balwinder Singh',
        status: 'PENDING_MANAGER_APPROVAL',
        appliedAt: '2026-10-28T09:00:00.000Z',
      },
    ],
  };

  const breakdownsList = dashboardData?.breakdowns || [
    {
      id: 'SOS-88219-01',
      truckNumber: 'MH-04-GP-2819',
      breakdownType: 'BRAKE_AIR_LEAK',
      location: 'NH-48 KM Marker 218 near Bharuch Toll Plaza, Gujarat',
      description: 'Rear axle secondary air valve pressure dropped below 60 PSI, parked safely on shoulder.',
      urgency: 'CRITICAL_HALT',
      status: 'MECHANIC_EN_ROUTE',
      timestamp: '2026-10-28T18:45:00.000Z',
      mechanicUnit: 'Surat Highway Roadside Heavy Patrol #4',
      estimatedArrivalMin: 18,
    },
  ];

  const inspectionsList = dashboardData?.inspections || [
    {
      id: 'DVIR-2026-0104',
      truckNumber: 'MH-04-GP-2819',
      type: 'PRE_TRIP',
      odometer: 84620,
      fuelLevelPct: 68,
      defLevelPct: 82,
      tyreAirPsiAvg: 118,
      verdict: 'ROAD_READY_CLEARED',
      remarks: 'Pre-trip DVIR verified all systems optimal before departure from Kalamboli hub.',
      timestamp: '2026-10-28T06:30:00.000Z',
    },
  ];

  // Sidebar Navigation Structure
  const sidebarNav = [
    {
      group: 'VOYAGE & OPERATIONS',
      items: [
        { id: 'ACTIVE_VOYAGE', label: 'Current Voyage', icon: Navigation, badge: activeTrip?.status || 'Active', color: 'text-rose-400' },
        { id: 'FREIGHT_ANALYTICS', label: 'Freight Analytics', icon: Award, badge: `${driverProfile.totalVoyagesCompleted} Done`, color: 'text-cyan-400' },
        { id: 'PROFILE_VEHICLE', label: 'Driver & Truck Specs', icon: User, badge: vehicleDetails.registrationNumber, color: 'text-purple-400' },
      ],
    },
    {
      group: 'FINANCE, WAGES & FINES',
      items: [
        { id: 'WAGES_PAYROLL', label: 'Wages & Salary (YTD)', icon: Wallet, badge: `₹${Math.round(wages.monthly.netInHandDisbursed / 1000)}k Net`, color: 'text-emerald-400' },
        { id: 'DEDUCTIONS_FINES', label: 'Fines & Shortages', icon: ShieldAlert, badge: `-₹${wages.monthly.deductions.totalDeductions.toLocaleString('en-IN')}`, alert: true, color: 'text-amber-400' },
        { id: 'RECEIPTS_VOUCHERS', label: 'Receipts & Fuel Slips', icon: Receipt, badge: 'Gallery', color: 'text-cyan-300' },
      ],
    },
    {
      group: 'SAFETY & HR CABIN',
      items: [
        { id: 'LEAVE_REQUESTS', label: 'Leave Requests', icon: Calendar, badge: `${leavesData.balance.remainingBalance}d Left`, color: 'text-purple-300' },
        { id: 'WRECKDOWN_SOS', label: 'Highway Wreckdown SOS', icon: AlertOctagon, badge: 'SOS Console', alert: breakdownsList.length > 0, color: 'text-rose-500' },
        { id: 'VEHICLE_INSPECTIONS', label: 'Vehicle Reports (DVIR)', icon: FileText, badge: 'Road Ready', color: 'text-emerald-300' },
      ],
    },
    {
      group: 'UNIFIED VIEW',
      items: [
        { id: 'ALL_STACKED', label: 'All Cabin Modules', icon: Layers, badge: 'Full Stack', color: 'text-slate-400' },
      ],
    },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start pb-24">
      {/* =====================================================================
          DRIVER DEDICATED LEFT SIDEBAR
         ===================================================================== */}
      <aside className="w-full lg:w-72 shrink-0 lg:sticky lg:top-20 space-y-4">
        {/* Driver Brand Card */}
        <div className="bento-card p-4 border border-rose-500/30 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-rose-950 text-rose-400 border border-rose-800 flex items-center justify-center font-bold">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold font-mono text-white truncate max-w-[140px]">
                  {driverProfile.name}
                </div>
                <div className="text-[10px] text-rose-400 font-mono">
                  {driverProfile.code} • HCV Pilot
                </div>
              </div>
            </div>
            <span className="flex items-center gap-1 text-[9px] font-mono text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              ONLINE
            </span>
          </div>

          <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-[10px] font-mono">
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-400 block">ASSIGNED TRUCK</span>
              <span className="text-xs font-bold text-white truncate block">
                {vehicleDetails.registrationNumber}
              </span>
            </div>
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-400 block">MONTHLY NET</span>
              <span className="text-xs font-bold text-emerald-400">
                ₹{wages.monthly.netInHandDisbursed.toLocaleString('en-IN')}
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
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id as DriverSection)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-mono transition-all text-left ${
                        isActive
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-md font-bold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-rose-300' : item.color}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 ml-1.5 ${
                          (item as any).alert
                            ? 'bg-amber-950 text-amber-300 border border-amber-700 font-bold'
                            : isActive
                            ? 'bg-rose-950/80 text-rose-300 border border-rose-700/60'
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

        {/* Tactical Quick Action Triggers */}
        <div className="space-y-2">
          <button
            onClick={() => setExpenseModalOpen(true)}
            className="w-full py-2.5 px-3 rounded-xl text-xs font-mono font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 flex items-center justify-center gap-2 transition-all shadow-md"
          >
            <Fuel className="w-4 h-4 text-amber-400" />
            <span>+ Log Fuel / Toll Slip</span>
          </button>
          <button
            onClick={() => setSosModalOpen(true)}
            className="w-full py-2.5 px-3 rounded-xl text-xs font-mono font-bold bg-rose-600/30 hover:bg-rose-600/40 text-rose-200 border border-rose-500/60 flex items-center justify-center gap-2 transition-all shadow-glow-rose"
          >
            <AlertOctagon className="w-4 h-4 text-rose-400 animate-pulse" />
            <span>Highway Breakdown SOS</span>
          </button>
          <button
            onClick={() => setLeaveModalOpen(true)}
            className="w-full py-2.5 px-3 rounded-xl text-xs font-mono font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 flex items-center justify-center gap-2 transition-all"
          >
            <Calendar className="w-4 h-4 text-purple-400" />
            <span>Apply For Leave</span>
          </button>
        </div>

        {/* Cross-Portal Switchers */}
        <div className="bento-card p-3 border border-slate-800 space-y-2">
          <div className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">
            Switch View
          </div>
          <button
            onClick={() =>
              navigateToPortal('MANAGER', {
                tripId: activeTrip?._id,
                message: `Driver handed off ${activeTrip?.tripNumber || 'voyage'} to Manager for verification`,
              })
            }
            className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-mono text-slate-300 border border-slate-800 hover:border-emerald-500/40 transition-all text-left"
          >
            <div className="flex items-center gap-2">
              <Truck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Manager Ops</span>
            </div>
            <span className="text-[10px] text-emerald-400">View →</span>
          </button>
          <button
            onClick={() =>
              navigateToPortal('STAFF', {
                tripId: activeTrip?._id,
                message: `Driver checking staff billing for ${activeTrip?.tripNumber || 'trip'}`,
              })
            }
            className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-mono text-slate-300 border border-slate-800 hover:border-amber-500/40 transition-all text-left"
          >
            <div className="flex items-center gap-2">
              <Receipt className="w-3.5 h-3.5 text-amber-400" />
              <span>Staff Desk</span>
            </div>
            <span className="text-[10px] text-amber-400">View →</span>
          </button>
        </div>
      </aside>

      {/* =====================================================================
          MAIN DRIVER CONTENT WORKSPACE AREA
         ===================================================================== */}
      <div className="flex-1 w-full min-w-0 space-y-6">
        {/* Top Executive Driver Header */}
        <div className="bg-gradient-to-r from-rose-950/80 via-slate-900 to-obsidian-surface p-6 rounded-2xl border border-rose-500/30 shadow-2xl relative overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-rose-950 text-rose-300 border border-rose-800">
                  ROLE: HEAVY COMMERCIAL PILOT
                </span>
                <span className="px-2.5 py-1 rounded-lg text-xs font-mono bg-cyan-950 text-cyan-300 border border-cyan-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  SAFETY SCORE: {driverProfile.safetyRating} ★ (EXEMPLARY)
                </span>
                <span className="px-2.5 py-1 rounded-lg text-xs font-mono bg-purple-950 text-purple-300 border border-purple-800">
                  {driverProfile.onTimeDeliveryRatePct}% ON-TIME RATE
                </span>
              </div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight mt-2 font-mono">
                {driverProfile.name} • {vehicleDetails.registrationNumber}
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                License: <span className="text-slate-200 font-mono font-semibold">{driverProfile.licenseNumber}</span> (Valid till {driverProfile.licenseExpiry}) • Highway Corridor Pilot Console
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadDriverData}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4 text-cyan-400" />
                <span>Sync Cabin Telemetry</span>
              </button>
            </div>
          </div>
        </div>

        {successMsg && (
          <div className="p-3.5 bg-emerald-950/80 border border-emerald-500 text-emerald-300 rounded-2xl text-xs font-mono flex items-center gap-2.5 shadow-lg">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* =====================================================================
            MODULE 1: ONGOING FREIGHT VOYAGE & ADVANCE CASH AUDIT
           ===================================================================== */}
        {(activeSection === 'ACTIVE_VOYAGE' || activeSection === 'ALL_STACKED') && activeTrip && (
          <div className="bento-card p-6 border border-rose-500/25 space-y-6">
            <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-3">
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                  Active Dispatch Consignment
                </span>
                <div className="flex items-center gap-3 mt-1">
                  <h2 className="text-lg font-bold font-mono text-white">
                    {activeTrip.tripNumber}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                    STATUS: {activeTrip.status}
                  </span>
                </div>
              </div>
              <div className="text-right font-mono text-xs">
                <span className="text-slate-400 block text-[10px]">CLIENT CONSIGNOR</span>
                <span className="font-bold text-slate-200">{activeTrip.client?.companyName || 'Tata Steel Limited'}</span>
              </div>
            </div>

            {/* Highway Corridor Map Progression Visualizer */}
            <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-3 font-mono">
              <div className="flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400 uppercase">ORIGIN DISPATCH HUB</span>
                  <div className="text-base font-bold text-white flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    <span>{activeTrip.route?.originCity || 'Mumbai (Kalamboli Yard)'}</span>
                  </div>
                </div>

                <div className="flex-1 mx-6 flex flex-col items-center">
                  <div className="text-[10px] text-cyan-400 mb-1 flex items-center gap-1">
                    <Navigation className="w-3 h-3 animate-spin" />
                    <span>{vehicleDetails.liveTelematics.highwayName}</span>
                  </div>
                  <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden relative">
                    <div className="h-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-rose-500 rounded-full w-3/5" />
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {activeTrip.route?.distanceKm || 1420} KM Total • ~540 KM Remaining
                  </div>
                </div>

                <div className="space-y-0.5 text-right">
                  <span className="text-[10px] text-slate-400 uppercase">DESTINATION UNLOADING HUB</span>
                  <div className="text-base font-bold text-white flex items-center justify-end gap-1.5">
                    <span>{activeTrip.route?.destinationCity || 'Delhi (Okhla Phase-III)'}</span>
                    <MapPin className="w-4 h-4 text-rose-400" />
                  </div>
                </div>
              </div>

              {/* Geofence & Location Marker Banner */}
              <div className="pt-3 border-t border-slate-900 flex flex-wrap items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Current GPS Geofence: <strong className="text-cyan-300">{vehicleDetails.liveTelematics.locationMarker}</strong></span>
                </div>
                <div>
                  Cargo Weight: <strong className="text-slate-200">28.5 MT TMT Steel Coils</strong> • E-Way Bill: <strong className="text-purple-300">EWB-2026-992104</strong>
                </div>
              </div>
            </div>

            {/* Freight Cash Taken, Advances & Toll Pass Allocation */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 font-mono text-xs">
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] block">CASH ADVANCE TAKEN</span>
                <span className="text-base font-bold text-emerald-400">
                  ₹{(activeTrip.financials?.driverAdvanceGiven || 8000).toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-slate-400 block">Drawn at Kalamboli loading hub</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] block">FASTAG TOLL ALLOWANCE</span>
                <span className="text-base font-bold text-cyan-300">
                  ₹{(activeTrip.financials?.tollExpenses || 4200).toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-slate-400 block">Auto-debited across NH-48 plazas</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] block">PUMP DIESEL VOUCHERS</span>
                <span className="text-base font-bold text-amber-400">
                  ₹{(activeTrip.financials?.dieselExpenses || 18500).toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-slate-400 block">Authorized on Indian Oil fleet card</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] block">CASH IN HAND BALANCE</span>
                <span className="text-base font-bold text-purple-300">₹2,400</span>
                <span className="text-[10px] text-slate-400 block">Halting & state border allowance</span>
              </div>
            </div>

            {/* Tactile Status Progression Action Controls */}
            <div className="space-y-3 pt-2">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                Voyage Progression Actions
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                <button
                  onClick={() => handleUpdateStatus('IN_TRANSIT')}
                  className="p-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold flex flex-col items-center justify-center gap-1.5 transition-all shadow-glow-cyan"
                >
                  <Navigation className="w-4 h-4" />
                  <span>Mark IN TRANSIT</span>
                </button>
                <button
                  onClick={() => handleUpdateStatus('LOADED')}
                  className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold flex flex-col items-center justify-center gap-1.5 transition-all"
                >
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>Dhaba Halting (Rest)</span>
                </button>
                <button
                  onClick={() => handleUpdateStatus('UNLOADED')}
                  className="p-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold flex flex-col items-center justify-center gap-1.5 transition-all"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>At Unloading Yard</span>
                </button>
                <button
                  onClick={() => handleUpdateStatus('POD_UPLOADED')}
                  className="p-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold flex flex-col items-center justify-center gap-1.5 transition-all shadow-glow-emerald"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Signed POD</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            MODULE 2: DRIVER PROFILE & ASSIGNED VEHICLE SPECS + TELEMETRICS
           ===================================================================== */}
        {(activeSection === 'PROFILE_VEHICLE' || activeSection === 'ALL_STACKED') && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Driver Identity & License Profile */}
            <div className="lg:col-span-5 bento-card p-6 space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-purple-950 text-purple-400 border border-purple-800">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">LOGGED-IN DRIVER DOSSIER</h3>
                    <p className="text-[10px] text-slate-400">Verified HCV Driver Credentials</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                  KYC VERIFIED
                </span>
              </div>

              <div className="space-y-2.5">
                <div className="flex justify-between py-1.5 border-b border-slate-900">
                  <span className="text-slate-400">Full Name</span>
                  <span className="font-bold text-white">{driverProfile.name}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-900">
                  <span className="text-slate-400">Employee Code</span>
                  <span className="font-bold text-cyan-300">{driverProfile.code}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-900">
                  <span className="text-slate-400">Mobile Phone</span>
                  <span className="font-bold text-slate-200">{driverProfile.phone}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-900">
                  <span className="text-slate-400">Commercial License #</span>
                  <span className="font-bold text-amber-400">{driverProfile.licenseNumber}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-900">
                  <span className="text-slate-400">License Expiry</span>
                  <span className="text-slate-200">{driverProfile.licenseExpiry} (Active)</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-900">
                  <span className="text-slate-400">Hometown</span>
                  <span className="text-slate-300">{driverProfile.homeTown}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-900">
                  <span className="text-slate-400">Blood Group</span>
                  <span className="font-bold text-rose-400">{driverProfile.bloodGroup}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-900">
                  <span className="text-slate-400">Emergency Contact</span>
                  <span className="text-slate-300">{driverProfile.emergencyContactName} ({driverProfile.emergencyContactPhone})</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-900">
                  <span className="text-slate-400">Bank Settlement</span>
                  <span className="text-slate-300">{driverProfile.bankAccountMasked}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Joining Date</span>
                  <span className="text-slate-400">{driverProfile.joiningDate}</span>
                </div>
              </div>
            </div>

            {/* Assigned Vehicle Specs, Telematics & 5 Compliance Documents */}
            <div className="lg:col-span-7 bento-card p-6 space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">ASSIGNED VEHICLE SPECIFICATIONS</h3>
                    <p className="text-[10px] text-slate-400">
                      {vehicleDetails.make} • {vehicleDetails.model}
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-cyan-300 border border-slate-800">
                  {vehicleDetails.axleConfiguration} • {vehicleDetails.capacityTons} MT
                </span>
              </div>

              {/* Telematics Gauge Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">ODOMETER KM</span>
                  <span className="text-sm font-bold text-white mt-0.5 block">
                    {vehicleDetails.currentOdometerKm.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">DIESEL TANK</span>
                  <span className="text-sm font-bold text-emerald-400 mt-0.5 block">
                    {vehicleDetails.liveTelematics.dieselLitersAvailable} L ({vehicleDetails.liveTelematics.dieselTankLevelPct}%)
                  </span>
                </div>
                <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">DEF FLUID</span>
                  <span className="text-sm font-bold text-cyan-300 mt-0.5 block">
                    {vehicleDetails.liveTelematics.defTankLevelPct}% Level
                  </span>
                </div>
                <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">TYRE AIR (AVG)</span>
                  <span className="text-sm font-bold text-slate-200 mt-0.5 block">
                    {vehicleDetails.liveTelematics.tyrePressures.frontAxlePsi} PSI
                  </span>
                </div>
              </div>

              {/* 5 RTO Compliance Certificates */}
              <div className="pt-2 space-y-2">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                  Mandatory Statutory Compliance Certificates
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800 flex justify-between items-center">
                    <div>
                      <span className="text-white font-bold block">1. Commercial Insurance</span>
                      <span className="text-[10px] text-slate-400">{vehicleDetails.compliance.insurance.policyNumber}</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold">
                      Valid {vehicleDetails.compliance.insurance.expiryDate}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800 flex justify-between items-center">
                    <div>
                      <span className="text-white font-bold block">2. RTO Fitness Certificate</span>
                      <span className="text-[10px] text-slate-400">{vehicleDetails.compliance.fitness.certificateNumber}</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold">
                      Valid {vehicleDetails.compliance.fitness.expiryDate}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800 flex justify-between items-center">
                    <div>
                      <span className="text-white font-bold block">3. All India National Permit</span>
                      <span className="text-[10px] text-slate-400">{vehicleDetails.compliance.nationalPermit.permitNumber}</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                      Valid 2029
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800 flex justify-between items-center">
                    <div>
                      <span className="text-white font-bold block">4. BS-VI PUC Certificate</span>
                      <span className="text-[10px] text-slate-400">{vehicleDetails.compliance.puc.pucNumber}</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold">
                      Passed
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            MODULE 3: COMPLETED FREIGHTS & TOTAL ANALYTICS
           ===================================================================== */}
        {(activeSection === 'FREIGHT_ANALYTICS' || activeSection === 'ALL_STACKED') && (
          <div className="bento-card p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 font-mono">
                <Award className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase">
                  COMPLETED FREIGHT VOYAGES & PERFORMANCE ANALYTICS
                </h3>
              </div>
              <span className="text-xs font-mono text-cyan-300">
                Lifetime Total: {driverProfile.totalVoyagesCompleted} Commercial Freights
              </span>
            </div>

            {/* 4 Performance KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 font-mono">
              <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">TOTAL VOYAGES COMPLETED</span>
                <span className="text-2xl font-extrabold text-white mt-1 block">
                  {driverProfile.totalVoyagesCompleted} <span className="text-xs text-slate-500 font-normal">Trips</span>
                </span>
                <span className="text-[11px] text-emerald-400 mt-1 block">100% Verified Delivery PODs</span>
              </div>
              <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">TOTAL DISTANCE DRIVEN</span>
                <span className="text-2xl font-extrabold text-cyan-300 mt-1 block">
                  {(driverProfile.totalKilometersDriven / 1000).toFixed(1)}k <span className="text-xs text-slate-500 font-normal">KM</span>
                </span>
                <span className="text-[11px] text-cyan-400 mt-1 block">Golden Quad Highway Network</span>
              </div>
              <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">ON-TIME DELIVERY RATE</span>
                <span className="text-2xl font-extrabold text-emerald-400 mt-1 block">
                  {driverProfile.onTimeDeliveryRatePct}%
                </span>
                <span className="text-[11px] text-slate-400 mt-1 block">Zero delay penalty deductions</span>
              </div>
              <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">KMPL FUEL ECONOMY</span>
                <span className="text-2xl font-extrabold text-purple-300 mt-1 block">
                  {driverProfile.fuelEfficiencyScore} <span className="text-xs text-slate-500 font-normal">KMPL</span>
                </span>
                <span className="text-[11px] text-purple-400 mt-1 block">+0.12 vs OEM Rated Baseline</span>
              </div>
            </div>

            {/* Completed Freight History Table */}
            <div className="overflow-x-auto font-mono text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-900/80 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Trip LR #</th>
                    <th className="py-2.5 px-3">Corridor</th>
                    <th className="py-2.5 px-3">Client</th>
                    <th className="py-2.5 px-3 text-right">Distance</th>
                    <th className="py-2.5 px-3 text-right">Advance Paid</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Signed POD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {completedTripsList.slice(0, 8).map((t: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-bold text-slate-200">{t.tripNumber}</td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {t.route?.originCity || 'Mumbai'} → {t.route?.destinationCity || 'Delhi'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 truncate max-w-[140px]">
                        {t.client?.companyName || 'JSW Steel Logistics'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-300">{t.route?.distanceKm || 1420} km</td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                        ₹{(t.financials?.driverAdvanceGiven || 8000).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                          {t.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() =>
                            setPreviewReceipt({
                              title: `Signed Proof of Delivery (POD) • ${t.tripNumber}`,
                              type: 'PROOF_OF_DELIVERY',
                              amount: undefined,
                              url: '/receipts/pod-sample.png',
                              details: {
                                trip: t.tripNumber,
                                consignor: t.client?.companyName || 'Tata Steel Ltd',
                                consignee: 'National Heavy Works Depot, Delhi',
                                status: 'STAMPED & VERIFIED BY CONSIGNEE',
                              },
                            })
                          }
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-[10px] inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View POD</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =====================================================================
            MODULE 4: WAGES, MONTHLY & YEARLY EARNINGS
           ===================================================================== */}
        {(activeSection === 'WAGES_PAYROLL' || activeSection === 'ALL_STACKED') && (
          <div className="bento-card p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-3">
              <div className="flex items-center gap-2 font-mono">
                <Wallet className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-white uppercase">
                    DRIVER WAGES, MONTHLY & YEARLY EARNINGS
                  </h3>
                  <p className="text-xs text-slate-400">
                    Formula: Net = Base Retainer + Trip Bhatta + KM Incentive + Safety Bonus − Deductions
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-xl text-xs font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                DISBURSED VIA ACID LEDGER
              </span>
            </div>

            {/* Monthly Earnings Detailed Calculation Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                  <span className="font-bold text-white text-sm">CURRENT MONTH ({wages.monthly.month}) EARNINGS</span>
                  <span className="text-emerald-400 font-bold">{wages.monthly.daysWorked} Days Present</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Base Retainer Salary</span>
                  <span className="font-bold text-white">₹{wages.monthly.baseSalary.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Trip Bhatta (Food/Halting: 19d @ ₹750/d)</span>
                  <span className="font-bold text-emerald-400">₹{wages.monthly.tripBhatta.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">KM Driven Incentive (7,600 km @ ₹1.50/km)</span>
                  <span className="font-bold text-cyan-300">₹{wages.monthly.kmIncentive.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Zero-Incident Safety & On-Time Bonus</span>
                  <span className="font-bold text-purple-300">₹{wages.monthly.safeDrivingBonus.toLocaleString('en-IN')}</span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-sm">
                  <span className="text-slate-200">Total Monthly Gross Earnings</span>
                  <span className="text-emerald-300">₹{wages.monthly.grossEarnings.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Yearly Cumulative Earnings & Annual Retainer */}
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                  <span className="font-bold text-white text-sm">{wages.yearly.financialYear}</span>
                  <span className="text-cyan-400 font-bold">7 Months Active</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Year-To-Date Gross Income</span>
                  <span className="font-bold text-white">₹{wages.yearly.totalGrossEarnings.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Total Highway Bhatta Earned</span>
                  <span className="font-bold text-emerald-400">₹{wages.yearly.totalBhattaDisbursed.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Total KM Running Incentives</span>
                  <span className="font-bold text-cyan-300">₹{wages.yearly.totalKmIncentives.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Net Take-Home Disbursed (Annual)</span>
                  <span className="font-bold text-emerald-300">₹{wages.yearly.totalNetInHandReceived.toLocaleString('en-IN')}</span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-sm">
                  <span className="text-slate-200">Average Monthly Take-Home</span>
                  <span className="text-purple-300">₹{wages.yearly.avgMonthlyPayout.toLocaleString('en-IN')} / mo</span>
                </div>
              </div>
            </div>

            {/* Historical Payslips Table */}
            <div className="space-y-3 pt-2 font-mono text-xs">
              <h4 className="font-bold text-slate-200">PAST MONTHS PAYSLIP DISBURSEMENT ARCHIVE</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {wages.pastPayslips.map((p: any, idx: number) => (
                  <div key={idx} className="p-3.5 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white">{p.month}</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-800">
                        {p.status}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>Gross (Base + Bhatta)</span>
                      <span>₹{(p.base + p.bhatta + p.kmIncentive).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-rose-400 text-[11px]">
                      <span>Deductions</span>
                      <span>-₹{p.deductions.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-emerald-300">
                      <span>Net In-Hand</span>
                      <span>₹{p.net.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            MODULE 5: SALARY DEDUCTIONS FOR FINES, CHALLANS & SHORTAGES
           ===================================================================== */}
        {(activeSection === 'DEDUCTIONS_FINES' || activeSection === 'ALL_STACKED') && (
          <div className="bento-card p-6 border border-amber-500/30 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 font-mono">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold text-white uppercase">
                    SALARY DEDUCTIONS: TRAFFIC FINES, DIESEL SHORTAGE & ADVANCES
                  </h3>
                  <p className="text-xs text-slate-400">
                    Transparent ledger accounting: All penalties itemized prior to final bank disbursement
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-xl text-xs font-mono font-bold bg-rose-950 text-rose-300 border border-rose-800">
                TOTAL DEDUCTIONS: -₹{wages.monthly.deductions.totalDeductions.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
              <div className="p-4 bg-slate-950/80 rounded-2xl border border-rose-500/30 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-[10px]">1. TRAFFIC & RTO FINES</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-rose-950 text-rose-300 border border-rose-800">
                    POLICE RTO
                  </span>
                </div>
                <div className="text-xl font-bold text-rose-400">
                  -₹{wages.monthly.deductions.trafficChallanFines.toLocaleString('en-IN')}
                </div>
                <p className="text-[11px] text-slate-400">
                  Expressway speed violation recorded by automated interceptor cameras.
                </p>
              </div>

              <div className="p-4 bg-slate-950/80 rounded-2xl border border-amber-500/30 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-[10px]">2. FUEL SIPHONING PENALTY</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-950 text-amber-300 border border-amber-800">
                    ISOLATION FOREST
                  </span>
                </div>
                <div className="text-xl font-bold text-amber-400">
                  -₹{wages.monthly.deductions.fuelShortagePenalties.toLocaleString('en-IN')}
                </div>
                <p className="text-[11px] text-slate-400">
                  15 Liters unaccounted diesel deficit flagged below physics gradient baseline.
                </p>
              </div>

              <div className="p-4 bg-slate-950/80 rounded-2xl border border-cyan-500/30 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-[10px]">3. ADVANCES RECOVERED</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-cyan-950 text-cyan-300 border border-cyan-800">
                    CASH ADVANCE
                  </span>
                </div>
                <div className="text-xl font-bold text-cyan-300">
                  -₹{wages.monthly.deductions.cashAdvancesRecovered.toLocaleString('en-IN')}
                </div>
                <p className="text-[11px] text-slate-400">
                  Cash advances handed to driver at hub during dispatch for on-road expenses.
                </p>
              </div>
            </div>

            {/* Net In-Hand Disbursed Statement Banner */}
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800 flex flex-wrap items-center justify-between font-mono text-xs gap-3">
              <div>
                <span className="text-slate-400 text-[10px] block">FINAL NET IN-HAND DISBURSED TO BANK</span>
                <span className="text-2xl font-extrabold text-emerald-400">
                  ₹{wages.monthly.netInHandDisbursed.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Gross ₹{wages.monthly.grossEarnings.toLocaleString('en-IN')} − Deductions ₹{wages.monthly.deductions.totalDeductions.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setPreviewReceipt({
                      title: `Official Driver Monthly Payslip • ${wages.monthly.month}`,
                      type: 'PAYSLIP_RECEIPT',
                      amount: wages.monthly.netInHandDisbursed,
                      details: {
                        month: wages.monthly.month,
                        driver: driverProfile.name,
                        base: wages.monthly.baseSalary,
                        bhatta: wages.monthly.tripBhatta,
                        kmIncentive: wages.monthly.kmIncentive,
                        deductions: wages.monthly.deductions.totalDeductions,
                        net: wages.monthly.netInHandDisbursed,
                      },
                    })
                  }
                  className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1.5"
                >
                  <Eye className="w-4 h-4" />
                  <span>View Official Payslip Receipt</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            MODULE 6: RECEIPTS & VOUCHERS GALLERY (CHALLANS, FUELS, FASTAG)
           ===================================================================== */}
        {(activeSection === 'RECEIPTS_VOUCHERS' || activeSection === 'ALL_STACKED') && (
          <div className="bento-card p-6 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 font-mono">
                <Receipt className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase">
                  RECEIPTS & VOUCHERS GALLERY (CHALLANS, PUMP FUELS & TOLLS)
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Audited Digital Ledger Attachments
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-mono text-xs">
              {/* Challan Receipts List */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-slate-400 text-[11px] pb-1 border-b border-slate-800">
                  <span className="font-bold text-amber-400 uppercase">RTO & Traffic Challans</span>
                  <span>{challanReceiptsList.length} Receipts</span>
                </div>
                {challanReceiptsList.map((ch: any, idx: number) => (
                  <div key={idx} className="p-3 bg-slate-900/70 rounded-xl border border-slate-800 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-200">{ch.noticeNumber}</span>
                      <span className="text-rose-400 font-bold">₹{ch.fineAmount}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">{ch.description}</div>
                    <div className="flex justify-between items-center pt-1 text-[10px]">
                      <span className="text-slate-500">{ch.date}</span>
                      <button
                        onClick={() =>
                          setPreviewReceipt({
                            title: `Official RTO Challan Receipt • ${ch.noticeNumber}`,
                            type: 'CHALLAN_RECEIPT',
                            amount: ch.fineAmount,
                            details: {
                              notice: ch.noticeNumber,
                              location: ch.location,
                              reason: ch.description,
                              status: ch.paymentStatus,
                            },
                          })
                        }
                        className="text-cyan-400 hover:underline flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect Receipt</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pump Fuel Slips */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-slate-400 text-[11px] pb-1 border-b border-slate-800">
                  <span className="font-bold text-emerald-400 uppercase">Pump Fuel Slips</span>
                  <span>{fuelReceiptsList.length} Slips</span>
                </div>
                {fuelReceiptsList.map((fs: any, idx: number) => (
                  <div key={idx} className="p-3 bg-slate-900/70 rounded-xl border border-slate-800 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-200">{fs.slipNo}</span>
                      <span className="text-emerald-400 font-bold">₹{fs.totalAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {fs.pumpName} ({fs.liters} L @ ₹{fs.ratePerLiter}/L)
                    </div>
                    <div className="flex justify-between items-center pt-1 text-[10px]">
                      <span className="text-slate-500">Odo: {fs.odometer} km</span>
                      <button
                        onClick={() =>
                          setPreviewReceipt({
                            title: `Pump Diesel Slip • ${fs.slipNo}`,
                            type: 'FUEL_SLIP',
                            amount: fs.totalAmount,
                            details: {
                              slip: fs.slipNo,
                              pump: fs.pumpName,
                              litres: `${fs.liters} Litres`,
                              rate: `₹${fs.ratePerLiter} / L`,
                              mode: fs.paymentMode,
                              status: fs.state,
                            },
                          })
                        }
                        className="text-cyan-400 hover:underline flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View Slip</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* FASTag Toll Transactions */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-slate-400 text-[11px] pb-1 border-b border-slate-800">
                  <span className="font-bold text-cyan-400 uppercase">FASTag Toll Plazas</span>
                  <span>{tollReceiptsList.length} Plazas</span>
                </div>
                {tollReceiptsList.map((toll: any, idx: number) => (
                  <div key={idx} className="p-3 bg-slate-900/70 rounded-xl border border-slate-800 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-200">{toll.plazaName}</span>
                      <span className="text-cyan-300 font-bold">₹{toll.amount}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">{toll.transactionId} ({toll.lane})</div>
                    <div className="flex justify-between items-center pt-1 text-[10px] text-slate-500">
                      <span>{toll.dateTime}</span>
                      <span className="text-emerald-400">Auto-ETC Cleared</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            MODULE 7: DRIVER LEAVE REQUEST WORKFLOW (FULL MODEL UP TO APPROVAL)
           ===================================================================== */}
        {(activeSection === 'LEAVE_REQUESTS' || activeSection === 'ALL_STACKED') && (
          <div className="bento-card p-6 border border-purple-500/30 space-y-6">
            <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-3">
              <div className="flex items-center gap-2 font-mono">
                <Calendar className="w-5 h-5 text-purple-400" />
                <div>
                  <h3 className="text-sm font-bold text-white uppercase">
                    DRIVER LEAVE MANAGEMENT & ROSTER ALLOCATION
                  </h3>
                  <p className="text-xs text-slate-400">
                    Apply for medical, casual or festival leave with relief driver reassignment
                  </p>
                </div>
              </div>
              <button
                onClick={() => setLeaveModalOpen(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-mono font-bold bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1.5 shadow-lg"
              >
                <span>+ Apply New Leave</span>
              </button>
            </div>

            {/* Leave Balance Counters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-center">
              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800">
                <span className="text-slate-400 text-[10px] block">ANNUAL LEAVE QUOTA</span>
                <span className="text-2xl font-bold text-white mt-1 block">
                  {leavesData.balance.totalAllowedYearly} Days
                </span>
                <span className="text-[10px] text-slate-500">Calendar Year 2026</span>
              </div>
              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800">
                <span className="text-slate-400 text-[10px] block">LEAVES AVAILED</span>
                <span className="text-2xl font-bold text-amber-400 mt-1 block">
                  {leavesData.balance.takenYearToDate} Days
                </span>
                <span className="text-[10px] text-slate-500">Approved by Manager</span>
              </div>
              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800">
                <span className="text-slate-400 text-[10px] block">BALANCE REMAINING</span>
                <span className="text-2xl font-bold text-emerald-400 mt-1 block">
                  {leavesData.balance.remainingBalance} Days
                </span>
                <span className="text-[10px] text-emerald-400">Available For Application</span>
              </div>
            </div>

            {/* Leave Requests Table with Manager Approval Trigger */}
            <div className="space-y-3 font-mono text-xs">
              <h4 className="font-bold text-slate-200">LEAVE REQUESTS AUDIT & APPROVAL LOG</h4>
              <div className="space-y-3">
                {leavesData.requests.map((lv: any) => {
                  const isPending = lv.status === 'PENDING_MANAGER_APPROVAL';
                  return (
                    <div
                      key={lv.id}
                      className="p-4 bg-slate-900/70 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{lv.id}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-purple-300 border border-slate-700">
                            {lv.leaveType}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isPending
                              ? 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          }`}>
                            {lv.status}
                          </span>
                        </div>
                        <div className="text-slate-300 text-xs">
                          Duration: <strong>{lv.fromDate}</strong> to <strong>{lv.toDate}</strong> ({lv.daysCount} Days)
                        </div>
                        <div className="text-slate-400 text-[11px]">Reason: {lv.reason}</div>
                        <div className="text-[10px] text-slate-500">Relief Driver: {lv.reliefDriver || 'Assigned by Manager'}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isPending ? (
                          <button
                            onClick={() => handleApproveLeave(lv.id)}
                            className="px-3 py-2 rounded-xl text-xs font-mono font-bold bg-emerald-600 hover:bg-emerald-500 text-slate-950 flex items-center gap-1 shadow-md"
                            title="Simulate manager approval right now"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Approve Leave (Manager Action) →</span>
                          </button>
                        ) : (
                          <div className="text-right text-[11px] text-emerald-400">
                            <div>✓ Approved by {lv.approvedBy || 'MANAGER_OPS'}</div>
                            <div className="text-[10px] text-slate-500">Roster Locked</div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            MODULE 8: HIGHWAY WRECKDOWN & EMERGENCY SOS CONSOLE
           ===================================================================== */}
        {(activeSection === 'WRECKDOWN_SOS' || activeSection === 'ALL_STACKED') && (
          <div className="bento-card p-6 border border-rose-500/40 space-y-6">
            <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-3">
              <div className="flex items-center gap-2 font-mono">
                <AlertOctagon className="w-5 h-5 text-rose-500 animate-pulse" />
                <div>
                  <h3 className="text-sm font-bold text-white uppercase">
                    HIGHWAY WRECKDOWN & ROADSIDE BREAKDOWN SOS
                  </h3>
                  <p className="text-xs text-slate-400">
                    Instant emergency dispatch: Dispatches nearest NH patrol recovery unit and alerts fleet desk
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSosModalOpen(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-mono font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5 shadow-glow-rose"
              >
                <Flame className="w-4 h-4" />
                <span>+ Broadcast Emergency SOS</span>
              </button>
            </div>

            {/* Active Breakdown Alert Feed */}
            <div className="space-y-3 font-mono text-xs">
              {breakdownsList.map((sos: any) => (
                <div
                  key={sos.id}
                  className="p-5 rounded-2xl bg-slate-950/80 border border-rose-500/40 space-y-3 shadow-xl"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{sos.id}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                        {sos.breakdownType}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                        {sos.urgency}
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      {sos.status}
                    </span>
                  </div>

                  <div className="text-slate-300 text-xs">
                    Location: <strong className="text-cyan-300">{sos.location}</strong>
                  </div>
                  <div className="text-slate-400 text-xs">{sos.description}</div>

                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between text-[11px] gap-2">
                    <div className="flex items-center gap-2 text-slate-300">
                      <Wrench className="w-4 h-4 text-cyan-400" />
                      <span>Assigned Unit: <strong>{sos.mechanicUnit || 'Highway Heavy Recovery Patrol #4'}</strong></span>
                    </div>
                    <div className="text-emerald-400 font-bold">
                      Estimated Arrival: {sos.estimatedArrivalMin || 18} Minutes
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =====================================================================
            MODULE 9: DRIVER VEHICLE INSPECTION REPORTS (DVIR CHECKLIST)
           ===================================================================== */}
        {(activeSection === 'VEHICLE_INSPECTIONS' || activeSection === 'ALL_STACKED') && (
          <div className="bento-card p-6 border border-emerald-500/30 space-y-6">
            <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-3">
              <div className="flex items-center gap-2 font-mono">
                <FileText className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-white uppercase">
                    DRIVER VEHICLE INSPECTION REPORTS (DVIR 10-POINT CHECK)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Mandatory Pre-Trip and Post-Trip commercial vehicle road-readiness certification
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                LATEST: ROAD READY CLEARED
              </span>
            </div>

            {/* Interactive DVIR Checklist Submission */}
            <form onSubmit={handleSubmitInspection} className="p-5 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-4 font-mono text-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="text-slate-300 font-bold">SUBMIT DAILY DVIR REPORT:</span>
                  <select
                    value={dvirType}
                    onChange={(e) => setDvirType(e.target.value as any)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200"
                  >
                    <option value="PRE_TRIP">PRE-TRIP (Before Dispatch)</option>
                    <option value="POST_TRIP">POST-TRIP (After Unloading)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-slate-400">Odometer:</label>
                  <input
                    type="number"
                    value={dvirOdometer}
                    onChange={(e) => setDvirOdometer(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white w-24"
                  />
                  <label className="text-slate-400">Fuel %:</label>
                  <input
                    type="number"
                    value={dvirFuel}
                    onChange={(e) => setDvirFuel(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-emerald-400 w-16"
                  />
                </div>
              </div>

              {/* 10 Checklist Items */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                {Object.entries(checklist).map(([key, val]) => (
                  <label
                    key={key}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      val ? 'bg-emerald-950/20 border-emerald-800/60 text-slate-200' : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={val}
                      onChange={(e) => setChecklist({ ...checklist, [key]: e.target.checked })}
                      className="rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-0"
                    />
                    <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-slate-400 block mb-1">Inspection Verdict</label>
                  <select
                    value={dvirVerdict}
                    onChange={(e) => setDvirVerdict(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-bold"
                  >
                    <option value="ROAD_READY_CLEARED">✓ ROAD READY CLEARED (Safe For Highway Dispatch)</option>
                    <option value="DEFECT_REPORTED_TO_WORKSHOP">⚠ DEFECT REPORTED (Route To Nearest Workshop)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Driver Verification Remarks</label>
                  <input
                    type="text"
                    value={dvirRemarks}
                    onChange={(e) => setDvirRemarks(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl text-xs font-mono font-bold bg-emerald-600 hover:bg-emerald-500 text-slate-950 transition-all shadow-md"
              >
                Sign & Submit Vehicle Inspection Report (DVIR) →
              </button>
            </form>

            {/* Historical DVIR Log Table */}
            <div className="space-y-3 font-mono text-xs">
              <h4 className="font-bold text-slate-200">RECENT INSPECTION CERTIFICATES</h4>
              <div className="space-y-2.5">
                {inspectionsList.map((rep: any) => (
                  <div
                    key={rep.id}
                    className="p-3.5 bg-slate-900/60 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between text-xs gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{rep.id}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-cyan-300 border border-slate-700 font-bold">
                          {rep.type}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                          {rep.verdict}
                        </span>
                      </div>
                      <div className="text-slate-400 text-[11px] mt-1">{rep.remarks}</div>
                    </div>
                    <div className="text-right text-[11px]">
                      <div className="text-slate-300">Odometer: {rep.odometer} km</div>
                      <div className="text-slate-500">{new Date(rep.timestamp).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          EXPENSE / FUEL VOUCHER UPLOAD MODAL
         ===================================================================== */}
      {expenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-obsidian-surface border border-slate-700 p-6 rounded-2xl max-w-md w-full glass-panel-heavy shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-slate-100 font-mono flex items-center gap-2">
                <Upload className="w-4 h-4 text-amber-400" />
                <span>LOG EXPENSE / FUEL VOUCHER</span>
              </h3>
              <button onClick={() => setExpenseModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitExpense} className="space-y-4 text-xs font-mono">
              <div>
                <label className="text-slate-400 block mb-1">Expense Category</label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200"
                >
                  <option value="FUEL">FUEL (Diesel Refuel)</option>
                  <option value="TOLL">TOLL (FASTag / Cash Bridge)</option>
                  <option value="REPAIR">REPAIR (Emergency Tyre Puncture / Mech)</option>
                  <option value="OTHER">OTHER (State Border Tax / Halting)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Amount (₹)</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 8500"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 font-bold"
                />
              </div>

              {expenseCategory === 'FUEL' && (
                <>
                  <div>
                    <label className="text-slate-400 block mb-1">Litres Dispensed</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 95.5"
                      value={litres}
                      onChange={(e) => setLitres(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Fuel Station / RO Outlet</label>
                    <input
                      type="text"
                      placeholder="e.g. IOCL Highway Outlet, Surat"
                      value={stationName}
                      onChange={(e) => setStationName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setExpenseModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                >
                  Submit Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          LEAVE REQUEST APPLICATION MODAL
         ===================================================================== */}
      {leaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-obsidian-surface border border-slate-700 p-6 rounded-2xl max-w-md w-full glass-panel-heavy shadow-2xl space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-400" />
                <span>APPLY FOR DRIVER LEAVE</span>
              </h3>
              <button onClick={() => setLeaveModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitLeave} className="space-y-3.5">
              <div>
                <label className="text-slate-400 block mb-1">Leave Classification</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200"
                >
                  <option value="CASUAL_LEAVE">CASUAL LEAVE (Festival / Personal Work)</option>
                  <option value="SICK_LEAVE">SICK LEAVE (Medical Treatment)</option>
                  <option value="EMERGENCY_FAMILY">EMERGENCY FAMILY (Urgent Hometown Visit)</option>
                  <option value="ANNUAL_PRIVILEGE">ANNUAL PRIVILEGE (Earned Leave)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">From Date</label>
                  <input
                    type="date"
                    required
                    value={leaveFrom}
                    onChange={(e) => setLeaveFrom(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">To Date</label>
                  <input
                    type="date"
                    required
                    value={leaveTo}
                    onChange={(e) => setLeaveTo(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Relief Driver (Substitute Pilot)</label>
                <input
                  type="text"
                  placeholder="e.g. Sukhwinder Gill"
                  value={leaveReliefDriver}
                  onChange={(e) => setLeaveReliefDriver(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Reason For Leave Application</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Please state detailed reason for leave request..."
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setLeaveModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold"
                >
                  Submit For Approval
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          HIGHWAY BREAKDOWN / WRECKDOWN SOS MODAL
         ===================================================================== */}
      {sosModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="bg-obsidian-surface border border-rose-500/60 p-6 rounded-2xl max-w-md w-full glass-panel-heavy shadow-2xl space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-rose-400 flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 animate-pulse" />
                <span>HIGHWAY BREAKDOWN / WRECKDOWN SOS</span>
              </h3>
              <button onClick={() => setSosModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSOS} className="space-y-3.5">
              <div>
                <label className="text-slate-400 block mb-1">Breakdown Hazard Classification</label>
                <select
                  value={breakdownType}
                  onChange={(e) => setBreakdownType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-rose-300 font-bold"
                >
                  <option value="BRAKE_AIR_LEAK">BRAKE AIR PRESSURE LEAK (Severe Pressure Drop)</option>
                  <option value="TYRE_BLOWOUT">TYRE BLOWOUT / WHEEL HUB BURST</option>
                  <option value="ENGINE_BREAKDOWN">ENGINE OVERHEATING / CLUTCH FAILURE</option>
                  <option value="ACCIDENT_COLLISION">HIGHWAY ACCIDENT / VEHICLE COLLISION</option>
                  <option value="POLICE_INTERCEPTION">POLICE / STATE CHECKPOST DETENTION</option>
                  <option value="ELECTRICAL_FAILURE">ELECTRICAL ALTERNATOR / BATTERY SYSTEM HALT</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Highway Location & Nearest Marker</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. NH-48 KM Marker 218 near Bharuch Bypass"
                  value={sosLocation}
                  onChange={(e) => setSosLocation(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Urgency Level</label>
                <select
                  value={sosUrgency}
                  onChange={(e) => setSosUrgency(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                >
                  <option value="CRITICAL_HALT">CRITICAL HALT (Immobilized in traffic lane)</option>
                  <option value="MODERATE_SAFE_SHOULDER">MODERATE (Parked safely on highway shoulder)</option>
                  <option value="HIGHWAY_HAZARD">HIGHWAY HAZARD (Cargo tilt / fuel leak)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Problem Description</label>
                <textarea
                  required
                  rows={3}
                  value={sosDescription}
                  onChange={(e) => setSosDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSosModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-glow-rose"
                >
                  BROADCAST EMERGENCY SOS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          RECEIPT / VOUCHER PREVIEW MODAL
         ===================================================================== */}
      {previewReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="bg-obsidian-surface border border-slate-700 p-6 rounded-2xl max-w-lg w-full glass-panel-heavy shadow-2xl space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-cyan-400" />
                <span>{previewReceipt.title}</span>
              </h3>
              <button onClick={() => setPreviewReceipt(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5">
              {Object.entries(previewReceipt.details || {}).map(([k, v]: any) => (
                <div key={k} className="flex justify-between py-1 border-b border-slate-900">
                  <span className="text-slate-400 uppercase text-[10px]">{k}</span>
                  <span className="font-bold text-slate-200">{String(v)}</span>
                </div>
              ))}
              {previewReceipt.amount !== undefined && (
                <div className="pt-2 flex justify-between font-bold text-sm text-emerald-400">
                  <span>AMOUNT</span>
                  <span>₹{previewReceipt.amount.toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPreviewReceipt(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 font-bold"
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
