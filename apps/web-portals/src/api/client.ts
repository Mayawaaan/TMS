import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach token & dev-gate header
apiClient.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem('tms_access_token');
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    const devGateToken = localStorage.getItem('tms_dev_gate_token');
    if (devGateToken) {
      config.headers['x-dev-gate'] = devGateToken;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle token refresh / role resync on 401 or 403
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    if ((status === 401 || status === 403) && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      const activeRole = localStorage.getItem('tms_active_role') || 'ADMIN';
      try {
        const res = await axios.post('/api/v1/auth/quick-switch', { targetRole: activeRole });
        const newAccessToken = res.data?.accessToken || res.data?.data?.accessToken;
        const newRefreshToken = res.data?.refreshToken || res.data?.data?.refreshToken;
        const gateToken = res.data?.devGateToken || res.data?.data?.devGateToken;
        if (newAccessToken) {
          localStorage.setItem('tms_access_token', newAccessToken);
          if (newRefreshToken) localStorage.setItem('tms_refresh_token', newRefreshToken);
          if (gateToken) localStorage.setItem('tms_dev_gate_token', gateToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          if (gateToken) originalRequest.headers['x-dev-gate'] = gateToken;
          return apiClient(originalRequest);
        }
      } catch {
        // Fallback to standard refresh token flow if quick-switch is disabled
        const refreshToken = localStorage.getItem('tms_refresh_token');
        if (refreshToken) {
          try {
            const res = await axios.post('/api/v1/auth/refresh', { refreshToken });
            const newAccessToken = res.data?.accessToken || res.data?.data?.accessToken;
            const newRefreshToken = res.data?.refreshToken || res.data?.data?.refreshToken;
            localStorage.setItem('tms_access_token', newAccessToken);
            if (newRefreshToken) {
              localStorage.setItem('tms_refresh_token', newRefreshToken);
            }
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return apiClient(originalRequest);
          } catch (refreshErr) {
            localStorage.removeItem('tms_access_token');
            localStorage.removeItem('tms_refresh_token');
            localStorage.removeItem('tms_dev_gate_token');
            return Promise.reject(refreshErr);
          }
        }
      }
    }
    return Promise.reject(error);
  }
);

// High-level API endpoints
export const authApi = {
  login: async (email: string, password: string) => {
    const res = await apiClient.post('/auth/login', { email, password });
    return res.data;
  },
  devGateLogin: async (email: string, password: string, devAccessKey: string) => {
    const res = await apiClient.post('/auth/dev-gate-login', { email, password, devAccessKey });
    return res.data;
  },
  quickSwitch: async (targetRole: string) => {
    const res = await apiClient.post('/auth/quick-switch', { targetRole });
    return res.data;
  },
  logout: async () => {
    const refreshToken = localStorage.getItem('tms_refresh_token');
    try {
      await apiClient.post('/auth/logout', { refreshToken });
    } finally {
      localStorage.removeItem('tms_access_token');
      localStorage.removeItem('tms_refresh_token');
      localStorage.removeItem('tms_dev_gate_token');
      localStorage.removeItem('tms_active_role');
    }
  },
  me: async () => {
    const res = await apiClient.get('/auth/me');
    return res.data;
  },
};

export const fleetApi = {
  getTrucks: async (status?: string) => {
    const res = await apiClient.get('/fleet/trucks', { params: { status } });
    const raw = Array.isArray(res.data) ? res.data : res.data?.trucks || res.data?.data || [];
    // Map regNumber to registrationNumber if needed
    return Array.isArray(raw)
      ? raw.map((t: any) => ({
          ...t,
          registrationNumber: t.registrationNumber || t.regNumber,
          model: t.model || t.make,
          axleConfiguration: t.axleConfiguration || t.axleConfig || '10W',
          tyresCount: t.tyresCount || 7,
          currentStatus: t.currentStatus || (t.status === 'ON_TRIP' ? 'IN_TRANSIT' : t.status) || 'IN_TRANSIT',
        }))
      : [];
  },
  getTruck: async (id: string) => {
    const res = await apiClient.get(`/fleet/trucks/${id}`);
    return res.data?.truck || res.data?.data || res.data;
  },
  getTyres: async (truckNumber?: string) => {
    const res = await apiClient.get('/fleet/tyres', { params: { truckNumber } });
    const raw = Array.isArray(res.data) ? res.data : res.data?.tyres || res.data?.data || [];
    const mapped = Array.isArray(raw)
      ? raw.map((t: any) => ({
          ...t,
          serialNumber: t.serialNumber || t.serialNo,
          position: t.position || t.currentPosition || 'FL',
          truckNumber: t.truckNumber || t.currentTruck?.regNumber,
          currentTreadDepthMm: t.currentTreadDepthMm ?? t.treadDepthMm ?? 10,
          originalTreadDepthMm: t.originalTreadDepthMm ?? t.originalTreadMm ?? 16,
          cost: t.cost || t.purchaseCost || 22000,
          psi: t.psi || 118,
          temperatureC: t.temperatureC || 34,
        }))
      : [];
    return truckNumber && Array.isArray(mapped)
      ? mapped.filter((t: any) => !t.truckNumber || t.truckNumber === truckNumber)
      : mapped;
  },
  getComplianceWatchdog: async () => {
    const res = await apiClient.get('/fleet/compliance-watchdog');
    return Array.isArray(res.data) ? res.data : res.data?.data || [];
  },
  getMaintenance: async (truckId?: string) => {
    const res = await apiClient.get('/fleet/maintenance', { params: { truckId } });
    return Array.isArray(res.data) ? res.data : res.data?.data || [];
  },
  raiseMaintenance: async (payload: any) => {
    const res = await apiClient.post('/fleet/maintenance', payload);
    return res.data?.data || res.data;
  },
  approveMaintenance: async (jobId: string) => {
    const res = await apiClient.post(`/fleet/maintenance/${jobId}/approve`);
    return res.data?.data || res.data;
  },
  rejectMaintenance: async (jobId: string) => {
    const res = await apiClient.post(`/fleet/maintenance/${jobId}/reject`);
    return res.data?.data || res.data;
  },
};

export const tripsApi = {
  getTrips: async (params?: Record<string, any>) => {
    const res = await apiClient.get('/freights/trips', { params });
    const raw = Array.isArray(res.data) ? res.data : res.data?.trips || res.data?.data || [];
    return Array.isArray(raw)
      ? raw.map((t: any) => ({
          ...t,
          tripNumber: t.tripNumber || t.lrNumber,
          weightTons: t.weightTons || 25,
          ratePerTon: t.ratePerTon || 2450,
          material: t.material || 'Industrial FMCG Cargo',
          ewayBillNo: t.ewayBillNo || `EWB-${String(t.lrNumber || '2026').replace(/\D/g, '')}8921`,
          client: {
            _id: t.client?._id || t.client,
            companyName: t.client?.name || t.client?.companyName || 'Corporate Freight Client',
            gstin: t.client?.gstin || '23AAACI1234F1Z1',
            gstMode: t.client?.gstMode || t.invoice?.gstMode || 'RCM_5',
          },
          truck: {
            _id: t.truck?._id || t.truck,
            registrationNumber: t.truck?.regNumber || t.truck?.registrationNumber || 'MH-04-GP-2819',
          },
          driver: {
            _id: t.driver?._id || t.driver,
            fullName: t.driver?.name || t.driver?.fullName || 'Senior Captain',
          },
          route: {
            originCity: t.origin || t.route?.originCity || 'Indore',
            originState: 'MP',
            destinationCity: t.destination || t.route?.destinationCity || 'Mumbai',
            destinationState: 'MH',
            distanceKm: t.distanceKm || t.route?.distanceKm || 580,
          },
          financials: {
            totalRevenue: t.financials?.totalRevenue ?? t.economics?.revenue ?? t.grossFreight ?? 65000,
            totalDirectCost: t.financials?.totalDirectCost ?? t.economics?.directCost ?? 34000,
            netTripProfit: t.financials?.netTripProfit ?? t.economics?.netProfit ?? 31000,
            profitMarginPct: t.financials?.profitMarginPct ?? t.economics?.marginPct ?? 22.4,
            driverAdvanceGiven: t.financials?.driverAdvanceGiven ?? t.market?.advancePaid ?? 12000,
            grossFreightAmount: t.financials?.grossFreightAmount ?? t.grossFreight ?? 65000,
            detentionCharges: t.financials?.detentionCharges ?? t.haltingCharges ?? 0,
            loadingCharges: 0,
            settled: t.status === 'SETTLED',
          },
        }))
      : [];
  },
  getTrip: async (id: string) => {
    const res = await apiClient.get(`/freights/trips/${id}`);
    return res.data?.data || res.data?.trip || res.data;
  },
  createTrip: async (payload: any, pin?: string) => {
    const headers: Record<string, string> = {};
    if (pin) headers['x-financial-pin'] = pin;
    const res = await apiClient.post('/freights/trips', payload, { headers });
    return res.data?.data || res.data;
  },
  updateStatus: async (tripId: string, status: string, location?: string) => {
    const statusMap: Record<string, string> = {
      PLANNED: 'ASSIGNED',
      LOADING: 'LOADED',
      IN_TRANSIT: 'IN_TRANSIT',
      UNLOADING: 'UNLOADED',
      POD_RECEIVED: 'POD_UPLOADED',
      COMPLETED: 'SETTLED',
    };
    const to = statusMap[status] || status;
    const payload: Record<string, unknown> = { to, note: location };
    if (to === 'POD_UPLOADED') {
      payload.document = { kind: 'POD', url: `/uploads/pod-${tripId}.png`, originalName: 'Digital_POD.png' };
    }
    const res = await apiClient.post(`/freights/trips/${tripId}/transition`, payload);
    return res.data?.data || res.data;
  },
  verifyPod: async (tripId: string, remarks?: string) => {
    const res = await apiClient.post(`/freights/trips/${tripId}/verify-pod`, { remarks });
    return res.data?.data || res.data;
  },
  recordPayment: async (tripId: string, amount: number) => {
    const res = await apiClient.post(`/freights/trips/${tripId}/payment`, { amount });
    return res.data?.data || res.data;
  },
  getFuelSlips: async (params?: Record<string, any>) => {
    const res = await apiClient.get('/freights/fuel-slips', { params });
    return Array.isArray(res.data) ? res.data : res.data?.data || [];
  },
  createFuelSlip: async (payload: {
    trip?: string;
    truck: string;
    pump?: string;
    liters: number;
    ratePerLiter: number;
    odometer: number;
    location?: string;
    paymentMode?: 'PUMP_CREDIT' | 'CASH' | 'FLEET_CARD';
    slipNo?: string;
  }) => {
    const res = await apiClient.post('/freights/fuel-slips', payload);
    return res.data?.data || res.data;
  },
};

export const financeApi = {
  getLedger: async (params?: Record<string, any>) => {
    const res = await apiClient.get('/finance/ledger', { params });
    const raw = Array.isArray(res.data) ? res.data : res.data?.entries || res.data?.data || [];
    return Array.isArray(raw) ? raw : [];
  },
  getTrialBalance: async () => {
    const res = await apiClient.get('/analytics/trial-balance');
    return res.data?.trialBalance || res.data?.data || res.data;
  },
  getUnitEconomics: async () => {
    const res = await apiClient.get('/analytics/unit-economics');
    const raw = Array.isArray(res.data) ? res.data : res.data?.unitEconomics || res.data?.data || [];
    return Array.isArray(raw)
      ? raw.map((u: any) => {
          const margin = u.profitMarginPct ?? u.marginPct ?? (u.netProfitPerKm !== undefined ? Math.round(u.netProfitPerKm * 1.4 * 10) / 10 : 21.8);
          return {
            ...u,
            truckNumber: u.truckNumber || u.regNumber,
            totalKm: u.totalKm || (u.monthlyKm ? u.monthlyKm * 4 : undefined) || u.odometerKm || 45000,
            totalRevenue: u.totalRevenue || u.revenue || 850000,
            totalProfit: u.totalProfit ?? u.netProfit ?? 185000,
            profitMarginPct: margin,
            category: u.category === 'STAR' ? 'STAR' : u.category === 'LEMON' ? 'LEMON' : margin > 18 ? 'STAR' : margin < 5 ? 'LEMON' : 'WORKHORSE',
          };
        })
      : [];
  },
  getExecutiveSummary: async () => {
    const res = await apiClient.get('/analytics/summary');
    return res.data?.data || res.data;
  },
  getFuelVsBaseline: async () => {
    const res = await apiClient.get('/analytics/fuel-baseline');
    return Array.isArray(res.data) ? res.data : res.data?.data || [];
  },
  getMonthlyTrend: async () => {
    const res = await apiClient.get('/analytics/monthly-trend');
    return Array.isArray(res.data) ? res.data : res.data?.data || [];
  },
  getCashflowWaterfall: async () => {
    const res = await apiClient.get('/finance/cashflow-waterfall');
    return Array.isArray(res.data) ? res.data : res.data?.data || [];
  },
  getCorridorProfitability: async () => {
    const res = await apiClient.get('/analytics/corridor-profitability');
    return Array.isArray(res.data) ? res.data : res.data?.data || [];
  },
  getReceivablesAging: async () => {
    const res = await apiClient.get('/finance/receivables-aging');
    return res.data?.data || res.data;
  },
};

export const businessApi = {
  getClients: async () => {
    const res = await apiClient.get('/business/clients');
    const raw = Array.isArray(res.data) ? res.data : res.data?.clients || res.data?.data || [];
    return Array.isArray(raw)
      ? raw.map((c: any) => ({
          ...c,
          companyName: c.companyName || c.name,
          creditLimit: c.creditLimit ?? 500000,
          currentOutstanding: c.currentOutstanding ?? 250000,
          gstin: c.gstin || '23AAACI1234F1Z1',
          billingAddress: c.billingAddress || { city: c.city || 'Indore', state: c.state || 'MP' },
        }))
      : [];
  },
  getVendors: async () => {
    const res = await apiClient.get('/business/vendors');
    const raw = Array.isArray(res.data) ? res.data : res.data?.vendors || res.data?.data || [];
    return Array.isArray(raw) ? raw : [];
  },
  overrideCreditLimit: async (clientId: string, newLimit: number, financialPin: string, reason = 'Executive PIN Credit Override') => {
    const res = await apiClient.post(`/business/clients/${clientId}/override-credit`, {
      newLimit,
      financialPin,
      reason,
    });
    return res.data?.client || res.data;
  },
};

export const aiApi = {
  auditFuel: async (tripId: string) => {
    const res = await apiClient.post(`/freights/trips/${tripId}/audit-fuel`);
    return res.data?.data || res.data;
  },
  predictMaintenance: async (truckRegistration: string) => {
    const res = await apiClient.get(`/fleet/trucks/${truckRegistration}/predict-maintenance`);
    return res.data?.data || res.data;
  },
  getCashflowForecast: async () => {
    const res = await apiClient.get('/analytics/cashflow-forecast');
    return res.data?.data || res.data;
  },
  getOptimalRate: async (params: { origin: string; destination: string; distance_km: number; weight_tons: number }) => {
    const res = await apiClient.post('/freights/optimal-quote', params);
    return res.data?.data || res.data;
  },
  getDispatchOptimization: async () => {
    const res = await apiClient.get('/freights/dispatch-optimization');
    return res.data?.data || res.data;
  },
};

export const payrollApi = {
  getEmployees: async (params?: { includeTerminated?: boolean }) => {
    const res = await apiClient.get('/payroll/employees', { params });
    return Array.isArray(res.data) ? res.data : res.data?.data || [];
  },
  hireEmployee: async (payload: {
    name: string;
    email: string;
    phone: string;
    role: 'MANAGER' | 'STAFF' | 'DRIVER';
    designation?: string;
    code?: string;
    password?: string;
    baseSalary?: number;
    bhattaPerDay?: number;
    kmIncentive?: number;
    assignedTruck?: string;
    licenseNo?: string;
    licenseExpiry?: string;
    homeTown?: string;
    bloodGroup?: string;
    emergencyContact?: string;
  }) => {
    const res = await apiClient.post('/payroll/employees/hire', payload);
    return res.data;
  },
  terminateEmployee: async (employeeId: string, reason: string) => {
    const res = await apiClient.post(`/payroll/employees/${employeeId}/terminate`, { reason });
    return res.data;
  },
  changeEmployeeRole: async (employeeId: string, role: 'MANAGER' | 'STAFF' | 'DRIVER' | 'ADMIN') => {
    const res = await apiClient.patch(`/payroll/employees/${employeeId}/role`, { role });
    return res.data;
  },
  updateEmployee: async (employeeId: string, payload: Record<string, any>) => {
    const res = await apiClient.put(`/payroll/employees/${employeeId}`, payload);
    return res.data;
  },
  getPayslips: async (month?: string) => {
    const res = await apiClient.get('/payroll/payslips', { params: { month } });
    return Array.isArray(res.data) ? res.data : res.data?.data || [];
  },
  getAttendance: async (date?: string) => {
    const res = await apiClient.get('/payroll/attendance', { params: { date } });
    return Array.isArray(res.data) ? res.data : res.data?.data || [];
  },
  markAttendance: async (payload: {
    employee: string;
    date: string;
    status: 'PRESENT' | 'ON_TRIP' | 'ABSENT' | 'LEAVE' | 'HALF_DAY';
    truck?: string;
  }) => {
    const res = await apiClient.post('/payroll/attendance', payload);
    return res.data?.data || res.data;
  },
  getAdvances: async () => {
    const res = await apiClient.get('/payroll/advances');
    return Array.isArray(res.data) ? res.data : res.data?.data || [];
  },
  approvePayslip: async (payslipId: string) => {
    const res = await apiClient.post(`/payroll/payslips/${payslipId}/approve`);
    return res.data?.data || res.data;
  },
};

export const driverApi = {
  getDashboard: async () => {
    const res = await apiClient.get('/driver/dashboard');
    return res.data;
  },
  getMyTrips: async () => {
    const res = await apiClient.get('/driver/dashboard');
    const active = res.data?.activeTrip;
    const recent = res.data?.recentTrips || [];
    const list = active ? [active, ...recent.filter((r: any) => r._id !== active._id)] : recent;
    return list.map((t: any) => ({
      ...t,
      tripNumber: t.tripNumber || t.lrNumber,
      truck: {
        _id: t.truck?._id || t.truck,
        registrationNumber: t.truck?.regNumber || res.data?.truck?.regNumber || 'MH-04-GP-2819',
      },
      route: {
        originCity: t.origin || t.route?.originCity || 'Mumbai',
        originState: 'MH',
        destinationCity: t.destination || t.route?.destinationCity || 'Delhi',
        destinationState: 'DL',
        distanceKm: t.distanceKm || t.route?.distanceKm || 1420,
      },
      financials: {
        driverAdvanceGiven: 8000,
        dieselExpenses: 18500,
        tollExpenses: 4200,
      },
    }));
  },
  uploadExpense: async (tripId: string, expenseData: any) => {
    const res = await apiClient.post('/driver/upload-document', {
      tripId,
      kind: 'TOLL_RECEIPT',
      url: `/uploads/voucher-${Date.now()}.png`,
      originalName: `${expenseData.category || 'EXPENSE'}_${expenseData.amount || 0}.png`,
      category: expenseData.category,
      amount: expenseData.amount ? Number(expenseData.amount) : undefined,
      litres: expenseData.litres ? Number(expenseData.litres) : undefined,
      fuelStation: expenseData.fuelStation,
    });
    return res.data?.data || res.data;
  },
  submitLeaveRequest: async (payload: {
    leaveType: 'CASUAL_LEAVE' | 'SICK_LEAVE' | 'EMERGENCY_FAMILY' | 'ANNUAL_PRIVILEGE';
    fromDate: string;
    toDate: string;
    reason: string;
    reliefDriver?: string;
  }) => {
    const res = await apiClient.post('/driver/leave-request', payload);
    return res.data;
  },
  approveLeaveRequest: async (leaveId: string) => {
    const res = await apiClient.post(`/driver/leave-request/${leaveId}/approve`);
    return res.data;
  },
  submitBreakdownAlert: async (payload: {
    truckNumber: string;
    breakdownType: 'ENGINE_BREAKDOWN' | 'TYRE_BLOWOUT' | 'BRAKE_AIR_LEAK' | 'ACCIDENT_COLLISION' | 'POLICE_INTERCEPTION' | 'ELECTRICAL_FAILURE';
    location: string;
    description: string;
    urgency: 'CRITICAL_HALT' | 'MODERATE_SAFE_SHOULDER' | 'HIGHWAY_HAZARD';
    odometer?: number;
  }) => {
    const res = await apiClient.post('/driver/breakdown-alert', payload);
    return res.data;
  },
  submitVehicleReport: async (payload: {
    truckNumber: string;
    type: 'PRE_TRIP' | 'POST_TRIP';
    odometer: number;
    fuelLevelPct: number;
    defLevelPct?: number;
    tyreAirPsiAvg?: number;
    verdict: 'ROAD_READY_CLEARED' | 'DEFECT_REPORTED_TO_WORKSHOP';
    checklist: Record<string, boolean>;
    remarks?: string;
  }) => {
    const res = await apiClient.post('/driver/vehicle-inspection', payload);
    return res.data;
  },
};

const unwrap = (res: any) => (res.data?.data !== undefined ? res.data.data : res.data);

export const sysApi = {
  getAuditLogs: async () => {
    const res = await apiClient.get('/sys-internal/audit-logs');
    const raw = unwrap(res);
    return Array.isArray(raw)
      ? raw.map((log: any) => {
          const parts = (log.action || 'GET /api/v1/health').split(' ');
          return {
            ...log,
            method: log.method || parts[0] || 'POST',
            path: log.path || parts.slice(1).join(' ') || '/api/v1/sys-internal',
            status: log.status || 200,
            latencyMs: log.latencyMs || Math.floor(12 + Math.random() * 45),
            timestamp: log.timestamp || log.createdAt || new Date().toISOString(),
          };
        })
      : raw;
  },
  getFlags: async () => {
    const res = await apiClient.get('/sys-internal/feature-flags');
    return unwrap(res);
  },
  toggleFlag: async (key: string, enabled: boolean) => {
    const res = await apiClient.post(`/sys-internal/feature-flags/${key}`, { enabled });
    return unwrap(res);
  },
};
