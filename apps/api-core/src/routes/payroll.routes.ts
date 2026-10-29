import { Router } from 'express';
import { z } from 'zod';
import { Employee, Attendance, Advance, Payslip, User, Truck } from '../models/index.js';
import { authenticate, requireRole, asyncH, HttpError, validate } from '../middleware/index.js';
import { hashSecret } from '../security/cryptoGuard.js';
import {
  generatePayrollRun,
  approvePayslip,
  payPayslip,
  computePayslip,
} from '../services/payroll.service.js';
import type { Actor } from '../services/trip.service.js';

export const payrollRouter = Router();

// EMPLOYEES MASTER (Includes linked User account details, role and termination status)
payrollRouter.get(
  '/employees',
  authenticate,
  requireRole('ADMIN', 'MANAGER', 'STAFF', 'DEV'),
  asyncH(async (req, res) => {
    const { includeTerminated } = req.query;
    const filter = includeTerminated === 'true' ? {} : { active: true };
    const employees = await Employee.find(filter)
      .populate('assignedTruck', 'regNumber make model status')
      .populate('hiredBy', 'name role')
      .sort({ code: 1 })
      .lean();

    // Attach linked user accounts
    const empIds = employees.map((e) => e._id);
    const users = await User.find({ employee: { $in: empIds } })
      .select('email role active lastLoginAt employee')
      .lean();

    const userMap = new Map(users.map((u) => [String(u.employee), u]));

    const enriched = employees.map((e) => ({
      ...e,
      user: userMap.get(String(e._id)) || null,
      role: userMap.get(String(e._id))?.role || e.designation,
    }));

    res.json(enriched);
  }),
);

// HIRE NEW WORKFORCE (Strict Hierarchical RBAC: Staff -> Driver only; Manager -> Staff & Driver; Admin -> All)
const HireEmployeeSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10),
  role: z.enum(['MANAGER', 'STAFF', 'DRIVER']),
  designation: z.enum(['MANAGER', 'STAFF', 'DRIVER', 'CLEANER', 'LABOUR', 'MECHANIC']).optional(),
  code: z.string().optional(),
  password: z.string().min(6).optional().default('Fleet@2026'),
  baseSalary: z.number().min(0).default(18000),
  bhattaPerDay: z.number().min(0).default(350),
  kmIncentive: z.number().min(0).default(0.5),
  assignedTruck: z.string().optional(),
  licenseNo: z.string().optional(),
  licenseExpiry: z.string().optional(),
  homeTown: z.string().optional(),
  bloodGroup: z.string().optional(),
  emergencyContact: z.string().optional(),
  aadhaarLast4: z.string().optional(),
  bankAccountLast4: z.string().optional(),
});

payrollRouter.post(
  '/employees/hire',
  authenticate,
  requireRole('ADMIN', 'MANAGER', 'STAFF', 'DEV'),
  validate(HireEmployeeSchema),
  asyncH(async (req, res) => {
    const actorRole = req.auth!.role;
    const targetRole = req.body.role;

    // 1. RBAC Permissive Matrix Enforcement
    if (actorRole === 'STAFF') {
      if (targetRole !== 'DRIVER') {
        throw new HttpError(403, 'Permission Denied: Staff accounts are strictly restricted to onboarding Drivers only.');
      }
    } else if (actorRole === 'MANAGER') {
      if (targetRole !== 'STAFF' && targetRole !== 'DRIVER') {
        throw new HttpError(403, 'Permission Denied: Managers can only hire Operations Staff and Commercial Drivers.');
      }
    }

    // 2. Prevent duplicate user email
    const existingUser = await User.findOne({ email: req.body.email.toLowerCase() });
    if (existingUser) {
      throw new HttpError(409, `A user account with email '${req.body.email}' already exists.`);
    }

    // 3. Auto-generate unique employee code if not provided
    let empCode = req.body.code?.toUpperCase();
    if (!empCode) {
      const prefix = targetRole === 'MANAGER' ? 'MGR' : targetRole === 'STAFF' ? 'STF' : 'DRV';
      const count = await Employee.countDocuments();
      empCode = `${prefix}-${String(count + 101).padStart(4, '0')}`;
    }

    // 4. Create Employee Record
    const emp = await Employee.create({
      code: empCode,
      name: req.body.name,
      email: req.body.email.toLowerCase(),
      phone: req.body.phone,
      designation: req.body.designation || targetRole,
      licenseNo: req.body.licenseNo,
      licenseExpiry: req.body.licenseExpiry ? new Date(req.body.licenseExpiry) : undefined,
      homeTown: req.body.homeTown,
      bloodGroup: req.body.bloodGroup,
      emergencyContact: req.body.emergencyContact,
      aadhaarLast4: req.body.aadhaarLast4,
      bankAccountLast4: req.body.bankAccountLast4,
      baseSalary: req.body.baseSalary,
      bhattaPerDay: req.body.bhattaPerDay,
      kmIncentive: req.body.kmIncentive,
      assignedTruck: req.body.assignedTruck || undefined,
      joinedAt: new Date(),
      active: true,
      hiredBy: req.auth!.sub as any,
      hiredByName: `${actorRole} (${req.auth?.sub})`,
    });

    // 5. Create Linked User Account
    const passwordHash = await hashSecret(req.body.password || 'Fleet@2026');
    const newUser = await User.create({
      name: req.body.name,
      email: req.body.email.toLowerCase(),
      phone: req.body.phone,
      role: targetRole,
      password: passwordHash,
      employee: emp._id,
      active: true,
    });

    // 6. If vehicle assigned to driver, update Truck document
    if (req.body.assignedTruck && targetRole === 'DRIVER') {
      await Truck.findByIdAndUpdate(req.body.assignedTruck, { assignedDriver: emp._id });
    }

    res.status(201).json({
      ok: true,
      message: `Successfully onboarded ${targetRole}: ${emp.name} (${emp.code})`,
      employee: emp,
      user: {
        id: newUser._id,
        email: newUser.email,
        role: newUser.role,
      },
    });
  }),
);

// TERMINATE / FIRE EMPLOYEE (Strict RBAC: Staff CANNOT fire; Manager fires Staff & Driver; Admin fires all)
const TerminateSchema = z.object({
  reason: z.string().min(3).default('Contract Terminated by Company Management'),
});

payrollRouter.post(
  '/employees/:id/terminate',
  authenticate,
  requireRole('ADMIN', 'MANAGER', 'STAFF', 'DEV'),
  validate(TerminateSchema),
  asyncH(async (req, res) => {
    const actorRole = req.auth!.role;
    const targetEmpId = req.params.id;

    // 1. Staff strictly forbidden from terminating / firing
    if (actorRole === 'STAFF') {
      throw new HttpError(403, 'Permission Denied: Operations Staff can only hire and cannot terminate or fire employees.');
    }

    const emp = await Employee.findById(targetEmpId);
    if (!emp) throw new HttpError(404, 'Employee record not found');

    const linkedUser = await User.findOne({ employee: emp._id });

    // 2. Manager forbidden from terminating other Managers or Admins
    if (actorRole === 'MANAGER') {
      const targetRole = linkedUser?.role || emp.designation;
      if (targetRole === 'MANAGER' || targetRole === 'ADMIN' || targetRole === 'DEV') {
        throw new HttpError(403, 'Permission Denied: Managers cannot terminate or fire managerial or executive personnel.');
      }
    }

    // 3. Mark Employee as Terminated
    emp.active = false;
    emp.terminationReason = req.body.reason;
    emp.terminatedAt = new Date();
    emp.terminatedBy = req.auth!.sub as any;
    if (emp.assignedTruck) {
      await Truck.findByIdAndUpdate(emp.assignedTruck, { $unset: { assignedDriver: 1 } });
      emp.assignedTruck = undefined as any;
    }
    await emp.save();

    // 4. Revoke portal login and kill JWT token family
    if (linkedUser) {
      linkedUser.active = false;
      linkedUser.tokenVersion = (linkedUser.tokenVersion || 0) + 1;
      await linkedUser.save();
    }

    res.json({
      ok: true,
      message: `Employee ${emp.name} (${emp.code}) has been terminated and system access revoked.`,
    });
  }),
);

// CHANGE ROLE / PROMOTION (Admin & Dev Exclusive)
const ChangeRoleSchema = z.object({
  role: z.enum(['MANAGER', 'STAFF', 'DRIVER', 'ADMIN']),
});

payrollRouter.patch(
  '/employees/:id/role',
  authenticate,
  requireRole('ADMIN', 'DEV'),
  validate(ChangeRoleSchema),
  asyncH(async (req, res) => {
    const { role } = req.body;
    const emp = await Employee.findById(req.params.id);
    if (!emp) throw new HttpError(404, 'Employee record not found');

    emp.designation = role as any;
    await emp.save();

    const user = await User.findOne({ employee: emp._id });
    if (user) {
      user.role = role;
      await user.save();
    }

    res.json({
      ok: true,
      message: `Role for ${emp.name} successfully updated to ${role}.`,
      employee: emp,
      role,
    });
  }),
);

// UPDATE EMPLOYEE DETAILS
payrollRouter.put(
  '/employees/:id',
  authenticate,
  requireRole('ADMIN', 'MANAGER', 'STAFF', 'DEV'),
  asyncH(async (req, res) => {
    const actorRole = req.auth!.role;
    const emp = await Employee.findById(req.params.id);
    if (!emp) throw new HttpError(404, 'Employee record not found');

    const linkedUser = await User.findOne({ employee: emp._id });
    const targetRole = linkedUser?.role || emp.designation;

    // RBAC validation
    if (actorRole === 'STAFF' && targetRole !== 'DRIVER') {
      throw new HttpError(403, 'Staff can only modify Driver records.');
    }
    if (actorRole === 'MANAGER' && (targetRole === 'MANAGER' || targetRole === 'ADMIN')) {
      throw new HttpError(403, 'Managers cannot modify Manager or Admin records.');
    }

    const {
      name,
      phone,
      baseSalary,
      bhattaPerDay,
      kmIncentive,
      assignedTruck,
      licenseNo,
      licenseExpiry,
      homeTown,
      bloodGroup,
      emergencyContact,
    } = req.body;

    if (name) emp.name = name;
    if (phone) emp.phone = phone;
    if (baseSalary !== undefined) emp.baseSalary = baseSalary;
    if (bhattaPerDay !== undefined) emp.bhattaPerDay = bhattaPerDay;
    if (kmIncentive !== undefined) emp.kmIncentive = kmIncentive;
    if (licenseNo !== undefined) emp.licenseNo = licenseNo;
    if (licenseExpiry) emp.licenseExpiry = new Date(licenseExpiry);
    if (homeTown !== undefined) emp.homeTown = homeTown;
    if (bloodGroup !== undefined) emp.bloodGroup = bloodGroup;
    if (emergencyContact !== undefined) emp.emergencyContact = emergencyContact;

    if (assignedTruck !== undefined) {
      if (emp.assignedTruck && String(emp.assignedTruck) !== String(assignedTruck)) {
        await Truck.findByIdAndUpdate(emp.assignedTruck, { $unset: { assignedDriver: 1 } });
      }
      emp.assignedTruck = assignedTruck || undefined;
      if (assignedTruck) {
        await Truck.findByIdAndUpdate(assignedTruck, { assignedDriver: emp._id });
      }
    }

    await emp.save();

    if (linkedUser && name) {
      linkedUser.name = name;
      await linkedUser.save();
    }

    res.json({ ok: true, message: 'Employee updated successfully', employee: emp });
  }),
);

// Backward compatible endpoint for simple employee creation
const CreateEmployeeSchema = z.object({
  code: z.string().toUpperCase(),
  name: z.string().min(2),
  phone: z.string().min(10),
  designation: z.enum(['DRIVER', 'CLEANER', 'LABOUR', 'MECHANIC', 'STAFF', 'MANAGER', 'ADMIN']).default('DRIVER'),
  licenseNo: z.string().optional(),
  licenseExpiry: z.string().transform((v) => new Date(v)).optional(),
  homeTown: z.string().optional(),
  baseSalary: z.number().min(0),
  kmIncentive: z.number().default(0.5),
  bhattaPerDay: z.number().default(350),
  assignedTruck: z.string().optional(),
});

payrollRouter.post(
  '/employees',
  authenticate,
  requireRole('ADMIN', 'MANAGER', 'DEV'),
  validate(CreateEmployeeSchema),
  asyncH(async (req, res) => {
    const emp = await Employee.create(req.body);
    res.status(201).json(emp);
  }),
);

// ATTENDANCE
payrollRouter.get(
  '/attendance',
  authenticate,
  requireRole('ADMIN', 'MANAGER', 'STAFF', 'DEV'),
  asyncH(async (req, res) => {
    const { date, month } = req.query;
    const query: Record<string, unknown> = {};
    if (date) query.date = date;
    else if (month) query.date = new RegExp(`^${month}`);

    const records = await Attendance.find(query)
      .populate('employee', 'name code designation')
      .populate('truck', 'regNumber')
      .sort({ date: -1 })
      .lean();
    res.json(records);
  }),
);

payrollRouter.post(
  '/attendance',
  authenticate,
  requireRole('ADMIN', 'MANAGER', 'STAFF', 'DEV'),
  validate(
    z.object({
      employee: z.string(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      status: z.enum(['PRESENT', 'ON_TRIP', 'ABSENT', 'LEAVE', 'HALF_DAY']),
      truck: z.string().optional(),
    }),
  ),
  asyncH(async (req, res) => {
    const record = await Attendance.findOneAndUpdate(
      { employee: req.body.employee, date: req.body.date },
      { ...req.body, markedBy: req.auth!.sub },
      { upsert: true, new: true },
    );
    res.json(record);
  }),
);

// ADVANCES
payrollRouter.get(
  '/advances',
  authenticate,
  requireRole('ADMIN', 'MANAGER', 'STAFF', 'DEV'),
  asyncH(async (req, res) => {
    const { employeeId, recovered } = req.query;
    const query: Record<string, unknown> = {};
    if (employeeId) query.employee = employeeId;
    if (recovered !== undefined) query.recovered = recovered === 'true';

    const advances = await Advance.find(query)
      .populate('employee', 'name code')
      .populate('trip', 'lrNumber')
      .sort({ date: -1 })
      .lean();
    res.json(advances);
  }),
);

// PAYROLL RUNS & PAYSLIPS
payrollRouter.get(
  '/payslips',
  authenticate,
  requireRole('ADMIN', 'MANAGER', 'DEV'),
  asyncH(async (req, res) => {
    const { month } = req.query;
    const query = month ? { month } : {};
    const slips = await Payslip.find(query)
      .populate('employee', 'name code designation phone')
      .sort({ month: -1, 'employee.code': 1 })
      .lean();
    res.json(slips);
  }),
);

// Preview / compute single payslip
payrollRouter.get(
  '/payslips/preview',
  authenticate,
  requireRole('ADMIN', 'MANAGER', 'DEV'),
  asyncH(async (req, res) => {
    const { employeeId, month } = req.query;
    if (!employeeId || !month) throw new HttpError(400, 'employeeId and month are required');
    const calc = await computePayslip(String(employeeId), String(month));
    res.json(calc);
  }),
);

// Generate or refresh full monthly payroll run
payrollRouter.post(
  '/generate-run',
  authenticate,
  requireRole('ADMIN', 'DEV'),
  validate(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) })),
  asyncH(async (req, res) => {
    const slips = await generatePayrollRun(req.body.month);
    res.json({ ok: true, count: slips.length, slips });
  }),
);

// Approve Payslip
payrollRouter.post(
  '/payslips/:id/approve',
  authenticate,
  requireRole('ADMIN', 'MANAGER', 'DEV'),
  asyncH(async (req, res) => {
    const actor: Actor = { id: req.auth!.sub, role: req.auth!.role };
    const slip = await approvePayslip(req.params.id, actor);
    res.json(slip);
  }),
);

// Pay Payslip
payrollRouter.post(
  '/payslips/:id/pay',
  authenticate,
  requireRole('ADMIN', 'DEV'),
  asyncH(async (req, res) => {
    const actor: Actor = { id: req.auth!.sub, role: req.auth!.role };
    const slip = await payPayslip(req.params.id, actor);
    res.json(slip);
  }),
);
