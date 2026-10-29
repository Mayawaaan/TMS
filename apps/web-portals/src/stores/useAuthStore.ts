import { create } from 'zustand';
import { AuthUser, UserRole } from '../types';
import { authApi } from '../api/client';

export interface PortalHandoffNotice {
  fromRole: UserRole;
  toRole: UserRole;
  message: string;
  tripId?: string;
  truckNumber?: string;
  clientId?: string;
  timestamp: string;
}

interface AuthState {
  user: AuthUser | null;
  role: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  devGateToken: string | null;
  selectedTripId: string | null;
  isInspectorOpen: boolean;
  isCommandPaletteOpen: boolean;
  selectedTruckId: string | null;
  isTyreBlueprintOpen: boolean;

  // Cross-Portal Interactive Workflow Context
  focusedTripId: string | null;
  focusedTruckNumber: string | null;
  focusedClientId: string | null;
  portalNotice: PortalHandoffNotice | null;

  // Actions
  setUser: (user: AuthUser | null) => void;
  setRole: (role: UserRole) => void;
  quickSwitchRole: (targetRole: UserRole) => Promise<void>;
  navigateToPortal: (
    targetRole: UserRole,
    context?: {
      tripId?: string;
      truckNumber?: string;
      clientId?: string;
      openDrawer?: boolean;
      message?: string;
    }
  ) => Promise<void>;
  clearPortalNotice: () => void;
  setFocusedTripId: (tripId: string | null) => void;
  logout: () => Promise<void>;
  openInspector: (tripId: string) => void;
  closeInspector: () => void;
  openTyreBlueprint: (truckId: string) => void;
  closeTyreBlueprint: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  initialize: () => Promise<void>;
}

export const ROLE_CREDENTIALS: Record<UserRole, { email: string; pass: string; devKey?: string }> = {
  DEV: {
    email: import.meta.env.VITE_DEV_EMAIL || 'architect@sys.internal',
    pass: import.meta.env.VITE_DEV_PASSWORD || 'ObsidianDev2026',
    devKey: import.meta.env.VITE_DEV_GATE_KEY || 'DEV-OVERRIDE-SECRET-KEY-9999',
  },
  ADMIN: {
    email: import.meta.env.VITE_ADMIN_EMAIL || 'admin@obsidianfleet.com',
    pass: import.meta.env.VITE_DEFAULT_PASSWORD || 'Fleet@2026',
  },
  MANAGER: {
    email: import.meta.env.VITE_MANAGER_EMAIL || 'manager@obsidianfleet.com',
    pass: import.meta.env.VITE_DEFAULT_PASSWORD || 'Fleet@2026',
  },
  STAFF: {
    email: import.meta.env.VITE_STAFF_EMAIL || 'dispatch@obsidianfleet.com',
    pass: import.meta.env.VITE_DEFAULT_PASSWORD || 'Fleet@2026',
  },
  DRIVER: {
    email: import.meta.env.VITE_DRIVER_EMAIL || 'driver.ramesh@obsidianfleet.com',
    pass: import.meta.env.VITE_DEFAULT_PASSWORD || 'Fleet@2026',
  },
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  role: (localStorage.getItem('tms_active_role') as UserRole) || 'ADMIN',
  isAuthenticated: !!localStorage.getItem('tms_access_token'),
  isLoading: true,
  devGateToken: localStorage.getItem('tms_dev_gate_token'),
  selectedTripId: null,
  isInspectorOpen: false,
  isCommandPaletteOpen: false,
  selectedTruckId: null,
  isTyreBlueprintOpen: false,
  focusedTripId: localStorage.getItem('tms_focused_trip_id'),
  focusedTruckNumber: null,
  focusedClientId: null,
  portalNotice: null,

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setRole: (role) => {
    localStorage.setItem('tms_active_role', role);
    set({ role });
  },

  setFocusedTripId: (tripId) => {
    if (tripId) localStorage.setItem('tms_focused_trip_id', tripId);
    else localStorage.removeItem('tms_focused_trip_id');
    set({ focusedTripId: tripId });
  },

  clearPortalNotice: () => set({ portalNotice: null }),

  navigateToPortal: async (targetRole, context) => {
    const currentRole = get().role;
    if (context?.tripId) {
      localStorage.setItem('tms_focused_trip_id', context.tripId);
    }
    set({
      focusedTripId: context?.tripId ?? get().focusedTripId,
      focusedTruckNumber: context?.truckNumber ?? null,
      focusedClientId: context?.clientId ?? null,
      portalNotice: context?.message
        ? {
            fromRole: currentRole,
            toRole: targetRole,
            message: context.message,
            tripId: context.tripId,
            truckNumber: context.truckNumber,
            clientId: context.clientId,
            timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
          }
        : null,
    });
    await get().quickSwitchRole(targetRole);
    if (context?.openDrawer && context?.tripId) {
      set({ selectedTripId: context.tripId, isInspectorOpen: true });
    }
  },

  openInspector: (tripId: string) => set({ selectedTripId: tripId, isInspectorOpen: true }),
  closeInspector: () => set({ isInspectorOpen: false }),

  openTyreBlueprint: (truckId: string) => set({ selectedTruckId: truckId, isTyreBlueprintOpen: true }),
  closeTyreBlueprint: () => set({ isTyreBlueprintOpen: false }),

  setCommandPaletteOpen: (open: boolean) => set({ isCommandPaletteOpen: open }),

  quickSwitchRole: async (targetRole: UserRole) => {
    set({ isLoading: true });
    try {
      const cred = ROLE_CREDENTIALS[targetRole];
      let res;
      try {
        res = await authApi.quickSwitch(targetRole);
      } catch {
        if (targetRole === 'DEV' && cred.devKey) {
          res = await authApi.devGateLogin(cred.email, cred.pass, cred.devKey);
        } else {
          res = await authApi.login(cred.email, cred.pass);
        }
      }

      const gateTok = res?.devGateToken || res?.data?.devGateToken;
      if (targetRole === 'DEV' && gateTok) {
        localStorage.setItem('tms_dev_gate_token', gateTok);
        set({ devGateToken: gateTok });
      } else if (targetRole !== 'DEV') {
        localStorage.removeItem('tms_dev_gate_token');
        set({ devGateToken: null });
      }

      const accessTok = res?.accessToken || res?.data?.accessToken;
      const refreshTok = res?.refreshToken || res?.data?.refreshToken;
      const userObj = res?.user || res?.data?.user;

      if (accessTok) {
        localStorage.setItem('tms_access_token', accessTok);
        if (refreshTok) localStorage.setItem('tms_refresh_token', refreshTok);
        localStorage.setItem('tms_active_role', targetRole);

        set({
          user: userObj,
          role: targetRole,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (err) {
      console.error('Quick switch failed', err);
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    }
    set({
      user: null,
      role: 'ADMIN',
      isAuthenticated: false,
      devGateToken: null,
    });
  },

  initialize: async () => {
    const savedRole = (localStorage.getItem('tms_active_role') as UserRole) || 'ADMIN';
    const token = localStorage.getItem('tms_access_token');
    if (!token) {
      await get().quickSwitchRole(savedRole);
      return;
    }
    try {
      set({ isLoading: true });
      const res = await authApi.me();
      const userObj = res?.user || res?.data?.user || res?.data;
      if (userObj && userObj.role === savedRole) {
        set({ user: userObj, isAuthenticated: true, role: userObj.role, isLoading: false });
      } else {
        await get().quickSwitchRole(savedRole);
      }
    } catch {
      await get().quickSwitchRole(savedRole);
    }
  },
}));
