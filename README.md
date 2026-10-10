# Medicine Stock-Out Early Warning System for Primary Health Centres (PHC)

A complete, zero-dependency frontend prototype built for 24-hour hackathons to predict medicine stock shortages, identify nearby health centres with safe surplus stock, and calculate remaining procurement requirements for district health authorities.

---

## 🚀 How to Run the Project

Since this prototype uses standard HTML5, CSS3, and Vanilla JavaScript, no build step, node modules, or backend server is required!

### Option 1: Direct File Launch (Easiest)
1. Double-click or open `index.html` in any web browser (Chrome, Edge, Firefox, Safari).

### Option 2: Local Static Server (VS Code / Python / Node)
- **VS Code:** Install the **Live Server** extension, right-click `index.html`, and click **Open with Live Server**.
- **Python:** Run `python -m http.server 8000` in the project directory and navigate to `http://localhost:8000`.
- **Node.js:** Run `npx serve .` in the project terminal.

---

## 📂 Files to Commit to GitHub

Commit the following primary source files to your GitHub repository:
- `index.html` (Dashboard interface layout)
- `style.css` (Design system, responsive styling, status indicators)
- `script.js` (Forecasting engine, greedy redistribution algorithm, demo state)
- `README.md` (Project documentation and mathematical specification)

*(Optional: PDF files such as `README.pdf` if already present in repository).*

---

## 🎯 Key Features

1. **Dashboard KPI Overview:** Instant visual stats on Total Health Centres, Medicines Tracked, Critical Shortages, Suggested Inter-PHC Transfers, and District Procurement Deficits.
2. **Seed Data:** Preloaded with 4 fictional Health Centres (A, B, C, D) and 6 essential medicines.
3. **Inventory Forecasting & Safe Zero Handling:** Calculates exact stockout days and predicted stockout dates. Safely handles zero daily consumption items without producing `NaN` or crashing.
4. **Outdated Record Detection:** Automatically flags records older than 14 days as unreliable forecasts.
5. **Smart Inter-PHC Safe Surplus Redistribution:**
   - Prioritizes most urgent shortages first.
   - Matches nearby centres holding identical medicines.
   - Prefers closest donor PHCs based on a geographic distance matrix (km).
   - Preserves donor safety stock (never strips a donor into critical territory).
   - Prevents double allocation of donor surplus.
   - Calculates remaining District Procurement Deficits.
6. **Built-in Demonstration Scenario:** One-click button to load the exact benchmark scenario specified below.
7. **Filters & Dynamic Search:** Filter by Health Centre, Medicine Name, Urgency Level, and adjust Replenishment Lead Time dynamically.

---

## 🧪 Demonstration Scenario Benchmark

Clicking the **"⚡ Load Demo Scenario"** button configures the exact scenario:

* **Centre A (Recipient):**
  * Current Stock: `60` bottles of Paracetamol Syrup
  * Daily Consumption: `10` bottles/day
  * Target Coverage: `30` days
  * *Calculated:* Days remaining = `6 days`. Target stock = `300` bottles. Shortfall = `240` bottles.
* **Centre C (Donor):**
  * Current Stock: `200` bottles of Paracetamol Syrup
  * Daily Consumption: `2` bottles/day
  * Target Coverage: `30` days
  * Distance to Centre A: `9 km`
  * *Calculated:* Safety stock needed = `60` bottles (`2 * 30`). Available safe surplus = `140` bottles (`200 - 60`).

### 📊 Benchmark Results:
- **Centre A Days Remaining:** `6.0 days` (CRITICAL status)
- **Centre C Safe Surplus:** `140 bottles`
- **Suggested Transfer:** `140 bottles` from Centre C to Centre A (9 km away)
- **Remaining District Requirement:** `100 bottles` (`240 shortfall - 140 transferred`)

---

## 📐 Mathematical Formulas & Algorithms

### 1. Stockout Forecasting
$$\text{Days Remaining} = \begin{cases} \infty & \text{if Daily Consumption} = 0 \\ \frac{\text{Current Stock}}{\text{Average Daily Consumption}} & \text{if Daily Consumption} > 0 \end{cases}$$

$$\text{Estimated Stock-Out Date} = \text{Current Date} + \lfloor\text{Days Remaining}\rfloor \text{ days}$$

### 2. Status Determination
- **OUTDATED:** If $\text{Days Since Last Update} > 14$
- **CRITICAL:** If $\text{Days Remaining} \le \text{Replenishment Lead Time}$ (default 10 days)
- **WARNING:** If $\text{Lead Time} < \text{Days Remaining} \le 1.5 \times \text{Lead Time}$
- **SAFE:** If $\text{Days Remaining} > 1.5 \times \text{Lead Time}$

### 3. Shortfall & Safe Surplus
$$\text{Target Stock} = \text{Daily Consumption} \times \text{Target Coverage Days}$$

$$\text{Shortfall} = \max(0, \text{Target Stock} - \text{Current Stock})$$

$$\text{Donor Safety Stock} = \text{Donor Daily Consumption} \times \text{Target Coverage Days}$$

$$\text{Donor Safe Surplus} = \max(0, \text{Donor Current Stock} - \text{Donor Safety Stock})$$

### 4. Inter-PHC Redistribution Algorithm (Greedy Multi-Donor)
1. **Sort Shortages:** Rank recipient shortages by urgency (lowest days remaining first).
2. **Locate Candidate Donors:** Find all PHCs with matching medicine having $\text{Donor Safe Surplus} > 0$.
3. **Proximity Preference:** Sort candidate donors by ascending physical distance ($\text{km}$).
4. **Surplus Transfer:**
   $$\text{Transfer Quantity} = \min(\text{Remaining Recipient Need}, \text{Donor Available Surplus})$$
5. **State Tracking:** Subtract allocated transfer from available donor surplus map to ensure surplus is **never allocated twice**.
6. **District Fallback Requirement:**
   $$\text{District Requirement} = \text{Shortfall} - \sum \text{Allocated Surplus Transfers}$$

---

## ⚠️ Prototype Limitations

- **Simulated Data:** Uses client-side in-memory mock datasets for demonstration purposes.
- **Client-Side State:** Data modifications via the "Add/Update Stock" modal persist only in browser memory until page reload.
- **Manual Approval Required:** Suggested transfers are algorithmic recommendations only and do not dispatch physical logistics or real supply chain orders.

---

## 🔮 Planned Firebase Backend Roadmap

For production deployment across real primary health networks, the following Firebase modules are planned:

1. **Firebase Authentication:** Role-based access control (PHC Pharmacist, District Health Officer, Logistics Driver).
2. **Cloud Firestore / Realtime DB:** Live multi-centre inventory synchronization with offline persistence for remote rural clinics.
3. **Firebase Cloud Messaging (FCM):** Automated Push Notifications & SMS alerts to District Health Officers when stock reaches critical thresholds ($<7$ days).
4. **Firebase Cloud Functions:** Automated cron jobs triggered daily at midnight to re-evaluate forecasting formulas and queue logistics orders.
