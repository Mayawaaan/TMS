import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { payrollApi, fleetApi } from '../api/client';
import { Truck as TruckType } from '../types';
import {
  Users,
  UserPlus,
  UserMinus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Award,
  Briefcase,
  Truck,
  Key,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  Calendar,
  Eye,
  Edit3,
  X,
  RefreshCw,
  ChevronRight,
  Lock,
  ArrowRightLeft,
} from 'lucide-react';

interface WorkforceManagementProps {
  portalRole?: 'ADMIN' | 'MANAGER' | 'STAFF' | 'DEV';
}

export const WorkforceManagement: React.FC<WorkforceManagementProps> = ({ portalRole }) => {
  const { user: authUser } = useAuthStore();
  const currentRole = portalRole || authUser?.role || 'ADMIN';

  // Permission Matrix:
  // Admin & Dev: Can hire all (Manager, Staff, Driver), fire all, change roles
  // Manager: Can hire Staff & Driver, fire Staff & Driver (cannot touch Manager/Admin)
  // Staff: Can ONLY hire Driver, CANNOT fire anyone, cannot change roles
  const canHireManager = currentRole === 'ADMIN' || currentRole === 'DEV';
  const canHireStaff = currentRole === 'ADMIN' || currentRole === 'MANAGER' || currentRole === 'DEV';
  const canHireDriver = true; // Admin, Manager, and Staff can all hire drivers
  const canFire = currentRole !== 'STAFF'; // Staff CANNOT fire
  const canChangeRole = currentRole === 'ADMIN' || currentRole === 'DEV'; // Admin only

  const allowedHiringRoles = canHireManager
    ? (['MANAGER', 'STAFF', 'DRIVER'] as const)
    : canHireStaff
    ? (['STAFF', 'DRIVER'] as const)
    : (['DRIVER'] as const);

  // Component Data State
  const [employees, setEmployees] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<TruckType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'MANAGER' | 'STAFF' | 'DRIVER' | 'TERMINATED'>('ALL');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Hiring Onboarding Form State
  const [isHireModalOpen, setIsHireModalOpen] = useState(false);
  const [hireRole, setHireRole] = useState<'MANAGER' | 'STAFF' | 'DRIVER'>('DRIVER');
  const [hireName, setHireName] = useState('');
  const [hireEmail, setHireEmail] = useState('');
  const [hirePhone, setHirePhone] = useState('');
  const [hireDesignation, setHireDesignation] = useState('');
  const [hireCode, setHireCode] = useState('');
  const [hirePassword, setHirePassword] = useState('Fleet@2026');
  const [hireBaseSalary, setHireBaseSalary] = useState('24000');
  const [hireBhatta, setHireBhatta] = useState('750');
  const [hireKmIncentive, setHireKmIncentive] = useState('1.5');
  const [hireTruck, setHireTruck] = useState('');
  const [hireLicenseNo, setHireLicenseNo] = useState('');
  const [hireLicenseExpiry, setHireLicenseExpiry] = useState('2031-08-15');
  const [hireHomeTown, setHireHomeTown] = useState('');
  const [hireBloodGroup, setHireBloodGroup] = useState('O+');
  const [hireEmergencyContact, setHireEmergencyContact] = useState('');

  // Termination Modal State
  const [terminateTarget, setTerminateTarget] = useState<any>(null);
  const [terminationReason, setTerminationReason] = useState('Violation of Fleet Safety & Fuel Compliance Protocol');

  // Role Modification Modal State (Admin Only)
  const [roleChangeTarget, setRoleChangeTarget] = useState<any>(null);
  const [newSelectedRole, setNewSelectedRole] = useState<'MANAGER' | 'STAFF' | 'DRIVER'>('STAFF');

  // Employee Detail View Modal
  const [viewEmployeeTarget, setViewEmployeeTarget] = useState<any>(null);

  useEffect(() => {
    loadWorkforceData();
  }, []);

  const loadWorkforceData = async () => {
    setIsLoading(true);
    try {
      const [empData, truckData] = await Promise.all([
        payrollApi.getEmployees({ includeTerminated: true }).catch(() => []),
        fleetApi.getTrucks().catch(() => []),
      ]);
      setEmployees(empData || []);
      setTrucks(truckData || []);
    } catch {
      setErrorMsg('Failed to load company workforce directory');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenHireModal = (preferredRole?: 'MANAGER' | 'STAFF' | 'DRIVER') => {
    const roleToSet = preferredRole && allowedHiringRoles.includes(preferredRole as any)
      ? preferredRole
      : allowedHiringRoles[allowedHiringRoles.length - 1]; // defaults to Driver
    setHireRole(roleToSet);
    setHireName('');
    setHireEmail('');
    setHirePhone('');
    setHireDesignation(roleToSet === 'MANAGER' ? 'OPERATIONS MANAGER' : roleToSet === 'STAFF' ? 'FLEET DISPATCH DESK' : 'HEAVY COMMERCIAL PILOT');
    setHireCode('');
    setHireBaseSalary(roleToSet === 'MANAGER' ? '45000' : roleToSet === 'STAFF' ? '28000' : '18000');
    setHireBhatta(roleToSet === 'DRIVER' ? '750' : '0');
    setHireKmIncentive(roleToSet === 'DRIVER' ? '1.5' : '0');
    setHireTruck('');
    setHireLicenseNo('');
    setHireHomeTown('');
    setIsHireModalOpen(true);
  };

  const handleSubmitHire = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await payrollApi.hireEmployee({
        name: hireName,
        email: hireEmail,
        phone: hirePhone,
        role: hireRole,
        designation: hireDesignation || hireRole,
        code: hireCode || undefined,
        password: hirePassword || 'Fleet@2026',
        baseSalary: Number(hireBaseSalary) || 18000,
        bhattaPerDay: Number(hireBhatta) || 0,
        kmIncentive: Number(hireKmIncentive) || 0,
        assignedTruck: hireRole === 'DRIVER' && hireTruck ? hireTruck : undefined,
        licenseNo: hireRole === 'DRIVER' ? hireLicenseNo : undefined,
        licenseExpiry: hireRole === 'DRIVER' && hireLicenseExpiry ? hireLicenseExpiry : undefined,
        homeTown: hireHomeTown || undefined,
        bloodGroup: hireBloodGroup || undefined,
        emergencyContact: hireEmergencyContact || undefined,
      });

      setSuccessMsg(res.message || `Successfully hired ${hireRole}: ${hireName}`);
      setIsHireModalOpen(false);
      setTimeout(() => setSuccessMsg(''), 5000);
      loadWorkforceData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to hire employee');
    }
  };

  const handleConfirmTerminate = async () => {
    if (!terminateTarget) return;
    setErrorMsg('');
    try {
      const res = await payrollApi.terminateEmployee(terminateTarget._id, terminationReason);
      setSuccessMsg(res.message || `Terminated ${terminateTarget.name}. System access revoked.`);
      setTerminateTarget(null);
      setTimeout(() => setSuccessMsg(''), 5000);
      loadWorkforceData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to terminate employee');
    }
  };

  const handleConfirmRoleChange = async () => {
    if (!roleChangeTarget) return;
    setErrorMsg('');
    try {
      const res = await payrollApi.changeEmployeeRole(roleChangeTarget._id, newSelectedRole);
      setSuccessMsg(res.message || `Role updated to ${newSelectedRole} for ${roleChangeTarget.name}`);
      setRoleChangeTarget(null);
      setTimeout(() => setSuccessMsg(''), 5000);
      loadWorkforceData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to update employee role');
    }
  };

  // Filtered Directory
  const filteredEmployees = employees.filter((emp) => {
    const role = (emp.role || emp.designation || 'DRIVER').toUpperCase();
    const isTerminated = emp.active === false;

    if (roleFilter === 'TERMINATED') {
      if (!isTerminated) return false;
    } else {
      if (roleFilter !== 'ALL' && !role.includes(roleFilter)) return false;
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchName = emp.name?.toLowerCase().includes(q);
      const matchCode = emp.code?.toLowerCase().includes(q);
      const matchPhone = emp.phone?.toLowerCase().includes(q);
      const matchEmail = (emp.email || emp.user?.email || '').toLowerCase().includes(q);
      const matchTruck = (emp.assignedTruck?.regNumber || '').toLowerCase().includes(q);
      const matchLicense = (emp.licenseNo || '').toLowerCase().includes(q);
      return matchName || matchCode || matchPhone || matchEmail || matchTruck || matchLicense;
    }

    return true;
  });

  const activeEmployees = employees.filter((e) => e.active !== false);
  const managersCount = activeEmployees.filter((e) => (e.role || e.designation) === 'MANAGER').length;
  const staffCount = activeEmployees.filter((e) => (e.role || e.designation) === 'STAFF').length;
  const driversCount = activeEmployees.filter((e) => ['DRIVER', 'CLEANER', 'LABOUR', 'MECHANIC'].includes(e.role || e.designation)).length;
  const terminatedCount = employees.filter((e) => e.active === false).length;

  return (
    <div className="space-y-6">
      {/* Top Header & Authority Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-obsidian-card via-slate-900 to-obsidian-surface border border-white/5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-purple-950 text-purple-300 border border-purple-800">
              COMPANY WORKFORCE & HIRING ENGINE
            </span>
            <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${
              currentRole === 'ADMIN'
                ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                : currentRole === 'MANAGER'
                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                : 'bg-amber-950 text-amber-300 border-amber-800'
            }`}>
              AUTHORITY TIER: {currentRole}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {currentRole === 'ADMIN' && 'Full Rights (Hire/Fire All, Reassign Roles)'}
              {currentRole === 'MANAGER' && 'Managerial Rights (Hire & Terminate Staff & Drivers)'}
              {currentRole === 'STAFF' && 'Desk Rights (Onboard Drivers Only • Termination Prohibited)'}
            </span>
          </div>
          <h2 className="text-xl font-extrabold text-white font-mono mt-1.5">
            Enterprise Crew Directory & Recruitment Roster
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            End-to-end personnel onboarding, salary contracts, vehicle allocations, role promotions and termination audit
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadWorkforceData}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            title="Refresh Directory"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => handleOpenHireModal()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold bg-emerald-600 hover:bg-emerald-500 text-slate-950 transition-all shadow-lg"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Onboard / Hire Personnel</span>
          </button>
        </div>
      </div>

      {/* Alert Banners */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-950/80 border border-emerald-500 text-emerald-300 rounded-2xl text-xs font-mono flex items-center gap-2.5 shadow-lg">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3.5 bg-rose-950/80 border border-rose-500 text-rose-300 rounded-2xl text-xs font-mono flex items-center gap-2.5 shadow-lg">
          <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 4-Bento Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
        <div
          onClick={() => setRoleFilter('ALL')}
          className={`bento-card p-4 cursor-pointer transition-all ${roleFilter === 'ALL' ? 'border-purple-500/50 bg-purple-950/10' : ''}`}
        >
          <div className="flex justify-between items-center text-slate-400 text-[11px]">
            <span>TOTAL ACTIVE WORKFORCE</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-extrabold text-white mt-1.5">
            {activeEmployees.length} <span className="text-xs text-slate-500 font-normal">Employees</span>
          </div>
          <div className="text-[11px] text-purple-300 mt-1">Payroll & Auth Synced</div>
        </div>

        <div
          onClick={() => setRoleFilter('MANAGER')}
          className={`bento-card p-4 cursor-pointer transition-all ${roleFilter === 'MANAGER' ? 'border-emerald-500/50 bg-emerald-950/10' : ''}`}
        >
          <div className="flex justify-between items-center text-slate-400 text-[11px]">
            <span>OPERATIONS MANAGERS</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 mt-1.5">
            {managersCount} <span className="text-xs text-slate-500 font-normal">2nd-Tier Auth</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Corridor & Challan Approvers</div>
        </div>

        <div
          onClick={() => setRoleFilter('STAFF')}
          className={`bento-card p-4 cursor-pointer transition-all ${roleFilter === 'STAFF' ? 'border-amber-500/50 bg-amber-950/10' : ''}`}
        >
          <div className="flex justify-between items-center text-slate-400 text-[11px]">
            <span>OPERATIONS & DESK STAFF</span>
            <Briefcase className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-amber-300 mt-1.5">
            {staffCount} <span className="text-xs text-slate-500 font-normal">Desk Staff</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Commercial Billing & Waybills</div>
        </div>

        <div
          onClick={() => setRoleFilter('DRIVER')}
          className={`bento-card p-4 cursor-pointer transition-all ${roleFilter === 'DRIVER' ? 'border-cyan-500/50 bg-cyan-950/10' : ''}`}
        >
          <div className="flex justify-between items-center text-slate-400 text-[11px]">
            <span>COMMERCIAL DRIVERS (HCV)</span>
            <Truck className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-extrabold text-cyan-300 mt-1.5">
            {driversCount} <span className="text-xs text-slate-500 font-normal">Active Pilots</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Fleet Vehicles Assigned</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/80 rounded-2xl border border-slate-800 font-mono text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {(['ALL', 'MANAGER', 'STAFF', 'DRIVER', 'TERMINATED'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setRoleFilter(tab)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                roleFilter === tab
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tab === 'ALL' && 'All Crew'}
              {tab === 'MANAGER' && `Managers (${managersCount})`}
              {tab === 'STAFF' && `Staff (${staffCount})`}
              {tab === 'DRIVER' && `Drivers (${driversCount})`}
              {tab === 'TERMINATED' && `Fired / Inactive (${terminatedCount})`}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, code, truck reg..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:border-purple-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Main Workforce Table */}
      <div className="bento-card overflow-hidden">
        <div className="overflow-x-auto font-mono text-xs">
          <table className="w-full text-left">
            <thead className="bg-slate-900/90 text-slate-400 text-[10px] uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-3">Employee</th>
                <th className="py-3 px-3">Role / Designation</th>
                <th className="py-3 px-3">Contact & Login</th>
                <th className="py-3 px-3">Asset / Truck</th>
                <th className="py-3 px-3 text-right">Base Salary</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center">Management Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredEmployees.map((emp) => {
                const role = (emp.role || emp.designation || 'DRIVER').toUpperCase();
                const isTerminated = emp.active === false;

                // RBAC Termination Rule Check:
                // Staff CANNOT fire anyone
                // Manager cannot fire Managers or Admins
                // Admin can fire anyone
                const canFireThisPerson =
                  canFire &&
                  !isTerminated &&
                  (currentRole === 'ADMIN' || currentRole === 'DEV'
                    ? true
                    : currentRole === 'MANAGER'
                    ? role !== 'MANAGER' && role !== 'ADMIN' && role !== 'DEV'
                    : false);

                return (
                  <tr key={emp._id} className="hover:bg-slate-800/40 transition-colors">
                    {/* Employee Name & Code */}
                    <td className="py-3 px-3">
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>{emp.name}</span>
                        {isTerminated && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-rose-950 text-rose-300 border border-rose-800">
                            TERMINATED
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Code: <span className="text-cyan-300 font-semibold">{emp.code}</span>
                        {emp.homeTown && ` • ${emp.homeTown}`}
                      </div>
                    </td>

                    {/* Role & Designation */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          role === 'ADMIN'
                            ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                            : role === 'MANAGER'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : role === 'STAFF'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-purple-950 text-purple-300 border border-purple-800'
                        }`}>
                          {role}
                        </span>
                        {canChangeRole && (
                          <button
                            onClick={() => {
                              setRoleChangeTarget(emp);
                              setNewSelectedRole(role === 'MANAGER' ? 'STAFF' : role === 'STAFF' ? 'MANAGER' : 'STAFF');
                            }}
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300"
                            title="Promote or Change Role (Admin Feature)"
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 truncate max-w-[160px]">
                        {emp.designation || role}
                      </div>
                    </td>

                    {/* Contact & Email */}
                    <td className="py-3 px-3">
                      <div className="text-slate-200">{emp.phone}</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[160px]">
                        {emp.email || emp.user?.email || 'portal-auth-linked'}
                      </div>
                    </td>

                    {/* Assigned Vehicle */}
                    <td className="py-3 px-3">
                      {emp.assignedTruck?.regNumber ? (
                        <div className="flex items-center gap-1.5 text-cyan-300 font-bold">
                          <Truck className="w-3.5 h-3.5" />
                          <span>{emp.assignedTruck.regNumber}</span>
                        </div>
                      ) : role === 'DRIVER' ? (
                        <span className="text-[11px] text-slate-500 italic">No Truck Assigned</span>
                      ) : (
                        <span className="text-[11px] text-slate-500">— Office Desk</span>
                      )}
                      {emp.licenseNo && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Lic: {emp.licenseNo}
                        </div>
                      )}
                    </td>

                    {/* Base Salary & Bhatta */}
                    <td className="py-3 px-3 text-right">
                      <div className="font-bold text-emerald-400">
                        ₹{(emp.baseSalary || 18000).toLocaleString('en-IN')}<span className="text-[10px] text-slate-500 font-normal">/mo</span>
                      </div>
                      {emp.bhattaPerDay > 0 && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          +₹{emp.bhattaPerDay}/d bhatta
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        isTerminated
                          ? 'bg-rose-950 text-rose-400 border border-rose-800'
                          : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      }`}>
                        {isTerminated ? 'FIRED' : 'ACTIVE'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setViewEmployeeTarget(emp)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] flex items-center gap-1"
                          title="View Complete Dossier"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </button>

                        {canFireThisPerson ? (
                          <button
                            onClick={() => {
                              setTerminateTarget(emp);
                              setTerminationReason('Termination of Contract by Management');
                            }}
                            className="px-2 py-1 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 text-[10px] flex items-center gap-1 font-bold"
                            title="Terminate / Fire Personnel"
                          >
                            <UserMinus className="w-3 h-3" />
                            <span>Fire</span>
                          </button>
                        ) : !isTerminated && currentRole === 'STAFF' ? (
                          <span className="text-[10px] text-slate-500 px-1 italic">
                            No Fire Auth
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* =====================================================================
          MODAL 1: HIRE / ONBOARD NEW WORKFORCE PERSONNEL
         ===================================================================== */}
      {isHireModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-obsidian-surface border border-slate-700 p-6 rounded-2xl max-w-2xl w-full glass-panel-heavy shadow-2xl space-y-4 font-mono text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">RECRUIT & ONBOARD NEW PERSONNEL</h3>
                  <p className="text-[10px] text-slate-400">
                    Authority: {currentRole} • Provisions Payroll Record & Portal Credentials
                  </p>
                </div>
              </div>
              <button onClick={() => setIsHireModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitHire} className="space-y-4">
              {/* Role Selection Tabs */}
              <div>
                <label className="text-slate-400 block mb-1 font-bold">1. COMPANY ROLE CLASSIFICATION</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['MANAGER', 'STAFF', 'DRIVER'] as const).map((r) => {
                    const isAllowed = allowedHiringRoles.includes(r as any);
                    const isSelected = hireRole === r;
                    return (
                      <button
                        type="button"
                        key={r}
                        disabled={!isAllowed}
                        onClick={() => {
                          setHireRole(r);
                          setHireDesignation(r === 'MANAGER' ? 'OPERATIONS MANAGER' : r === 'STAFF' ? 'FLEET DISPATCH DESK' : 'HEAVY COMMERCIAL PILOT');
                          setHireBaseSalary(r === 'MANAGER' ? '45000' : r === 'STAFF' ? '28000' : '18000');
                        }}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          isSelected
                            ? 'bg-purple-600 border-purple-400 text-white font-bold shadow-md'
                            : isAllowed
                            ? 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                            : 'bg-slate-950/60 border-slate-900 text-slate-600 cursor-not-allowed opacity-40'
                        }`}
                      >
                        <div className="font-bold">{r}</div>
                        <div className="text-[10px] mt-0.5">
                          {!isAllowed ? 'Requires Higher Role' : r === 'MANAGER' ? '2nd-Tier Checker' : r === 'STAFF' ? 'Billing & Waybills' : 'Vehicle Pilot'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Personal Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Full Legal Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vikramaditya Sharma"
                    value={hireName}
                    onChange={(e) => setHireName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Email (Login Username) *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. vikram.sharma@tmsfleet.com"
                    value={hireEmail}
                    onChange={(e) => setHireEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Mobile Phone *</label>
                  <input
                    type="text"
                    required
                    placeholder="+91 98201 88412"
                    value={hirePhone}
                    onChange={(e) => setHirePhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Designation Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Senior HCV Pilot"
                    value={hireDesignation}
                    onChange={(e) => setHireDesignation(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Initial Password</label>
                  <input
                    type="text"
                    value={hirePassword}
                    onChange={(e) => setHirePassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-amber-300 font-bold"
                  />
                </div>
              </div>

              {/* Compensation */}
              <div className="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800 space-y-3">
                <span className="text-slate-300 font-bold block">2. COMPENSATION & PAYROLL CONTRACT</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Base Retainer Salary (₹/mo)</label>
                    <input
                      type="number"
                      required
                      value={hireBaseSalary}
                      onChange={(e) => setHireBaseSalary(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-emerald-400 font-bold"
                    />
                  </div>
                  {hireRole === 'DRIVER' && (
                    <>
                      <div>
                        <label className="text-slate-400 block mb-1">Transit Bhatta (₹/day)</label>
                        <input
                          type="number"
                          value={hireBhatta}
                          onChange={(e) => setHireBhatta(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-cyan-300 font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-1">KM Incentive (₹/km)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={hireKmIncentive}
                          onChange={(e) => setHireKmIncentive(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-purple-300 font-bold"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Driver-Specific Asset & License Fields */}
              {hireRole === 'DRIVER' && (
                <div className="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800 space-y-3">
                  <span className="text-slate-300 font-bold block">3. VEHICLE ASSET & HEAVY DRIVING LICENSE</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-slate-400 block mb-1">Assign Fleet Truck</label>
                      <select
                        value={hireTruck}
                        onChange={(e) => setHireTruck(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                      >
                        <option value="">No Truck Assigned (Pool Pilot)</option>
                        {trucks.map((t) => (
                          <option key={t._id} value={t._id}>
                            {t.registrationNumber} ({t.make} • {t.capacityTons} MT)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Commercial License #</label>
                      <input
                        type="text"
                        placeholder="e.g. MH0420190044192"
                        value={hireLicenseNo}
                        onChange={(e) => setHireLicenseNo(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">License Expiry Date</label>
                      <input
                        type="date"
                        value={hireLicenseExpiry}
                        onChange={(e) => setHireLicenseExpiry(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Additional Personnel Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Hometown / State</label>
                  <input
                    type="text"
                    placeholder="e.g. Varanasi, UP"
                    value={hireHomeTown}
                    onChange={(e) => setHireHomeTown(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Blood Group</label>
                  <select
                    value={hireBloodGroup}
                    onChange={(e) => setHireBloodGroup(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((bg) => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Emergency Contact</label>
                  <input
                    type="text"
                    placeholder="+91 98201 00000"
                    value={hireEmergencyContact}
                    onChange={(e) => setHireEmergencyContact(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsHireModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold shadow-lg"
                >
                  Confirm & Onboard Personnel →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: TERMINATION / FIRE CONFIRMATION
         ===================================================================== */}
      {terminateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="bg-obsidian-surface border border-rose-500/60 p-6 rounded-2xl max-w-md w-full glass-panel-heavy shadow-2xl space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-rose-400 flex items-center gap-2">
                <UserMinus className="w-5 h-5 text-rose-500" />
                <span>TERMINATE / FIRE EMPLOYEE</span>
              </h3>
              <button onClick={() => setTerminateTarget(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-rose-950/40 border border-rose-800 rounded-xl space-y-1 text-slate-300">
              <div className="font-bold text-white text-sm">{terminateTarget.name} ({terminateTarget.code})</div>
              <div>Role: <strong>{terminateTarget.role || terminateTarget.designation}</strong></div>
              <div>Salary: ₹{(terminateTarget.baseSalary || 0).toLocaleString('en-IN')}/mo</div>
            </div>

            <p className="text-slate-400">
              Are you sure you want to terminate this contract? This will immediately revoke portal credentials, unassign any assigned vehicle, and log the termination in the corporate audit ledger.
            </p>

            <div>
              <label className="text-slate-400 block mb-1 font-bold">Formal Termination Reason *</label>
              <textarea
                required
                rows={3}
                value={terminationReason}
                onChange={(e) => setTerminationReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTerminateTarget(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmTerminate}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-glow-rose"
              >
                Confirm Termination
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: ROLE CHANGE / PROMOTION (ADMIN EXCLUSIVE)
         ===================================================================== */}
      {roleChangeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-obsidian-surface border border-cyan-500/40 p-6 rounded-2xl max-w-md w-full glass-panel-heavy shadow-2xl space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-cyan-300 flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-cyan-400" />
                <span>PROMOTE / REASSIGN COMPANY ROLE</span>
              </h3>
              <button onClick={() => setRoleChangeTarget(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
              <div className="font-bold text-white">{roleChangeTarget.name} ({roleChangeTarget.code})</div>
              <div className="text-slate-400">Current Role: <strong className="text-amber-400">{roleChangeTarget.role || roleChangeTarget.designation}</strong></div>
            </div>

            <div>
              <label className="text-slate-400 block mb-1 font-bold">Select New Company Tier & Permission</label>
              <select
                value={newSelectedRole}
                onChange={(e) => setNewSelectedRole(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-bold"
              >
                <option value="MANAGER">MANAGER (2nd-Tier Auth, Approve Challans & Trips)</option>
                <option value="STAFF">STAFF (Commercial Desk, Bilty & Driver Onboarding)</option>
                <option value="DRIVER">DRIVER (Commercial Vehicle Pilot, Route Telematics)</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRoleChangeTarget(null)}
                className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRoleChange}
                className="flex-1 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold shadow-md"
              >
                Update Role Authority
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 4: EMPLOYEE DOSSIER VIEW
         ===================================================================== */}
      {viewEmployeeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="bg-obsidian-surface border border-slate-700 p-6 rounded-2xl max-w-md w-full glass-panel-heavy shadow-2xl space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                <span>PERSONNEL DOSSIER: {viewEmployeeTarget.code}</span>
              </h3>
              <button onClick={() => setViewEmployeeTarget(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-slate-300">
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Full Name</span>
                <span className="font-bold text-white">{viewEmployeeTarget.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Role / Designation</span>
                <span className="font-bold text-purple-300">{viewEmployeeTarget.role || viewEmployeeTarget.designation}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Phone</span>
                <span className="font-bold text-slate-200">{viewEmployeeTarget.phone}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Email</span>
                <span className="font-bold text-slate-200">{viewEmployeeTarget.email || viewEmployeeTarget.user?.email || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Assigned Truck</span>
                <span className="font-bold text-cyan-300">{viewEmployeeTarget.assignedTruck?.regNumber || 'None'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Base Salary</span>
                <span className="font-bold text-emerald-400">₹{(viewEmployeeTarget.baseSalary || 0).toLocaleString('en-IN')}/mo</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">License Number</span>
                <span className="font-bold text-amber-300">{viewEmployeeTarget.licenseNo || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Hometown</span>
                <span>{viewEmployeeTarget.homeTown || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Hired By</span>
                <span>{viewEmployeeTarget.hiredByName || 'Management'}</span>
              </div>
              {viewEmployeeTarget.active === false && (
                <div className="p-3 bg-rose-950/60 rounded-xl border border-rose-800 space-y-1">
                  <div className="text-rose-300 font-bold">TERMINATION AUDIT:</div>
                  <div className="text-rose-400 text-[11px]">{viewEmployeeTarget.terminationReason || 'Contract Terminated'}</div>
                  <div className="text-slate-500 text-[10px]">Date: {new Date(viewEmployeeTarget.terminatedAt).toLocaleString()}</div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewEmployeeTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 font-bold"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

