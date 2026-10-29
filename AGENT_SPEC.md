\# ROLE \& EXECUTION DIRECTIVE FOR ANTIGRAVITY AGENT

You are a Principal Full-Stack Systems Architect, Quantitative Logistics AI Engineer, and Lead Design Systems Engineer. Your objective is to plan, architect, code, test, and visually verify via browser automation a production-grade, enterprise \*\*Transport Management System (TMS) \& Fleet Business ERP\*\*.



\## STRICT ANTI-HALLUCINATION \& QUALITY GUARDRAILS

1\. \*\*NO PLACEHOLDERS OR TODOs:\*\* Never write `// TODO: implement logic` or return hardcoded mock arrays from API endpoints when a database query is required. Every route must connect to Mongoose models, Redis, or the Python FastAPI service.

2\. \*\*NO BASIC OR GENERIC UI:\*\* You are strictly forbidden from generating default white/blue Bootstrap-style CRUD tables or basic layouts. You must implement the \*\*"Obsidian Fleet Command" Design System\*\* specified below (Dark-mode-first `#090A0F` canvas, `1px solid rgba(255,255,255,0.07)` hairline borders, `JetBrains Mono` tabular numerals for all financials/odometers, bento-grid analytics, command palette `Cmd+K`, and high-density operational drawers).

3\. \*\*AUTONOMOUS VERIFICATION:\*\* Use your terminal and integrated browser after every milestone to run the servers, seed realistic Indian logistics data, inspect console/network logs for zero errors, and capture visual Screenshots Artifacts of all 5 role portals.



\---



\## 1. MONOREPO ARCHITECTURE \& TECH STACK

Initialize a Turborepo / Workspaces Monorepo with the following exact stack:



\- \*\*Frontend (`/apps/web-portals` or isolated workspace apps):\*\* React 18 (Vite + TypeScript), Tailwind CSS, \*\*Zustand\*\* (with persist \& immer middleware for isolated role stores), \*\*Apache ECharts / Recharts\*\* (financial waterfalls, unit economics scatter plots), \*\*Lucide React\*\* icons, \*\*Framer Motion\*\* (subtle micro-interactions), and \*\*TanStack Table v8\*\* (virtualized, keyboard-navigable high-density data grids).

\- \*\*Core Backend (`/apps/api-core`):\*\* Node.js, Express.js (TypeScript), \*\*MongoDB (Mongoose ODM)\*\* utilizing \*\*Multi-Document ACID Transactions\*\* for all financial ledger postings, \*\*Redis\*\* (`ioredis` for token blacklisting, metric caching, and \*\*BullMQ\*\* async queues), \*\*Zod\*\* (strict request validation).

\- \*\*Security \& Cryptography:\*\* \*\*Peppered Bcrypt / Argon2id Salting\*\* (HMAC-SHA256 pre-hash using a global server `GLOBAL\_SECRET\_PEPPER` + dynamic per-user salt), Dual JWT (`httpOnly` Refresh Cookie + short-lived Access Token), and Secondary 6-Digit Salted Financial PIN for `ADMIN` and `MANAGER` overrides.

\- \*\*AI \& Quantitative Engine (`/apps/ai-engine`):\*\* \*\*Python 3.11 + FastAPI\*\*, \*\*Motor\*\* (Async MongoDB driver), \*\*Scikit-Learn\*\* (Isolation Forest), \*\*XGBoost / LightGBM\*\*, \*\*Lifelines / Weibull Survival Analysis\*\*, and \*\*Google OR-Tools\*\*.

\- \*\*CI/CD \& DevOps:\*\* Complete `docker-compose.yml` (MongoDB Replica Set `rs0` for ACID transactions, Redis, Node API, Python FastAPI, Nginx Reverse Proxy) and a production declarative `Jenkinsfile`.



\---



\## 2. THE "OBSIDIAN FLEET COMMAND" UI/UX DESIGN SYSTEM (NON-NEGOTIABLE)

The UI must look like an institutional financial terminal (Linear / Bloomberg / Stripe Dashboard aesthetic) built for high-volume fleet executives:



1\. \*\*Color Palette \& Surface Hierarchy:\*\*

&#x20;  - Primary Canvas: `#090A0F` (Deep Carbon Obsidian)

&#x20;  - Elevated Card / Bento Surface: `#11131C` with subtle top highlight `border-t border-white/10` and `border border-white/\[0.06]`

&#x20;  - Glassmorphic Floating Bars / Modals: `bg-\[#161926]/85 backdrop-blur-xl`

&#x20;  - Semantic Accents:

&#x20;    - Primary Brand / Active Route: `#3B82F6` (Electric Cobalt)

&#x20;    - Net Profit / Positive Cashflow / Verified POD: `#10B981` (Emerald Mint)

&#x20;    - Halting Warning / Document Expiry < 15 Days: `#F59E0B` (Amber)

&#x20;    - Fuel Theft Flag / Overdue Credit Limit / Breakdown: `#EF4444` (Crimson Rose)

&#x20;    - Hidden `DEV` Mode Accent: `#A855F7` (Cyber Purple terminal borders)

2\. \*\*Typography \& Data Density:\*\*

&#x20;  - Headings \& UI: `Inter` or `Plus Jakarta Sans` (tight tracking).

&#x20;  - Financials, Odometer KM, Vehicle Reg Numbers (`MP-09-HH-4521`), Bilty Codes, and Metrics: \*\*`JetBrains Mono`\*\* with `font-variant-numeric: tabular-nums` so columns align to the exact decimal.

3\. \*\*Interactive UX Components:\*\*

&#x20;  - \*\*Global `Cmd + K` / `Ctrl + K` Command Palette:\*\* Instant search by Truck Number, Bilty/LR Number, Driver Name, or Client Party Ledger.

&#x20;  - \*\*Slide-Over Inspector Drawers:\*\* Clicking any Truck or Trip row opens a smooth right-hand 600px glass drawer showing the Trip Timeline, FASTag Toll logs, Fuel Slips, Tyre Serial Map, and Live P\&L breakdown without losing table scroll position.

&#x20;  - \*\*Interactive Axle \& Tyre Blueprint:\*\* A visual SVG top-down truck chassis diagram where hovering over each wheel position (`FL`, `FR`, `RLO`, `RLI`, `RRO`, `RRI`, `Stepney`) displays Tyre Serial Number, Brand, Tread Depth, and Cost-Per-KM.



\---



\## 3. STRICT 5-TIER ROLE-BASED ACCESS CONTROL (RBAC) \& ISOLATED UI VIEWS

Do not build a single generic dashboard. Build \*\*5 isolated UI experiences\*\* controlled by strict backend middleware and isolated Zustand stores:



1\. \*\*`DEV` (Hidden System Architect Portal - Route `/sys-internal-dev`):\*\*

&#x20;  - \*\*Security:\*\* Cannot be registered via public API. Seeded only via CLI with `isHiddenDev: true`. Protected by custom header/token check.

&#x20;  - \*\*UI Features:\*\* Live Redis Queue \& Token Blacklist Inspector, MongoDB Slow-Query Profiler, \*\*One-Click Role Impersonation Engine\*\* (generate temporary session to view exact UI of Admin, Manager, Staff, or Driver), AI Model Retraining Trigger, System Audit Trail, and Feature Flag Switchboard. Financial owner withdrawals are masked unless explicitly toggled for debugging.

2\. \*\*`ADMIN` (Business Owner Executive ERP \& Business Management Panel):\*\*

&#x20;  - \*\*UI Features:\*\* Complete access to \*\*Executive Metrics\*\*, \*\*Net Profit \& EBITDA\*\*, \*\*Double-Entry Cashflow Ledger\*\*, \*\*Business Management Panel\*\* (Corporate B2B Rate Contracts, Client Credit Limit Overrides via 6-digit Financial PIN, Market/Broker Truck Ledgers, Petrol Pump Credit Accounts, GST/RCM Tax Vault), \*\*Fleet Unit Economics Matrix\*\*, \*\*Salary \& Payroll Master\*\*, and \*\*AI Anomaly Alerts\*\*.

3\. \*\*`MANAGER` (2nd Highest Authority - Operations \& Approval Command):\*\*

&#x20;  - \*\*UI Features:\*\* Can view operational metrics, approve Freight Rates, verify PODs, approve Driver Trip Settlements \& Bhatta, authorize Workshop Maintenance Bills, and manage Market Truck hiring. \*\*Restriction:\*\* Cannot see Owner Net Withdrawals, Bank Master Balances, or alter Historical Ledger Entries.

4\. \*\*`STAFF` (High-Speed Operations \& Dispatch Console):\*\*

&#x20;  - \*\*UI Features:\*\* Keyboard-first (`Tab`/`Enter` optimized) \*\*Bilty / LR Generator\*\*, \*\*Truck Dispatch Assignment\*\*, \*\*Daily Driver Attendance\*\*, \*\*Fuel Slip Entry\*\*, and \*\*POD Document Upload\*\*.

&#x20;  - \*\*Restriction:\*\* \*\*Create / Draft Only\*\*. Once a Bilty or Expense Entry is submitted, `STAFF` cannot edit or delete it (requires `MANAGER` or `ADMIN` approval). Cannot view P\&L graphs or party profit margins.

5\. \*\*`DRIVER / LABOUR` (Strict Read-Only Mobile-First PWA View):\*\*

&#x20;  - \*\*UI Features:\*\* High-contrast mobile-responsive card layout. Strictly \*\*READ-ONLY\*\* access to: Assigned Truck details, Active Trip Route \& Consignee info, Diesel/Cash Advance issued, Personal Salary/Bhatta Passbook, and a single restricted action: \*\*Upload POD Photo / Toll Receipt\*\*. Zero edit permissions across the entire database.



\---



\## 4. CORE FUNCTIONAL MODULES \& MONGODB ACID SCHEMAS

Implement the following interconnected Mongoose models and Express controllers using MongoDB Sessions (`session.startTransaction()`) for all financial mutations:



1\. \*\*Business Management Panel (`/api/v1/business`):\*\*

&#x20;  - \*\*Corporate Clients \& Credit Engine:\*\* Tracks `creditLimit`, `currentOutstanding`, `paymentTermsDays` (e.g., 30/45 days), and `rateContracts` (Origin $\\rightarrow$ Destination fixed per-ton rates). Automatically block Bilty creation if `currentOutstanding > creditLimit` unless `ADMIN` supplies a valid `financialPin`.

&#x20;  - \*\*Vendor, Broker \& Market Trucks:\*\* Hire third-party trucks when own fleet is full. Track Broker PAN (TDS 194C compliance), Chalan/Lorry Hire settlement, and compare \*Own Fleet Margin vs. Market Truck Margin\*.

&#x20;  - \*\*Petrol Pump \& Workshop Credit Ledgers:\*\* Manage credit accounts with highway diesel stations and spare part vendors.

&#x20;  - \*\*GST \& GTA Compliance:\*\* Support 5% RCM (Reverse Charge) and 12% Forward Charge invoicing with HSN/SAC codes.

2\. \*\*Trucks, Tyres \& Preventive Maintenance (`/api/v1/fleet`):\*\*

&#x20;  - Vehicle master (`regNumber`, `chassisNo`, `axleConfig`, `emiAmount`, `currentOdometer`).

&#x20;  - \*\*Compliance Expiry Watchdog:\*\* Insurance, Fitness, National Permit, PUC, State Tax with automated 30/15/7-day warning badges.

&#x20;  - \*\*Tyre Serial Lifecycle:\*\* Track every tyre by serial number across axle positions to prevent highway tyre-swapping theft.

&#x20;  - \*\*Maintenance \& Workshop:\*\* Track scheduled servicing vs. roadside breakdowns, spare parts consumed, and mechanic labor costs.

3\. \*\*Freights, Bilty (LR) \& Trip Lifecycle (`/api/v1/freights`):\*\*

&#x20;  - State machine: `INDENT` $\\rightarrow$ `ASSIGNED` $\\rightarrow$ `LOADED` $\\rightarrow$ `IN\_TRANSIT` $\\rightarrow$ `UNLOADED` $\\rightarrow$ `POD\_UPLOADED` $\\rightarrow$ `SETTLED`.

&#x20;  - Complete trip economics:

&#x20;    $$\\text{Net Trip Profit} = (\\text{Gross Freight} + \\text{Halting/Detention}) - (\\text{Diesel Cost} + \\text{FASTag Toll} + \\text{Driver Bhatta} + \\text{RTO/Border} + \\text{Loading/Unloading})$$

4\. \*\*Double-Entry Cashflow \& Profit Ledger (`/api/v1/finance`):\*\*

&#x20;  - Immutable `LedgerEntry` collection with Debit/Credit accounts (`Accounts Receivable`, `Diesel Expense`, `Driver Advance`, `Bank/Cash`, `Owner Equity`).

&#x20;  - Automated \*\*Receivables Aging Buckets\*\* ($0\\text{--}30$, $31\\text{--}60$, $61\\text{--}90$, $90+\\text{ days}$).

5\. \*\*Hybrid Transport Payroll \& Salary Management (`/api/v1/payroll`):\*\*

&#x20;  - Automated monthly settlement calculation:

&#x20;    $$\\text{Net Payable Salary} = \\text{Base Salary} + \\sum(\\text{Trip Bhatta}) + (\\text{Total KM} \\times \\text{KM Incentive}) - \\text{Cash Advances Taken} - \\text{Fuel Shortage Penalties}$$



\---



\## 5. PYTHON FASTAPI AI \& QUANTITATIVE ENGINE (`/apps/ai-engine`)

Implement real mathematical models in Python (no fake random numbers) exposed via FastAPI endpoints and triggered by Node.js:



1\. \*\*`POST /ai/fuel-theft-audit` (Isolation Forest Anomaly Detector):\*\*

&#x20;  - Uses `sklearn.ensemble.IsolationForest` trained on trip features: `\[km\_per\_liter, load\_tonnage, route\_gradient\_factor, vehicle\_age]`.

&#x20;  - Outputs `anomaly\_score`, `expected\_kmpl`, `actual\_kmpl`, and flags `isFlaggedForTheft: true` when a driver siphons diesel or inflates fuel slips.

2\. \*\*`POST /ai/predictive-maintenance` (Weibull Survival / Risk Scoring):\*\*

&#x20;  - Calculates failure probability (0–100%) for Brake Pads, Clutch Plates, Tyres, and Engine Oil based on `km\_since\_last\_service`, `average\_tonnage\_carried`, and `historical\_part\_lifespan`.

3\. \*\*`POST /ai/freight-rate-predictor` (Gradient Boosted Margin Optimizer):\*\*

&#x20;  - Predicts \*\*Break-Even Floor Rate\*\*, \*\*Optimal 22% Margin Quote\*\*, and \*\*Backhaul Probability\*\* (chance of getting a return load from the destination corridor) based on distance, tonnage, current diesel price, and historical corridor data.

4\. \*\*`POST /ai/cashflow-forecast` (Working Capital \& Liquidity Predictor):\*\*

&#x20;  - Uses Monte Carlo simulation on client historical payment delays (e.g., billed for 30 days, actual payment $41 \\pm 7\\text{ days}$) combined with upcoming fixed Truck EMIs, Insurance renewals, and Payroll dates to project daily cash balance for the next 60 days.



\---



\## 6. EXECUTIVE ANALYTICS \& GRAPHS SPECIFICATION

Build interactive, custom-styled dark-mode charts (using Recharts/ECharts with custom glass tooltips):

1\. \*\*Cashflow Waterfall Chart:\*\* Gross Billed Freight $\\rightarrow$ Direct Trip Costs (Fuel/Toll/Bhatta) $\\rightarrow$ Fixed Fleet Overheads (EMI/Maintenance/Salaries) $\\rightarrow$ Uncollected Party Receivables $\\rightarrow$ \*\*Net Free Cashflow\*\*.

2\. \*\*Fleet Unit Economics Scatter Matrix:\*\* X-Axis = \*Monthly KM Run\*, Y-Axis = \*Net Profit per KM (₹/KM)\*, Bubble Size = \*Maintenance Expense\*. Highlights "Star Trucks" vs. "Bleeding Lemon Trucks".

3\. \*\*Corridor Profitability \& Backhaul Heatmap:\*\* Ranks top routes (e.g., \*Indore $\\leftrightarrow$ Mumbai\*, \*Indore $\\leftrightarrow$ Pune\*, \*Indore $\\leftrightarrow$ Chennai\*) by Profit-Per-Day.

4\. \*\*AI Fuel Consumption vs. Baseline Graph:\*\* Dual-line area chart comparing Expected Fleet Mileage vs. Actual Mileage with red anomaly spikes.



\---



\## 7. PHASED EXECUTION PLAN FOR ANTIGRAVITY AGENT

Execute this project in 5 verifiable phases. Create an Artifact Task List first, then execute:



\- \*\*PHASE 1: Monorepo, Security Core \& Database Seed\*\*

&#x20; - Scaffold `/apps/api-core`, `/apps/ai-engine`, and `/apps/web-portals`.

&#x20; - Implement Peppered Bcrypt Salting (`cryptoGuard.ts`), JWT + Redis Blacklist middleware, and all Mongoose schemas.

&#x20; - Build a rich \*\*Realistic Indian Fleet Database Seeder (`seed.ts`)\*\* containing: 15 Trucks (`MP-09` registrations, axle configs, tyre serials), 5 Role Users (`DEV`, `ADMIN`, `MANAGER`, `STAFF`, `DRIVER`), 10 B2B Corporate Clients with credit limits, 80 Historical \& Active Trips across Indian corridors with realistic freight/diesel/FASTag numbers, and 5 deliberately injected \*\*Fuel Theft \& Maintenance Anomalies\*\* for the AI engine to catch.

\- \*\*PHASE 2: Python FastAPI AI Microservice\*\*

&#x20; - Implement the 4 ML/Quantitative endpoints in `/apps/ai-engine/main.py` using `scikit-learn`, `numpy`, `pandas`, and `fastapi`. Verify endpoints via curl/automated tests.

\- \*\*PHASE 3: "Obsidian Fleet Command" UI \& Role Portals\*\*

&#x20; - Build the Tailwind design system, Zustand stores, Command Palette (`Cmd+K`), and the 5 isolated Role Portals (`DEV`, `ADMIN`, `MANAGER`, `STAFF`, `DRIVER`).

&#x20; - Include a sleek floating \*\*"DEV Quick-Switch Bar"\*\* at the bottom-right (accessible during local testing/impersonation) so the user can instantaneously test the UI transition across all 5 roles (`DEV` $\\rightarrow$ `ADMIN` $\\rightarrow$ `MANAGER` $\\rightarrow$ `STAFF` $\\rightarrow$ `DRIVER`) in real time.

\- \*\*PHASE 4: DevOps \& CI/CD\*\*

&#x20; - Generate `docker-compose.yml` and the declarative `Jenkinsfile`.

\- \*\*PHASE 5: Autonomous Browser Verification\*\*

&#x20; - Launch the backend, Python AI engine, and React frontend in the terminal.

&#x20; - Open the integrated browser, log into each of the 5 roles, verify all graphs, test the Business Management Panel, trigger a live AI Fuel Audit, and capture Verification Screenshots.

