import { Router } from 'express';
import { Truck, Trip, Client, Employee } from '../models/index.js';
import { authenticate, asyncH } from '../middleware/index.js';

export const searchRouter = Router();

searchRouter.get(
  '/',
  authenticate,
  asyncH(async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q || q.length < 2) {
      return res.json({ trucks: [], trips: [], clients: [], drivers: [] });
    }

    const reg = new RegExp(q, 'i');

    const [trucks, trips, clients, drivers] = await Promise.all([
      Truck.find({
        $or: [{ regNumber: reg }, { make: reg }, { model: reg }],
      })
        .select('regNumber make model status capacityTons axleConfig currentOdometer')
        .limit(8)
        .lean(),

      Trip.find({
        $or: [{ lrNumber: reg }, { corridor: reg }, { material: reg }, { ewayBillNo: reg }],
      })
        .select('lrNumber corridor status indentDate material weightTons')
        .limit(8)
        .lean(),

      Client.find({
        $or: [{ name: reg }, { code: reg }, { city: reg }, { gstin: reg }],
      })
        .select('name code city creditLimit currentOutstanding')
        .limit(8)
        .lean(),

      Employee.find({
        $or: [{ name: reg }, { phone: reg }, { code: reg }],
        designation: 'DRIVER',
      })
        .select('name code phone designation')
        .limit(8)
        .lean(),
    ]);

    res.json({
      trucks: trucks.map((t) => ({ ...t, type: 'TRUCK' })),
      trips: trips.map((t) => ({ ...t, type: 'TRIP' })),
      clients: clients.map((c) => ({ ...c, type: 'CLIENT' })),
      drivers: drivers.map((d) => ({ ...d, type: 'DRIVER' })),
    });
  }),
);
