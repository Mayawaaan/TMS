import mongoose from 'mongoose';
import { connectDB, withTransaction } from '../config/db.js';
import { env } from '../config/env.js';
import {
  User,
  Employee,
  Truck,
  Tyre,
  Client,
  Vendor,
  Trip,
  FuelSlip,
  Maintenance,
  LedgerEntry,
  Counter,
  Advance,
  Attendance,
  Payslip,
  AuditLog,
  FeatureFlag,
  AiAlert,
  Setting,
  COMPLIANCE_DOCS,
  TYRE_POSITIONS,
  computeEconomics,
  type TripDoc,
  type TripState,
} from '../models/index.js';
import { hashSecret, hashPin } from '../security/cryptoGuard.js';
import { postJournal } from '../services/ledger.service.js';
import { trialBalance } from '../services/analytics.service.js';
import { DEFAULT_FLAGS } from '../services/flags.service.js';
import { seedDevUser } from './seedDevUser.js';
import {
  SEED_TRUCKS,
  SEED_DRIVERS,
  SEED_CLIENTS,
  SEED_VENDORS,
  CORRIDORS,
} from './data.js';

const DAY_MS = 86400000;
const daysAgo = (d: number) => new Date(Date.now() - d * DAY_MS);
const daysFromNow = (d: number) => new Date(Date.now() + d * DAY_MS);

export async function runSeed() {
  console.log('[seed] ============================================================');
  console.log('[seed] STARTING OBSIDIAN FLEET COMMAND DATABASE SEEDER');
  console.log('[seed] Target MongoDB URI:', env.MONGO_URI);
  console.log('[seed] ============================================================');

  await connectDB();

  // 1. CLEAR COLLECTIONS
  console.log('[seed] 1. Purging existing collections...');
  const db = mongoose.connection.db!;
  const cols = await db.listCollections().toArray();
  for (const c of cols) {
    if (!c.name.startsWith('system.')) {
      await db.collection(c.name).deleteMany({});
    }
  }

  // 2. SEED SETTINGS & FEATURE FLAGS
  console.log('[seed] 2. Seeding Feature Flags & Settings...');
  await Setting.create({ key: 'dieselPrice', value: 90.5 });
  for (const flag of DEFAULT_FLAGS) {
    await FeatureFlag.create(flag);
  }

  // 3. SEED DEV USER
  console.log('[seed] 3. Provisioning Hidden DEV account...');
  await seedDevUser();
  const devUser = await User.findOne({ role: 'DEV' }).select('+isHiddenDev');

  // 4. SEED DRIVERS & EMPLOYEES
  console.log('[seed] 4. Seeding 15 Fleet Drivers & Employees...');
  const driverDocs = await Employee.insertMany(
    SEED_DRIVERS.map((d) => ({
      ...d,
      designation: 'DRIVER' as const,
      licenseNo: `MP-09-${d.code}-LIC`,
      licenseExpiry: daysFromNow(450),
      aadhaarLast4: String(Math.floor(1000 + Math.random() * 9000)),
      bankAccountLast4: String(Math.floor(1000 + Math.random() * 9000)),
    })),
  );

  // 5. SEED ROLE USERS
  console.log('[seed] 5. Seeding Role Users (ADMIN, MANAGER, STAFF, DRIVER)...');
  const defaultPass = await hashSecret(env.SEED_DEFAULT_PASSWORD);
  const finPin = await hashPin(env.SEED_FINANCIAL_PIN);

  const [adminUser, managerUser, staffUser, driverUser] = await User.insertMany([
    {
      name: 'Vikramaditya Singhania (Owner & MD)',
      email: 'admin@obsidianfleet.com',
      phone: '+91 98260 99001',
      role: 'ADMIN',
      password: defaultPass,
      financialPin: finPin,
      active: true,
    },
    {
      name: 'Harishankar Sharma (Operations VP)',
      email: 'manager@obsidianfleet.com',
      phone: '+91 98260 99002',
      role: 'MANAGER',
      password: defaultPass,
      financialPin: finPin,
      active: true,
    },
    {
      name: 'Amitabh Joshi (Lead Dispatcher)',
      email: 'dispatch@obsidianfleet.com',
      phone: '+91 98260 99003',
      role: 'STAFF',
      password: defaultPass,
      active: true,
    },
    {
      name: 'Ramesh Singh Chouhan (Senior Captain)',
      email: 'driver.ramesh@obsidianfleet.com',
      phone: driverDocs[0].phone,
      role: 'DRIVER',
      password: defaultPass,
      employee: driverDocs[0]._id,
      active: true,
    },
  ]);

  // 6. SEED VENDORS (Pumps, Workshops, Brokers)
  console.log('[seed] 6. Seeding Vendors (Highway Petrol Pumps, Workshops, Freight Brokers)...');
  const vendorDocs = await Vendor.insertMany(SEED_VENDORS);
  const pumpHpcl = vendorDocs.find((v) => v.code === 'PUMP-HPCL-INDORE')!;
  const pumpIocl = vendorDocs.find((v) => v.code === 'PUMP-IOCL-DHULE')!;
  const wsTata = vendorDocs.find((v) => v.code === 'WS-TATA-INDORE')!;
  const brokerMalwa = vendorDocs.find((v) => v.code === 'BRK-MALWA')!;

  // 7. SEED CLIENTS & RATE CONTRACTS
  console.log('[seed] 7. Seeding 10 B2B Corporate Clients with Rate Contracts...');
  const clientDocs = [];
  for (const c of SEED_CLIENTS) {
    const contracts = CORRIDORS.slice(0, 4).map((corr) => ({
      origin: corr.origin,
      destination: corr.destination,
      ratePerTon: corr.baseRatePerTon,
      minGuaranteeTons: 20,
      validFrom: daysAgo(180),
      validTill: daysFromNow(180),
      status: 'APPROVED' as const,
      approvedBy: adminUser._id,
    }));

    const client = await Client.create({
      ...c,
      rateContracts: contracts,
    });
    clientDocs.push(client);
  }

  // 8. SEED TRUCKS & TYRE BLUEPRINTS
  console.log('[seed] 8. Seeding 15 Trucks & Interactive Tyre Blueprints...');
  const truckDocs: InstanceType<typeof Truck>[] = [];
  const tyreDocs: InstanceType<typeof Tyre>[] = [];

  for (let i = 0; i < SEED_TRUCKS.length; i++) {
    const st = SEED_TRUCKS[i];
    const assignedDriver = driverDocs[i % driverDocs.length];

    const truck = await Truck.create({
      ...st,
      assignedDriver: assignedDriver._id,
      compliance: {
        insurance: { number: `INS-${st.regNumber}`, issuer: 'New India Assurance', expiry: daysFromNow(st.complianceDays.insurance), premium: 48500 },
        fitness: { number: `FIT-${st.regNumber}`, issuer: 'RTO Indore', expiry: daysFromNow(st.complianceDays.fitness) },
        nationalPermit: { number: `NP-${st.regNumber}`, issuer: 'MoRTH National Portal', expiry: daysFromNow(st.complianceDays.nationalPermit) },
        puc: { number: `PUC-${st.regNumber}`, issuer: 'MP Pollution Control', expiry: daysFromNow(st.complianceDays.puc) },
        stateTax: { number: `TAX-${st.regNumber}`, issuer: 'Commercial Tax Dept MP', expiry: daysFromNow(st.complianceDays.stateTax) },
      },
      lastServiceOdometer: Math.max(0, st.currentOdometer - 12000),
      componentService: {
        BRAKE_PAD: Math.max(0, st.currentOdometer - st.componentKm.BRAKE_PAD),
        CLUTCH_PLATE: Math.max(0, st.currentOdometer - st.componentKm.CLUTCH_PLATE),
        ENGINE_OIL: Math.max(0, st.currentOdometer - st.componentKm.ENGINE_OIL),
        TYRE: Math.max(0, st.currentOdometer - st.componentKm.TYRE),
      },
    });
    truckDocs.push(truck);

    // Link assigned truck back to driver
    assignedDriver.assignedTruck = truck._id;
    await assignedDriver.save();

    // Generate Tyres for this truck according to axle configuration
    const positions: (typeof TYRE_POSITIONS)[number][] =
      st.axleConfig === '6W'
        ? ['FL', 'FR', 'RLO', 'RLI', 'RRO', 'RRI', 'STEPNEY']
        : st.axleConfig === '10W'
        ? ['FL', 'FR', 'RLO', 'RLI', 'RRO', 'RRI', 'TLO', 'TLI', 'TRO', 'TRI', 'STEPNEY']
        : ['FL', 'FR', 'RLO', 'RLI', 'RRO', 'RRI', 'TLO', 'TLI', 'TRO', 'TRI', 'STEPNEY'];

    for (let pIdx = 0; pIdx < positions.length; pIdx++) {
      const pos = positions[pIdx];
      const brands = ['MRF Super Lug-78', 'Apollo EnduTrax', 'JK Tyre Jet R Miles', 'CEAT Winload XL', 'Bridgestone M851'];
      const brand = brands[(i + pIdx) % brands.length];
      const brandPrefix = brand.split(' ')[0].toUpperCase();
      const serialNo = `${brandPrefix}-STL-23${String(i + 1).padStart(2, '0')}-${String(pIdx + 1).padStart(4, '0')}`;
      const tread = Math.max(4, +(16 - (st.componentKm.TYRE / 6000)).toFixed(1));

      const tyre = await Tyre.create({
        serialNo,
        brand,
        size: '295/80 R22.5',
        purchaseCost: 23500,
        purchaseDate: daysAgo(240),
        originalTreadMm: 16,
        treadDepthMm: tread,
        retreadCount: tread < 7 ? 1 : 0,
        status: 'FITTED',
        currentTruck: truck._id,
        currentPosition: pos,
        fittedOdometer: Math.max(0, st.currentOdometer - st.componentKm.TYRE),
        totalKmRun: st.componentKm.TYRE,
      });
      tyreDocs.push(tyre);
    }
  }

  // 9. OPENING DOUBLE-ENTRY BALANCES (Capital, Bank, Initial Fleet Equity)
  console.log('[seed] 9. Posting Double-Entry Ledger opening balances (Capital & Fleet Asset)...');
  await withTransaction(async (session) => {
    // 1. Initial Owner Capital Injection
    await postJournal(
      [
        { account: 'BANK', debit: 6500000 },
        { account: 'CASH', debit: 500000 },
        { account: 'OWNER_EQUITY', credit: 7000000 },
      ],
      {
        date: daysAgo(120),
        narration: 'Initial Owner Capital Injection — Obsidian Fleet Logistics',
        refType: 'CAPITAL',
        party: { kind: 'OWNER', name: 'Vikramaditya Singhania' },
        postedBy: adminUser._id,
      },
      session,
    );

    // 2. Fixed Overheads across the 4 months (EMIs, Insurance, Maintenance)
    for (const truck of truckDocs) {
      if (truck.emiAmount && truck.emiAmount > 0) {
        // Book 3 monthly EMIs for each financed truck
        for (let m = 3; m >= 1; m--) {
          const interest = Math.round(truck.emiAmount * 0.32);
          const principal = truck.emiAmount - interest;
          await postJournal(
            [
              { account: 'EMI_INTEREST_EXPENSE', debit: interest },
              { account: 'LOAN_PAYABLE', debit: principal },
              { account: 'BANK', credit: truck.emiAmount },
            ],
            {
              date: daysAgo(m * 30 + 5),
              narration: `EMI Auto-Debit: ${truck.emiLender} (${truck.regNumber})`,
              refType: 'EMI',
              refId: truck._id,
              party: { kind: 'LENDER', name: truck.emiLender ?? undefined },
              truck: truck._id,
              postedBy: adminUser._id,
            },
            session,
          );
        }
      }
    }
  });

  // 10. SEED 80 REALISTIC TRIPS WITH FULL ECONOMICS & LEDGER POSTINGS
  console.log('[seed] 10. Generating 80 realistic trips across Indian Corridors with ACID Ledger...');

  const injectedTheftIndices = new Set([14, 38, 62]); // 3 deliberate fuel theft trips
  const tripDocs: TripDoc[] = [];

  for (let idx = 0; idx < 80; idx++) {
    const corridor = CORRIDORS[idx % CORRIDORS.length];
    const client = clientDocs[idx % clientDocs.length];
    const isMarket = idx % 8 === 7; // 10 market truck trips
    const truck = isMarket ? null : truckDocs[idx % truckDocs.length];
    const driver = isMarket ? null : driverDocs[idx % driverDocs.length];
    const daysOffset = Math.floor(118 - idx * 1.4);
    const indentDate = daysAgo(Math.max(1, daysOffset));

    // Determine lifecycle status
    let status: TripState = 'SETTLED';
    if (idx === 79) status = 'ASSIGNED';
    else if (idx === 78) status = 'LOADED';
    else if (idx === 77 || idx === 76) status = 'IN_TRANSIT';
    else if (idx >= 70) status = 'UNLOADED';
    else if (idx >= 62) status = 'POD_UPLOADED';

    const weightTons = corridor.typicalTonnage + ((idx * 3) % 5) - 2;
    const ratePerTon = corridor.baseRatePerTon;
    const grossFreight = Math.round(weightTons * ratePerTon);
    const halting = idx % 5 === 0 ? 3000 : 0;
    const distanceKm = corridor.distanceKm;

    // Fuel calculation
    const baseKmpl = truck ? truck.baselineKmpl : 3.5;
    const isTheft = !isMarket && injectedTheftIndices.has(idx);
    // On theft trips, actual mileage plummets by 32%
    const actualKmpl = isTheft ? +(baseKmpl * 0.67).toFixed(2) : +(baseKmpl * (0.95 + (idx % 7) * 0.02)).toFixed(2);
    const dieselLiters = Math.round((distanceKm / actualKmpl) * 10) / 10;
    const dieselRate = 91.0;
    const dieselCost = Math.round(dieselLiters * dieselRate);

    // Other trip costs
    const tollCost = isMarket ? 0 : Math.round(corridor.tollAvg * (1 + (idx % 3) * 0.05));
    const tripDays = Math.ceil(distanceKm / 420);
    const bhattaCost = isMarket ? 0 : tripDays * (driver?.bhattaPerDay || 400);
    const rtoBorder = isMarket ? 0 : 500 + ((idx * 150) % 600);
    const hamali = 800 + ((idx * 100) % 400);

    // Odometer
    const startOdo = truck ? truck.currentOdometer - (80 - idx) * distanceKm : 100000;
    const endOdo = startOdo + distanceKm;

    // Lorry hire for market trucks
    const lorryHire = isMarket ? Math.round(grossFreight * 0.85) : 0;

    await withTransaction(async (session) => {
      const lrYear = indentDate.getFullYear();
      const lrNumber = `LR/${lrYear}/${String(idx + 1001).padStart(5, '0')}`;

      const trip = new Trip({
        lrNumber,
        client: client._id,
        consignor: { name: client.name, city: client.city, gstin: client.gstin },
        consignee: { name: `${client.name} Receiving Warehouse`, city: corridor.destination, phone: '+91 94250 11999' },
        origin: corridor.origin,
        destination: corridor.destination,
        corridor: corridor.corridor,
        distanceKm,
        routeGradientFactor: corridor.gradientFactor,
        material: corridor.typicalMaterial,
        packages: Math.floor(weightTons * 35),
        weightTons,
        ratePerTon,
        grossFreight,
        haltingCharges: halting,
        ewayBillNo: `EWB-23-${String(100000000000 + idx)}`,
        fleetType: isMarket ? 'MARKET' : 'OWN',
        truck: truck?._id,
        driver: driver?._id,
        status,
        indentDate,
        loadedAt: daysAgo(Math.max(1, daysOffset - 1)),
        dispatchedAt: daysAgo(Math.max(1, daysOffset - 1)),
        unloadedAt: status !== 'ASSIGNED' && status !== 'LOADED' && status !== 'IN_TRANSIT' ? daysAgo(Math.max(1, daysOffset - tripDays)) : undefined,
        podUploadedAt: ['POD_UPLOADED', 'SETTLED'].includes(status) ? daysAgo(Math.max(1, daysOffset - tripDays - 1)) : undefined,
        settledAt: status === 'SETTLED' ? daysAgo(Math.max(0, daysOffset - tripDays - 4)) : undefined,
        startOdometer: startOdo,
        endOdometer: endOdo,
        expenses: {
          dieselLiters,
          dieselAmount: dieselCost,
          toll: tollCost,
          bhatta: bhattaCost,
          rtoBorder,
          loadingUnloading: hamali,
        },
        tollLogs: corridor.plazas.slice(0, 4).map((plz, pIdx) => ({
          plaza: plz,
          amount: Math.round(tollCost / 4),
          at: daysAgo(Math.max(1, daysOffset - 1)),
          txnId: `FT-${idx}-${pIdx}`,
          vehicleClass: 'VC4',
        })),
        documents: [
          {
            kind: 'POD',
            url: `/uploads/pod-${lrNumber.replace(/\//g, '-')}.png`,
            originalName: `Consignee_Signed_POD_${idx + 1}.png`,
            uploadedAt: daysAgo(Math.max(1, daysOffset - tripDays)),
          },
        ],
        pod: {
          verified: ['POD_UPLOADED', 'SETTLED'].includes(status),
          verifiedBy: managerUser._id,
          verifiedAt: daysAgo(Math.max(1, daysOffset - tripDays - 1)),
          remarks: 'Received in good condition with clean consignee stamp.',
        },
        market: isMarket
          ? {
              broker: brokerMalwa._id,
              regNumber: `NL-01-K-${3300 + idx}`,
              driverName: 'Sardar Baldev Singh',
              driverPhone: '+91 98110 55441',
              lorryHire,
              advancePaid: Math.round(lorryHire * 0.7),
              tdsRate: 0.01,
              tdsAmount: Math.round(lorryHire * 0.01),
              balancePayable: Math.round(lorryHire * 0.29),
              settled: status === 'SETTLED',
            }
          : undefined,
        freightApproval: {
          status: 'APPROVED',
          by: managerUser._id,
          at: indentDate,
        },
        settlement: {
          status: status === 'SETTLED' ? 'APPROVED' : 'PENDING',
          bhattaDays: tripDays,
          approvedBy: managerUser._id,
          approvedAt: daysAgo(Math.max(0, daysOffset - tripDays - 3)),
        },
        entryState: status === 'SETTLED' ? 'LOCKED' : 'SUBMITTED',
        createdBy: staffUser._id,
      });

      // Compute and attach AI audit attributes
      if (isTheft) {
        trip.aiAudit = {
          anomalyScore: -0.68,
          expectedKmpl: baseKmpl,
          actualKmpl,
          isFlaggedForTheft: true,
          suspectedLitersSiphoned: Math.round(dieselLiters - (distanceKm / baseKmpl)),
          auditedAt: new Date(),
          modelVersion: 'v1.4.0-IsolationForest',
        };
      }

      // Compute Economics
      trip.economics = computeEconomics(trip as never);

      // Invoice Setup
      const taxable = grossFreight + halting;
      const isFcm = client.gstMode === 'FCM_12';
      const gstAmount = isFcm ? Math.round(taxable * 0.12) : 0;
      const invoiceTotal = taxable + gstAmount;

      const isDelivered = ['UNLOADED', 'POD_UPLOADED', 'SETTLED'].includes(status);
      const isPaid = status === 'SETTLED' && client.code !== 'CLI-ITC';

      if (isDelivered) {
        trip.invoice = {
          number: `GTA/2026/${String(idx + 101).padStart(5, '0')}`,
          date: daysAgo(Math.max(1, daysOffset - tripDays)),
          dueDate: daysAgo(Math.max(0, daysOffset - tripDays - client.paymentTermsDays)),
          sac: '996511',
          gstMode: client.gstMode,
          gstRate: isFcm ? 0.12 : 0.05,
          taxableValue: taxable,
          gstAmount,
          total: invoiceTotal,
          paidAmount: isPaid ? invoiceTotal : (idx % 3 === 0 && client.code !== 'CLI-ITC') ? Math.round(invoiceTotal * 0.5) : 0,
          status: isPaid ? 'PAID' : (idx % 3 === 0 && client.code !== 'CLI-ITC') ? 'PARTIAL' : 'BILLED',
          paidAt: isPaid ? daysAgo(Math.max(0, daysOffset - tripDays - 20)) : undefined,
        };

        // Post Invoicing Journal
        await postJournal(
          [
            { account: 'ACCOUNTS_RECEIVABLE', debit: invoiceTotal },
            { account: 'FREIGHT_REVENUE', credit: grossFreight },
            ...(halting ? [{ account: 'DETENTION_REVENUE' as const, credit: halting }] : []),
            ...(gstAmount ? [{ account: 'GST_OUTPUT' as const, credit: gstAmount }] : []),
          ],
          {
            date: trip.invoice.date!,
            narration: `GTA Invoice ${trip.invoice.number} (${client.name} — ${trip.lrNumber})`,
            refType: 'TRIP',
            refId: trip._id,
            party: { kind: 'CLIENT', id: client._id, name: client.name },
            truck: truck?._id,
            postedBy: managerUser._id,
          },
          session,
        );

        // Update Client outstanding
        const unpaid = invoiceTotal - (trip.invoice.paidAmount || 0);
        client.currentOutstanding += unpaid;
        await client.save({ session });

        // If paid, post Bank Receipt Journal
        if (trip.invoice.paidAmount && trip.invoice.paidAmount > 0) {
          await postJournal(
            [
              { account: 'BANK', debit: trip.invoice.paidAmount },
              { account: 'ACCOUNTS_RECEIVABLE', credit: trip.invoice.paidAmount },
            ],
            {
              date: trip.invoice.paidAt || new Date(),
              narration: `Payment received from ${client.name} for ${trip.invoice.number}`,
              refType: 'PAYMENT',
              refId: trip._id,
              party: { kind: 'CLIENT', id: client._id, name: client.name },
              postedBy: adminUser._id,
            },
            session,
          );
        }

        // Post Trip Direct Expenses Journals
        if (!isMarket) {
          // 1. Diesel
          await postJournal(
            [
              { account: 'DIESEL_EXPENSE', debit: dieselCost },
              { account: 'PUMP_PAYABLE', credit: dieselCost },
            ],
            {
              date: trip.loadedAt!,
              narration: `Diesel ${dieselLiters}L @ ₹${dieselRate} — ${truck!.regNumber} (${trip.lrNumber})`,
              refType: 'FUEL_SLIP',
              refId: trip._id,
              party: { kind: 'VENDOR', id: pumpHpcl._id, name: pumpHpcl.name },
              truck: truck!._id,
              postedBy: staffUser._id,
            },
            session,
          );
          pumpHpcl.currentOutstanding += dieselCost;
          await pumpHpcl.save({ session });

          // Also record Fuel Slip document
          await FuelSlip.create(
            [
              {
                slipNo: `FS/2026/${String(idx + 101).padStart(6, '0')}`,
                trip: trip._id,
                truck: truck!._id,
                driver: driver!._id,
                pump: pumpHpcl._id,
                liters: dieselLiters,
                ratePerLiter: dieselRate,
                amount: dieselCost,
                odometer: startOdo,
                location: 'Indore Bypass',
                filledAt: trip.loadedAt!,
                paymentMode: 'PUMP_CREDIT',
                state: 'APPROVED',
                enteredBy: staffUser._id,
              },
            ],
            { session },
          );

          // 2. FASTag Toll
          if (tollCost > 0) {
            await postJournal(
              [
                { account: 'TOLL_EXPENSE', debit: tollCost },
                { account: 'BANK', credit: tollCost },
              ],
              {
                date: trip.loadedAt!,
                narration: `FASTag Toll Plazas (${corridor.corridor}) — ${trip.lrNumber}`,
                refType: 'TRIP',
                refId: trip._id,
                truck: truck!._id,
                postedBy: staffUser._id,
              },
              session,
            );
          }

          // 3. Driver Bhatta
          if (bhattaCost > 0 && status === 'SETTLED') {
            await postJournal(
              [
                { account: 'DRIVER_BHATTA_EXPENSE', debit: bhattaCost },
                { account: 'SALARY_PAYABLE', credit: bhattaCost },
              ],
              {
                date: trip.settledAt!,
                narration: `Driver Bhatta settlement (${tripDays} days) — ${driver!.name}`,
                refType: 'TRIP',
                refId: trip._id,
                party: { kind: 'EMPLOYEE', id: driver!._id, name: driver!.name },
                truck: truck!._id,
                postedBy: managerUser._id,
              },
              session,
            );
          }
        } else {
          // Market Truck Lorry Hire Journal
          const tds = trip.market!.tdsAmount!;
          const payable = lorryHire - tds;
          await postJournal(
            [
              { account: 'LORRY_HIRE_EXPENSE', debit: lorryHire },
              { account: 'BROKER_PAYABLE', credit: payable },
              { account: 'TDS_PAYABLE', credit: tds },
            ],
            {
              date: trip.loadedAt!,
              narration: `Market Lorry Hire ${trip.market!.regNumber} via ${brokerMalwa.name} (${trip.lrNumber})`,
              refType: 'LORRY_HIRE',
              refId: trip._id,
              party: { kind: 'VENDOR', id: brokerMalwa._id, name: brokerMalwa.name },
              postedBy: staffUser._id,
            },
            session,
          );
        }
      }

      await trip.save({ session });
      tripDocs.push(trip);
    });
  }

  // 11. INJECT MAINTENANCE WORKSHOP JOBS & BILLS
  console.log('[seed] 11. Seeding Scheduled & Breakdown Workshop Maintenance Jobs...');
  await withTransaction(async (session) => {
    // 1. MP-09-GH-8823 Brake Lining Overhaul Job (Breakdown Alert)
    const tLemon1 = truckDocs.find((t) => t.regNumber === 'MP-09-GH-8823')!;
    await Maintenance.create(
      [
        {
          jobNo: 'WS/2026/00101',
          truck: tLemon1._id,
          type: 'BREAKDOWN',
          component: 'BRAKE_PAD',
          workshop: wsTata._id,
          location: 'Dewas Naka',
          odometer: 198420,
          kmSinceLastService: 92400,
          description: 'Emergency roadside brake liner fracture & drum scoring replacement',
          parts: [
            { name: 'Heavy Duty Brake Lining Set', partNo: 'TAT-BRK-4825', qty: 4, unitCost: 3800 },
            { name: 'Brake Drum Rear', partNo: 'TAT-DRM-2823', qty: 2, unitCost: 8500 },
          ],
          labourCost: 4500,
          partsCost: 32200,
          totalCost: 36700,
          downtimeHours: 36,
          date: daysAgo(8),
          status: 'APPROVED',
          raisedBy: staffUser._id,
          approvedBy: managerUser._id,
          approvedAt: daysAgo(7),
        },
      ],
      { session },
    );
    await postJournal(
      [
        { account: 'MAINTENANCE_EXPENSE', debit: 36700 },
        { account: 'WORKSHOP_PAYABLE', credit: 36700 },
      ],
      {
        date: daysAgo(7),
        narration: `Emergency Breakdown Brake Liner Job — ${tLemon1.regNumber}`,
        refType: 'MAINTENANCE',
        party: { kind: 'VENDOR', id: wsTata._id, name: wsTata.name },
        truck: tLemon1._id,
        postedBy: managerUser._id,
      },
      session,
    );
    wsTata.currentOutstanding += 36700;
    await wsTata.save({ session });

    // 2. MP-09-GF-7711 Clutch Plate Slippage
    const tLemon2 = truckDocs.find((t) => t.regNumber === 'MP-09-GF-7711')!;
    await Maintenance.create(
      [
        {
          jobNo: 'WS/2026/00102',
          truck: tLemon2._id,
          type: 'BREAKDOWN',
          component: 'CLUTCH_PLATE',
          workshop: wsTata._id,
          location: 'Kasara Ghat',
          odometer: 246800,
          kmSinceLastService: 96500,
          description: 'Severe clutch plate burn out on Kasara Ghat incline',
          parts: [{ name: 'Clutch Disc & Pressure Plate Assy 430mm', partNo: 'CUM-CLT-430', qty: 1, unitCost: 26500 }],
          labourCost: 6500,
          partsCost: 26500,
          totalCost: 33000,
          downtimeHours: 48,
          date: daysAgo(15),
          status: 'APPROVED',
          raisedBy: staffUser._id,
          approvedBy: managerUser._id,
          approvedAt: daysAgo(14),
        },
      ],
      { session },
    );
    await postJournal(
      [
        { account: 'MAINTENANCE_EXPENSE', debit: 33000 },
        { account: 'WORKSHOP_PAYABLE', credit: 33000 },
      ],
      {
        date: daysAgo(14),
        narration: `Clutch Plate Replacement — ${tLemon2.regNumber}`,
        refType: 'MAINTENANCE',
        party: { kind: 'VENDOR', id: wsTata._id, name: wsTata.name },
        truck: tLemon2._id,
        postedBy: managerUser._id,
      },
      session,
    );
    wsTata.currentOutstanding += 33000;
    await wsTata.save({ session });

    // 3. Regular scheduled engine servicing on Star Truck MP-09-HH-4521
    const tStar = truckDocs.find((t) => t.regNumber === 'MP-09-HH-4521')!;
    await Maintenance.create(
      [
        {
          jobNo: 'WS/2026/00103',
          truck: tStar._id,
          type: 'SCHEDULED',
          component: 'ENGINE_OIL',
          workshop: wsTata._id,
          location: 'Indore',
          odometer: 130000,
          kmSinceLastService: 30000,
          description: 'Periodic 130,000 km Scheduled Service: 15W40 CI4+ lube oil & all filters',
          parts: [
            { name: 'Tata Motors Genuine 15W40 Engine Oil (Liters)', partNo: 'LUB-15W40', qty: 36, unitCost: 320 },
            { name: 'Fuel Filter Kit Spin-on', partNo: 'FLT-FF-01', qty: 2, unitCost: 1200 },
            { name: 'Lube Oil Filter Element', partNo: 'FLT-LF-02', qty: 1, unitCost: 1850 },
          ],
          labourCost: 2500,
          partsCost: 15770,
          totalCost: 18270,
          downtimeHours: 12,
          date: daysAgo(45),
          status: 'APPROVED',
          raisedBy: staffUser._id,
          approvedBy: managerUser._id,
          approvedAt: daysAgo(44),
        },
      ],
      { session },
    );
    await postJournal(
      [
        { account: 'MAINTENANCE_EXPENSE', debit: 18270 },
        { account: 'WORKSHOP_PAYABLE', credit: 18270 },
      ],
      {
        date: daysAgo(44),
        narration: `Periodic Scheduled Engine Service — ${tStar.regNumber}`,
        refType: 'MAINTENANCE',
        party: { kind: 'VENDOR', id: wsTata._id, name: wsTata.name },
        truck: tStar._id,
        postedBy: managerUser._id,
      },
      session,
    );
  });

  // 12. SEED DRIVER ATTENDANCE & ADVANCES
  console.log('[seed] 12. Seeding Daily Driver Attendance & Trip Cash Advances...');
  for (let d = 30; d >= 0; d--) {
    const dt = daysAgo(d).toISOString().slice(0, 10);
    for (const drv of driverDocs) {
      await Attendance.create({
        employee: drv._id,
        date: dt,
        status: (d + drv.name.length) % 11 === 0 ? 'LEAVE' : (d % 2 === 0 ? 'ON_TRIP' : 'PRESENT'),
        markedBy: staffUser._id,
      });
    }
  }

  // Advances
  for (let aIdx = 0; aIdx < 10; aIdx++) {
    const drv = driverDocs[aIdx % driverDocs.length];
    await Advance.create({
      employee: drv._id,
      amount: 4000,
      mode: 'CASH',
      purpose: 'Highway enroute expense emergency',
      date: daysAgo(10 + aIdx * 2),
      issuedBy: staffUser._id,
      recovered: false,
    });
    await withTransaction(async (session) => {
      await postJournal(
        [
          { account: 'DRIVER_ADVANCE', debit: 4000 },
          { account: 'CASH', credit: 4000 },
        ],
        {
          date: daysAgo(10 + aIdx * 2),
          narration: `Driver Cash Advance — ${drv.name}`,
          refType: 'ADVANCE',
          party: { kind: 'EMPLOYEE', id: drv._id, name: drv.name },
          postedBy: staffUser._id,
        },
        session,
      );
    });
  }

  // 13. OWNER DRAWINGS
  console.log('[seed] 13. Posting Owner Drawings (ADMIN equity withdrawal)...');
  await withTransaction(async (session) => {
    await postJournal(
      [
        { account: 'OWNER_EQUITY', debit: 350000 },
        { account: 'BANK', credit: 350000 },
      ],
      {
        date: daysAgo(20),
        narration: 'Owner Personal Profit Withdrawal — Q3',
        refType: 'DRAWINGS',
        party: { kind: 'OWNER', name: 'Vikramaditya Singhania' },
        postedBy: adminUser._id,
      },
      session,
    );
  });

  // 14. INJECT AI ALERTS FOR THE ANOMALIES
  console.log('[seed] 14. Injecting AI Anomaly Alerts (Fuel Theft & Predictive Maintenance)...');
  // Fuel theft alert for trip 14
  const trip14 = tripDocs[14];
  await AiAlert.create({
    type: 'FUEL_THEFT',
    severity: 'CRITICAL',
    title: `Suspected diesel pilferage — MP-09-GH-8823 (${trip14.lrNumber})`,
    detail: 'Actual 2.41 km/L vs expected 3.80 km/L. ~94 L unaccounted diesel siphoned or slip inflated.',
    truck: trip14.truck,
    trip: trip14._id,
    employee: trip14.driver,
    status: 'OPEN',
    dedupeKey: `FUEL:${trip14._id}`,
    modelVersion: 'v1.4.0-IsolationForest',
  });

  // Predictive maintenance alert for brake pads
  const truckLemon = truckDocs.find((t) => t.regNumber === 'MP-09-GH-8823')!;
  await AiAlert.create({
    type: 'MAINTENANCE_RISK',
    severity: 'CRITICAL',
    title: 'BRAKE PAD failure risk 96% — MP-09-GH-8823',
    detail: '92,400 km since last brake liner replacement. High breakdown recurrence risk on Kasara/Sendhwa ghats.',
    truck: truckLemon._id,
    status: 'OPEN',
    dedupeKey: `PM:${truckLemon._id}:BRAKE_PAD`,
    modelVersion: 'v1.2.0-WeibullSurvival',
  });

  // 15. VERIFY TRIAL BALANCE
  console.log('[seed] 15. Verifying Double-Entry Ledger Trial Balance...');
  const tb = await trialBalance();
  console.log(`[seed] Trial Balance: Total Debits = ₹${tb.totalDebit.toLocaleString('en-IN')}, Total Credits = ₹${tb.totalCredit.toLocaleString('en-IN')}`);
  console.log(`[seed] Trial Balance Status: ${tb.balanced ? '✓ BALANCED (Net Zero Difference)' : '❌ UNBALANCED!'}`);

  if (!tb.balanced) {
    throw new Error(`Double-entry trial balance is out of equilibrium: diff = ${tb.totalDebit - tb.totalCredit}`);
  }

  console.log('[seed] ============================================================');
  console.log('[seed] DATABASE SEEDED SUCCESSFULLY!');
  console.log(`[seed] - Trucks: ${truckDocs.length}`);
  console.log(`[seed] - Tyres Tracked: ${tyreDocs.length}`);
  console.log(`[seed] - Drivers: ${driverDocs.length}`);
  console.log(`[seed] - Corporate Clients: ${clientDocs.length}`);
  console.log(`[seed] - Vendors: ${vendorDocs.length}`);
  console.log(`[seed] - Trips (with P&L): ${tripDocs.length}`);
  console.log(`[seed] - Injected Anomalies: 5 (3 Fuel Theft + 2 Maintenance Lemon Trucks)`);
  console.log('[seed] ============================================================');
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  runSeed()
    .then(async () => {
      await mongoose.disconnect().catch(() => undefined);
      const repl = (globalThis as unknown as Record<string, { stop?: (opts: unknown) => Promise<void> }>).__tmsEmbeddedReplSet;
      if (repl?.stop) await repl.stop({ doCleanup: false, force: false }).catch(() => undefined);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[seed] Fatal error during seeding:', err);
      process.exit(1);
    });
}
