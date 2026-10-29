export type UserRole = 'ADMIN' | 'MANAGER' | 'STAFF' | 'DRIVER' | 'DEV';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  assignedTruckId?: string;
  assignedTruckNumber?: string;
  isHiddenDev?: boolean;
}

export interface Tyre {
  _id: string;
  serialNumber: string;
  brand: string;
  model: string;
  size: string;
  position: 'FL' | 'FR' | 'RLO' | 'RLI' | 'RRO' | 'RRI' | 'STEPNEY' | 'UNMOUNTED';
  truckNumber?: string;
  originalTreadDepthMm: number;
  currentTreadDepthMm: number;
  status: 'ACTIVE' | 'RETREADED' | 'SCRAPPED';
  totalKmRun: number;
  cost: number;
  psi: number;
  temperatureC: number;
}

export interface Truck {
  _id: string;
  registrationNumber: string;
  make: string;
  model: string;
  year: number;
  axleConfiguration: '4x2' | '6x2' | '6x4';
  capacityTons: number;
  currentStatus: 'IDLE' | 'ASSIGNED' | 'IN_TRANSIT' | 'MAINTENANCE' | 'DECOMMISSIONED';
  currentOdometerKm: number;
  tyresCount: number;
  assignedDriver?: {
    _id: string;
    fullName: string;
    phone: string;
  };
  telematics?: {
    latitude: number;
    longitude: number;
    speedKmph: number;
    fuelLevelPct: number;
    engineTempC: number;
    ignition: boolean;
    lastPing: string;
  };
}

export interface TripExpense {
  category: 'FUEL' | 'TOLL' | 'DRIVER_ADVANCE' | 'REPAIR' | 'CHALLAN' | 'OTHER';
  amount: number;
  paymentMode: 'CASH' | 'FASTAG' | 'PETRO_CARD' | 'BANK_TRANSFER';
  litres?: number;
  ratePerLitre?: number;
  fuelStation?: string;
  tollPlazaName?: string;
  remarks?: string;
  date: string;
}

export interface Trip {
  _id: string;
  tripNumber: string;
  client: {
    _id: string;
    companyName: string;
    tradeName?: string;
    gstin?: string;
  };
  truck: {
    _id: string;
    registrationNumber: string;
    make?: string;
    capacityTons?: number;
  };
  driver: {
    _id: string;
    fullName: string;
    phone: string;
  };
  route: {
    originCity: string;
    originState: string;
    destinationCity: string;
    destinationState: string;
    distanceKm: number;
    expectedTransitHours: number;
  };
  status: 'INDENT' | 'ASSIGNED' | 'LOADED' | 'UNLOADED' | 'POD_UPLOADED' | 'SETTLED' | 'PLANNED' | 'LOADING' | 'IN_TRANSIT' | 'UNLOADING' | 'POD_RECEIVED' | 'INVOICED' | 'COMPLETED' | 'CANCELLED';
  odometer: {
    startKm?: number;
    endKm?: number;
    totalKm?: number;
  };
  financials: {
    agreedFreightRate: number;
    rateType: 'FIXED_PER_TRIP' | 'PER_TON' | 'PER_KM';
    grossFreightAmount: number;
    detentionCharges: number;
    loadingCharges: number;
    unloadingCharges: number;
    totalRevenue: number;
    driverAdvanceGiven: number;
    dieselExpenses: number;
    tollExpenses: number;
    otherExpenses: number;
    totalDirectCost: number;
    netTripProfit: number;
    profitMarginPct: number;
    settled: boolean;
  };
  expenses: TripExpense[];
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  _id: string;
  companyName: string;
  tradeName?: string;
  gstin: string;
  creditLimit: number;
  creditPeriodDays: number;
  currentOutstanding: number;
  billingAddress: {
    city: string;
    state: string;
    pincode: string;
  };
  isBlacklisted: boolean;
}

export interface Vendor {
  _id: string;
  name: string;
  vendorType: 'FUEL' | 'TOLL_FASTAG' | 'TYRE' | 'SPARE_PARTS' | 'INSURANCE';
  currentPayableBalance: number;
  phone: string;
}

export interface LedgerEntry {
  _id: string;
  journalEntryId: string;
  date: string;
  account: string;
  debit: number;
  credit: number;
  narration: string;
  referenceType?: string;
  referenceId?: string;
  postedBy?: string;
}

export interface TrialBalanceItem {
  account: string;
  debit: number;
  credit: number;
}

export interface FuelAnomaly {
  is_theft_anomaly: boolean;
  theft_probability_pct: number;
  expected_kmpl: number;
  actual_kmpl: number;
  fuel_lost_litres: number;
  estimated_theft_loss_inr: number;
  model_score: number;
  corridor_name: string;
  recommendation: string;
}

export interface ComponentSurvival {
  component: string;
  age_days: number;
  km_run: number;
  failure_probability_pct: number;
  expected_remaining_life_km: number;
  risk_level: 'HEALTHY' | 'MODERATE' | 'CRITICAL';
  action: string;
}

export interface MaintenancePrediction {
  truck_registration: string;
  components: ComponentSurvival[];
  fleet_action_summary: string;
}

export interface CashflowPoint {
  day: number;
  p10_inr: number;
  p50_inr: number;
  p90_inr: number;
  status: 'SURPLUS' | 'DEFICIT_RISK' | 'CRITICAL_DEFICIT';
}

export interface CashflowForecast {
  days_simulated: number;
  paths_run: number;
  current_bank_balance_inr: number;
  horizon_p50_balance_inr: number;
  min_p10_inr: number;
  deficit_probability_pct: number;
  forecast: CashflowPoint[];
}
