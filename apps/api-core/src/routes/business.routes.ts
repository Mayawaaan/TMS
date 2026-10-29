import { Router } from 'express';
import { z } from 'zod';
import { Client, Vendor, Trip, LedgerEntry } from '../models/index.js';
import { authenticate, requireRole, asyncH, HttpError, validate, requireFinancialPin } from '../middleware/index.js';
import { payVendor } from '../services/ops.service.js';
import type { Actor } from '../services/trip.service.js';

export const businessRouter = Router();

// CLIENTS
businessRouter.get(
  '/clients',
  authenticate,
  requireRole('ADMIN', 'MANAGER', 'STAFF', 'DEV'),
  asyncH(async (req, res) => {
    const clients = await Client.find().sort({ name: 1 }).lean();
    res.json(clients);
  }),
);

businessRouter.get(
  '/clients/:id',
  authenticate,
  requireRole('ADMIN', 'MANAGER', 'STAFF', 'DEV'),
  asyncH(async (req, res) => {
    const client = await Client.findById(req.params.id).lean();
    if (!client) throw new HttpError(404, 'Client not found');
    res.json(client);
  }),
);

const CreateClientSchema = z.object({
  code: z.string().min(2).toUpperCase(),
  name: z.string().min(2),
  industry: z.string().optional(),
  gstin: z.string().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/),
  pan: z.string().min(10).max(10).toUpperCase(),
  city: z.string().min(2),
  state: z.string().min(2),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  creditLimit: z.number().min(0),
  paymentTermsDays: z.enum(['15', '30', '45', '60', '90']).transform(Number).optional(),
  gstMode: z.enum(['RCM_5', 'FCM_12']).default('RCM_5'),
});

businessRouter.post(
  '/clients',
  authenticate,
  requireRole('ADMIN', 'DEV'),
  validate(CreateClientSchema),
  asyncH(async (req, res) => {
    const client = await Client.create(req.body);
    res.status(201).json(client);
  }),
);

// Credit Limit Override (ADMIN only, requires 6-digit financial PIN)
const OverrideCreditSchema = z.object({
  newLimit: z.number().min(0),
  reason: z.string().min(3),
  financialPin: z.string().regex(/^\d{6}$/),
});

businessRouter.post(
  '/clients/:id/override-credit',
  authenticate,
  requireRole('ADMIN', 'DEV'),
  requireFinancialPin,
  validate(OverrideCreditSchema),
  asyncH(async (req, res) => {
    const client = await Client.findById(req.params.id);
    if (!client) throw new HttpError(404, 'Client not found');

    const previousLimit = client.creditLimit;
    client.creditLimit = req.body.newLimit;
    client.creditOverrides.push({
      by: req.auth!.sub as never,
      at: new Date(),
      previousLimit,
      newLimit: req.body.newLimit,
      reason: req.body.reason,
    });

    await client.save();
    res.json({ ok: true, client });
  }),
);

// Add / Approve Rate Contract
const RateContractSchema = z.object({
  origin: z.string().min(2),
  destination: z.string().min(2),
  ratePerTon: z.number().min(1),
  minGuaranteeTons: z.number().default(0),
  validTill: z.string().transform((v) => new Date(v)),
});

businessRouter.post(
  '/clients/:id/rate-contracts',
  authenticate,
  requireRole('ADMIN', 'MANAGER', 'DEV'),
  validate(RateContractSchema),
  asyncH(async (req, res) => {
    const client = await Client.findById(req.params.id);
    if (!client) throw new HttpError(404, 'Client not found');

    const status = req.auth!.role === 'STAFF' ? 'PENDING' : 'APPROVED';
    client.rateContracts.push({
      ...req.body,
      status,
      approvedBy: status === 'APPROVED' ? req.auth!.sub : undefined,
    });

    await client.save();
    res.json(client);
  }),
);

// VENDORS (Brokers, Pumps, Workshops)
businessRouter.get(
  '/vendors',
  authenticate,
  requireRole('ADMIN', 'MANAGER', 'STAFF', 'DEV'),
  asyncH(async (req, res) => {
    const { type } = req.query;
    const query = type ? { type } : {};
    const vendors = await Vendor.find(query).sort({ name: 1 }).lean();
    res.json(vendors);
  }),
);

const CreateVendorSchema = z.object({
  code: z.string().min(2).toUpperCase(),
  type: z.enum(['BROKER', 'PETROL_PUMP', 'WORKSHOP', 'TYRE_DEALER', 'SPARE_PARTS']),
  name: z.string().min(2),
  pan: z.string().regex(/^[A-Z]{5}\d{4}[A-Z]$/).optional(),
  gstin: z.string().optional(),
  city: z.string().optional(),
  highway: z.string().optional(),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  tdsSection: z.string().default('194C'),
  tdsRate: z.number().default(0.01),
  tdsExemptDeclaration: z.boolean().default(false),
  creditLimit: z.number().default(0),
  fuelRatePerLiter: z.number().optional(),
});

businessRouter.post(
  '/vendors',
  authenticate,
  requireRole('ADMIN', 'MANAGER', 'DEV'),
  validate(CreateVendorSchema),
  asyncH(async (req, res) => {
    const vendor = await Vendor.create(req.body);
    res.status(201).json(vendor);
  }),
);

// Pay Vendor (Pump / Workshop / Broker)
businessRouter.post(
  '/vendors/:id/pay',
  authenticate,
  requireRole('ADMIN', 'MANAGER', 'DEV'),
  validate(z.object({ amount: z.number().min(1) })),
  asyncH(async (req, res) => {
    const actor: Actor = { id: req.auth!.sub, role: req.auth!.role };
    const vendor = await payVendor(req.params.id, req.body.amount, actor);
    res.json({ ok: true, vendor });
  }),
);

// Own Fleet vs Market Truck Margin Comparison
businessRouter.get(
  '/fleet-vs-market-margin',
  authenticate,
  requireRole('ADMIN', 'MANAGER', 'DEV'),
  asyncH(async (_req, res) => {
    const trips = await Trip.find({
      status: { $in: ['UNLOADED', 'POD_UPLOADED', 'SETTLED'] },
    })
      .select('fleetType corridor economics distanceKm market grossFreight')
      .lean();

    const ownTrips = trips.filter((t) => t.fleetType === 'OWN');
    const marketTrips = trips.filter((t) => t.fleetType === 'MARKET');

    const ownRevenue = ownTrips.reduce((s, t) => s + (t.economics?.revenue ?? 0), 0);
    const ownProfit = ownTrips.reduce((s, t) => s + (t.economics?.netProfit ?? 0), 0);
    const ownKm = ownTrips.reduce((s, t) => s + t.distanceKm, 0);

    const marketRevenue = marketTrips.reduce((s, t) => s + (t.economics?.revenue ?? 0), 0);
    const marketProfit = marketTrips.reduce((s, t) => s + (t.economics?.netProfit ?? 0), 0);
    const marketKm = marketTrips.reduce((s, t) => s + t.distanceKm, 0);

    res.json({
      ownFleet: {
        totalTrips: ownTrips.length,
        revenue: ownRevenue,
        netProfit: ownProfit,
        marginPct: ownRevenue ? +(ownProfit / ownRevenue * 100).toFixed(2) : 0,
        profitPerKm: ownKm ? +(ownProfit / ownKm).toFixed(2) : 0,
      },
      marketTrucks: {
        totalTrips: marketTrips.length,
        revenue: marketRevenue,
        netProfit: marketProfit,
        marginPct: marketRevenue ? +(marketProfit / marketRevenue * 100).toFixed(2) : 0,
        profitPerKm: marketKm ? +(marketProfit / marketKm).toFixed(2) : 0,
      },
    });
  }),
);

// GST & GTA Tax Vault
businessRouter.get(
  '/gst-vault',
  authenticate,
  requireRole('ADMIN', 'DEV'),
  asyncH(async (_req, res) => {
    const trips = await Trip.find({
      'invoice.status': { $in: ['BILLED', 'PARTIAL', 'PAID'] },
    })
      .select('lrNumber invoice client corridor')
      .populate('client', 'name gstin gstMode')
      .sort({ 'invoice.date': -1 })
      .lean();

    const fcmTrips = trips.filter((t) => t.invoice?.gstMode === 'FCM_12');
    const rcmTrips = trips.filter((t) => t.invoice?.gstMode === 'RCM_5');

    const fcmTaxable = fcmTrips.reduce((s, t) => s + (t.invoice?.taxableValue ?? 0), 0);
    const fcmGstCollected = fcmTrips.reduce((s, t) => s + (t.invoice?.gstAmount ?? 0), 0);

    const rcmTaxable = rcmTrips.reduce((s, t) => s + (t.invoice?.taxableValue ?? 0), 0);
    const rcmRecipientTax = rcmTaxable * 0.05;

    res.json({
      summary: {
        fcmTaxable: Math.round(fcmTaxable),
        fcmGstOutput: Math.round(fcmGstCollected),
        rcmTaxable: Math.round(rcmTaxable),
        rcmRecipientLiability: Math.round(rcmRecipientTax),
        totalInvoices: trips.length,
      },
      invoices: trips.slice(0, 50),
    });
  }),
);
