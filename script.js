/**
 * ============================================================================
 * AUSHADHI-ALERT: PHC MEDICINE STOCK-OUT EARLY WARNING & REDISTRIBUTION ENGINE
 * ============================================================================
 * Clean Vanilla JavaScript Implementation for Hackathon Prototype.
 * 
 * CORE ALGORITHMIC FORMULAS & WORKFLOWS:
 * 1. Usable Stock = Total Physical Stock - Expired Batch Stock (Deducted exactly once)
 * 2. Days Remaining = Usable Stock / Effective Daily Consumption (0 if Usable Stock == 0)
 * 3. Target Stock = Effective Daily Consumption * Target Coverage Days
 * 4. Shortfall = Max(0, Target Stock - Usable Stock)
 * 5. Donor Safe Surplus = Max(0, Usable Stock - Donor Safety Stock)
 * 6. Greedy Inter-PHC Redistribution:
 *    - Route visualization: Donor PHC → Distance (km) → Recipient PHC
 *    - Never allocates outdated donor stock (>14 days).
 *    - Requires verification confirmation for outdated recipients.
 *    - Capped at donor safe surplus; surplus tracked across pass to prevent double allocation.
 *    - Synchronizes batch quantities upon transfer execution.
 * 7. Procurement Deficit: Displays ONLY items with remaining district requirement > 0.
 * ============================================================================
 */

// Global Config & Robust XSS Escaping Helper
function toLocalISO(d) {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));
}

// Builds N days of history ending today; uses = daily consumption, oldest -> newest
function makeHistory(now, uses) {
    const h = [];
    let s = now;
    for (let i = 0; i <= uses.length; i++) {
        h.unshift({ date: getPastDateString(i), stock: s, adj: 0 });
        s += uses[uses.length - 1 - i] || 0;
    }
    return h;
}

// Records a stock checkpoint. adj = net stock received (+) or sent away (-) since the last point
function recordHistory(item, adj = 0, date = toLocalISO(new Date())) {
    item.history = item.history || [{ date: item.lastUpdated || getPastDateString(0), stock: item.currentStock - adj, adj: 0 }];
    const last = item.history[item.history.length - 1];
    if (last && last.date === date) {
        last.stock = item.currentStock;
        last.adj = (last.adj || 0) + adj;
    } else {
        item.history.push({ date, stock: item.currentStock, adj });
    }
    item.history.sort((a, b) => a.date.localeCompare(b.date));
}

// Historical Consumption Forecasting Pipeline
function computeUsage(item) {
    const h = (item.history || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    const iv = [];

    for (let i = 1; i < h.length; i++) {
        const days = (new Date(h[i].date) - new Date(h[i - 1].date)) / 864e5;
        const used = h[i - 1].stock + (h[i].adj || 0) - h[i].stock;
        if (days > 0 && used >= 0) {
            iv.push({ days, used });
        }
    }

    if (!iv.length) {
        return { rate: Math.max(0, item.dailyConsumption || 0), method: 'manual', trend: 'steady', days: 0 };
    }

    const sum = a => a.reduce((s, x) => [s[0] + x.used, s[1] + x.days], [0, 0]);
    const win = iv.slice(-14);
    const [u, d] = sum(win);

    if (d <= 0) {
        return { rate: Math.max(0, item.dailyConsumption || 0), method: 'manual', trend: 'steady', days: 0 };
    }

    const overall = u / d;
    const [ru, rd] = sum(iv.slice(-3));
    const recent = rd > 0 ? ru / rd : overall;

    const rising = win.length >= 4 && recent >= overall * 1.25;
    const falling = win.length >= 4 && recent <= overall * 0.75;
    const rate = rising ? recent : overall;

    return {
        rate: rate > 0 ? rate : Math.max(0, item.dailyConsumption || 0),
        overall,
        recent,
        method: 'history',
        days: Math.round(d),
        trend: rising ? 'rising' : falling ? 'falling' : 'steady'
    };
}

function usageNote(i) {
    return i.usage && i.usage.method === 'history' ? `${i.usage.days}d history · ${i.usage.trend}` : 'manual estimate';
}

let leadTimeDays = 10;

// Symmetric Distance Matrix (km)
const distanceMatrix = {
    'Centre A': { 'Centre A': 0, 'Centre B': 15, 'Centre C': 9, 'Centre D': 22 },
    'Centre B': { 'Centre A': 15, 'Centre B': 0, 'Centre C': 12, 'Centre D': 8 },
    'Centre C': { 'Centre A': 9, 'Centre B': 12, 'Centre C': 0, 'Centre D': 18 },
    'Centre D': { 'Centre A': 22, 'Centre B': 8, 'Centre C': 18, 'Centre D': 0 }
};

// PHC Full Names
const centreNames = {
    'Centre A': 'Centre A (PHC Alpha - Rampur)',
    'Centre B': 'Centre B (PHC Beta - Sundarpur)',
    'Centre C': 'Centre C (PHC Gamma - Chandanpur)',
    'Centre D': 'Centre D (PHC Delta - Krishnapur)'
};

// Relative Date Helpers
function getPastDateString(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
}

function getFutureDateString(daysAhead) {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString().split('T')[0];
}

function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}

// Initial Seed Data (Simulated Fictional Data)
const initialInventorySeed = [
    {
        id: 'INV-001',
        centreId: 'Centre A',
        medicineName: 'Paracetamol Syrup (100ml)',
        currentStock: 40,
        dailyConsumption: 8,
        targetCoverageDays: 30,
        lastUpdated: getPastDateString(2)
    },
    {
        id: 'INV-002',
        centreId: 'Centre B',
        medicineName: 'Paracetamol Syrup (100ml)',
        currentStock: 250,
        dailyConsumption: 5,
        targetCoverageDays: 30,
        lastUpdated: getPastDateString(1)
    },
    {
        id: 'INV-003',
        centreId: 'Centre C',
        medicineName: 'Paracetamol Syrup (100ml)',
        currentStock: 180,
        dailyConsumption: 3,
        targetCoverageDays: 30,
        lastUpdated: getPastDateString(0)
    },
    {
        id: 'INV-004',
        centreId: 'Centre A',
        medicineName: 'Amoxicillin 500mg Capsules',
        currentStock: 120,
        dailyConsumption: 15,
        targetCoverageDays: 30,
        lastUpdated: getPastDateString(18)
    },
    {
        id: 'INV-005',
        centreId: 'Centre B',
        medicineName: 'Amoxicillin 500mg Capsules',
        currentStock: 500,
        dailyConsumption: 10,
        targetCoverageDays: 30,
        lastUpdated: getPastDateString(3)
    },
    {
        id: 'INV-006',
        centreId: 'Centre C',
        medicineName: 'ORS Electrolyte Packets',
        currentStock: 50,
        dailyConsumption: 12,
        targetCoverageDays: 30,
        lastUpdated: getPastDateString(1)
    },
    {
        id: 'INV-007',
        centreId: 'Centre D',
        medicineName: 'ORS Electrolyte Packets',
        currentStock: 450,
        dailyConsumption: 6,
        targetCoverageDays: 30,
        lastUpdated: getPastDateString(0)
    },
    {
        id: 'INV-008',
        centreId: 'Centre A',
        medicineName: 'Metformin 500mg Tablets',
        currentStock: 300,
        dailyConsumption: 0,
        targetCoverageDays: 30,
        lastUpdated: getPastDateString(4)
    },
    {
        id: 'INV-009',
        centreId: 'Centre D',
        medicineName: 'Amlodipine 5mg Tablets',
        currentStock: 60,
        dailyConsumption: 7,
        targetCoverageDays: 30,
        lastUpdated: getPastDateString(2)
    },
    {
        id: 'INV-010',
        centreId: 'Centre B',
        medicineName: 'Amlodipine 5mg Tablets',
        currentStock: 350,
        dailyConsumption: 4,
        targetCoverageDays: 30,
        lastUpdated: getPastDateString(1)
    },
    {
        id: 'INV-011',
        centreId: 'Centre C',
        medicineName: 'Artemether Injection (80mg)',
        currentStock: 15,
        dailyConsumption: 3,
        targetCoverageDays: 30,
        lastUpdated: getPastDateString(2)
    },
    {
        id: 'INV-012',
        centreId: 'Centre D',
        medicineName: 'Artemether Injection (80mg)',
        currentStock: 120,
        dailyConsumption: 2,
        targetCoverageDays: 30,
        lastUpdated: getPastDateString(0)
    }
];

// Initial Seed Data for Medicine Batches
const initialBatchSeed = [
    {
        id: 'BAT-001',
        batchNumber: 'BATCH-2026-P01',
        centreId: 'Centre A',
        medicineName: 'Paracetamol Syrup (100ml)',
        quantity: 40,
        expiryDate: getFutureDateString(180)
    },
    {
        id: 'BAT-002',
        batchNumber: 'BATCH-2026-P02',
        centreId: 'Centre C',
        medicineName: 'Paracetamol Syrup (100ml)',
        quantity: 180,
        expiryDate: getFutureDateString(240)
    },
    {
        id: 'BAT-003',
        batchNumber: 'BATCH-2025-A99',
        centreId: 'Centre A',
        medicineName: 'Amoxicillin 500mg Capsules',
        quantity: 30,
        expiryDate: getPastDateString(10) // EXPIRED 10 days ago!
    },
    {
        id: 'BAT-004',
        batchNumber: 'BATCH-2026-O15',
        centreId: 'Centre C',
        medicineName: 'ORS Electrolyte Packets',
        quantity: 50,
        expiryDate: getFutureDateString(35)
    }
];

// LocalStorage Persistent State Loaders
function loadSavedInventory() {
    const saved = localStorage.getItem('aushadhi_inventory_state');
    if (saved) {
        try { return JSON.parse(saved); } catch (e) { console.error('Error parsing saved inventory', e); }
    }
    return JSON.parse(JSON.stringify(initialInventorySeed));
}

function loadSavedBatches() {
    const saved = localStorage.getItem('aushadhi_batch_state');
    if (saved) {
        try { return JSON.parse(saved); } catch (e) { console.error('Error parsing saved batches', e); }
    }
    return JSON.parse(JSON.stringify(initialBatchSeed));
}

// Active State
let inventoryState = loadSavedInventory();
let batchState = loadSavedBatches();

function saveStateToStorage() {
    localStorage.setItem('aushadhi_inventory_state', JSON.stringify(inventoryState));
    localStorage.setItem('aushadhi_batch_state', JSON.stringify(batchState));
}

// Calculate days difference from today safely
function getDaysSince(dateStr) {
    if (!dateStr) return 999;
    const updated = new Date(dateStr);
    if (isNaN(updated.getTime())) return 999;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    updated.setHours(0, 0, 0, 0);

    const diffTime = today - updated;
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// Calculate days remaining until expiry
function getDaysUntilExpiry(expiryDateStr) {
    if (!expiryDateStr) return 0;
    const expiry = new Date(expiryDateStr);
    if (isNaN(expiry.getTime())) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);

    const diffTime = expiry - today;
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// Calculate estimated stockout date
function calculateStockoutDate(daysRemaining) {
    if (!isFinite(daysRemaining) || isNaN(daysRemaining) || daysRemaining < 0) {
        return 'No Risk (0 Use)';
    }
    if (daysRemaining === 0) {
        return 'OUT OF STOCK TODAY';
    }
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + Math.floor(daysRemaining));
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Medicine Expiry Utility & Batch Accounting
 * Excludes expired batch quantities from usable stock.
 */
function getItemBatchAnalysis(centreId, medicineName) {
    const matchingBatches = batchState.filter(b =>
        b.centreId === centreId &&
        b.medicineName.toLowerCase() === medicineName.toLowerCase()
    );

    let validBatchQty = 0;
    let expiredQty = 0;
    let nearExpiryQty = 0;

    matchingBatches.forEach(b => {
        const daysLeft = getDaysUntilExpiry(b.expiryDate);
        if (daysLeft < 0) {
            expiredQty += (b.quantity || 0);
        } else {
            validBatchQty += (b.quantity || 0);
            if (daysLeft <= 60) {
                nearExpiryQty += (b.quantity || 0);
            }
        }
    });

    return { matchingBatches, validBatchQty, expiredQty, nearExpiryQty };
}

/**
 * Process Forecasting & Risk Classification for an inventory item
 */
function processForecastItem(item) {
    const daysSinceUpdate = getDaysSince(item.lastUpdated);
    const isOutdated = daysSinceUpdate > 14 || daysSinceUpdate < 0;

    // Historical Consumption Analysis
    const usage = computeUsage(item);
    const effectiveConsumption = (usage.method === 'history' && usage.rate > 0) ? usage.rate : (item.dailyConsumption || 0);

    // Batch Accounting & Expired Stock Deduction
    const { matchingBatches, validBatchQty, expiredQty, nearExpiryQty } = getItemBatchAnalysis(item.centreId, item.medicineName);

    // Usable Stock: Excludes expired batches. If batch records exist, valid non-expired batch stock is authoritative.
    let usableStock;
    if (matchingBatches.length > 0) {
        usableStock = Math.min(Math.max(0, item.currentStock), validBatchQty);
    } else {
        usableStock = Math.max(0, item.currentStock);
    }

    // Estimated Days Remaining
    let daysRemaining;
    if (effectiveConsumption <= 0) {
        daysRemaining = Infinity;
    } else if (usableStock === 0) {
        daysRemaining = 0;
    } else {
        daysRemaining = usableStock / effectiveConsumption;
    }

    // Shortfall & Target Stock based on effective consumption
    const targetStock = effectiveConsumption * item.targetCoverageDays;
    const shortfall = Math.max(0, Math.round(targetStock - usableStock));

    // Donor Safe Surplus
    const safetyStock = effectiveConsumption * item.targetCoverageDays;
    const rawSurplus = Math.max(0, Math.round(usableStock - safetyStock));
    const donorSurplus = isOutdated ? 0 : rawSurplus;

    // Risk Classification & Human-Readable Reason
    let status = 'SAFE';
    let riskReason = '';

    if (isOutdated) {
        status = 'OUTDATED';
        riskReason = `Record updated ${daysSinceUpdate}d ago (>14d). Audit required.`;
    } else if (usableStock === 0 && effectiveConsumption > 0) {
        status = 'CRITICAL';
        riskReason = `OUT OF STOCK! Zero usable units remaining.`;
    } else if (daysRemaining <= leadTimeDays) {
        status = 'CRITICAL';
        riskReason = `Depletes in ${daysRemaining.toFixed(1)}d (≤ ${leadTimeDays}d lead time). High stock-out risk.`;
    } else if (daysRemaining <= leadTimeDays * 1.5) {
        status = 'WARNING';
        riskReason = `Covers ${daysRemaining.toFixed(1)}d (≤ ${Math.round(leadTimeDays * 1.5)}d threshold). Reorder soon.`;
    } else if (daysRemaining === Infinity) {
        status = 'SAFE';
        riskReason = `Zero daily usage reported. Stock intact.`;
    } else {
        status = 'SAFE';
        riskReason = `Covers ${daysRemaining.toFixed(1)}d safely exceeding ${leadTimeDays}d lead time.`;
    }

    if (expiredQty > 0) {
        riskReason += ` (${expiredQty} units expired & deducted).`;
    }

    return {
        ...item,
        usage,
        effectiveConsumption,
        usableStock,
        validBatchQty,
        expiredQty,
        nearExpiryQty,
        daysRemaining,
        daysSinceUpdate,
        isOutdated,
        targetStock,
        shortfall,
        safetyStock,
        donorSurplus,
        rawSurplus,
        status,
        riskReason,
        stockoutDate: calculateStockoutDate(daysRemaining)
    };
}

/**
 * Smart Inter-PHC Redistribution Algorithm
 */
function computeRedistribution(processedInventory) {
    const suggestedTransfers = [];
    const districtRequirements = [];

    // Filter items with shortfall > 0 (Recipients), sorted by urgency
    const shortages = processedInventory
        .filter(item => item.shortfall > 0)
        .sort((a, b) => a.daysRemaining - b.daysRemaining);

    // Surplus Tracker map (0 for outdated donors)
    const surplusTracker = {};
    processedInventory.forEach(item => {
        surplusTracker[item.id] = item.isOutdated ? 0 : item.donorSurplus;
    });

    shortages.forEach(recipient => {
        let neededQty = recipient.shortfall;
        let totalAllocatedForRecipient = 0;

        // Candidate Donors (Not outdated, matching medicine, surplus > 0)
        const candidateDonors = processedInventory
            .filter(donor =>
                !donor.isOutdated &&
                donor.centreId !== recipient.centreId &&
                donor.medicineName === recipient.medicineName &&
                surplusTracker[donor.id] > 0
            )
            .map(donor => {
                const dist = distanceMatrix[recipient.centreId]?.[donor.centreId] ?? 99;
                return { donorItem: donor, distance: dist };
            })
            .sort((a, b) => a.distance - b.distance);

        candidateDonors.forEach(({ donorItem, distance }) => {
            if (neededQty <= 0) return;

            const availableSurplus = surplusTracker[donorItem.id];
            if (availableSurplus <= 0) return;

            const transferAmount = Math.min(neededQty, availableSurplus);
            const reasoning = `${donorItem.centreId} retains required safety stock. Available safe surplus: ${availableSurplus} units. Distance: ${distance} km.`;

            suggestedTransfers.push({
                priority: recipient.isOutdated ? 'OUTDATED (Verify)' : (recipient.daysRemaining <= leadTimeDays ? 'CRITICAL' : 'WARNING'),
                recipientCentre: recipient.centreId,
                donorCentre: donorItem.centreId,
                medicineName: recipient.medicineName,
                distanceKm: distance,
                transferQty: transferAmount,
                recipientDaysRemaining: recipient.daysRemaining,
                recipientIsOutdated: recipient.isOutdated,
                reasoning
            });

            surplusTracker[donorItem.id] -= transferAmount;
            neededQty -= transferAmount;
            totalAllocatedForRecipient += transferAmount;
        });

        // Calculate remaining district requirement
        const remainingDistrictReq = recipient.shortfall - totalAllocatedForRecipient;
        if (remainingDistrictReq > 0) {
            districtRequirements.push({
                centreId: recipient.centreId,
                medicineName: recipient.medicineName,
                totalShortfall: recipient.shortfall,
                coveredBySurplus: totalAllocatedForRecipient,
                remainingDistrictReq: remainingDistrictReq,
                status: recipient.status,
                isOutdated: recipient.isOutdated
            });
        }
    });

    return { suggestedTransfers, districtRequirements };
}

/**
 * Execute Transfer Action with Batch Quantity Synchronization & Rejection Guard
 */
function executeTransfer(donorCentre, recipientCentre, medicineName, qty) {
    const transferQty = parseInt(qty, 10);
    if (isNaN(transferQty) || transferQty <= 0) {
        showToast('Error: Transfer quantity must be a positive number.', 'error');
        return;
    }

    const donorIdx = inventoryState.findIndex(i => i.centreId === donorCentre && i.medicineName === medicineName);
    let recipientIdx = inventoryState.findIndex(i => i.centreId === recipientCentre && i.medicineName === medicineName);

    if (donorIdx < 0) {
        showToast('Error: Donor inventory record not found.', 'error');
        return;
    }

    const donorItem = inventoryState[donorIdx];

    // Check physical stock
    if (donorItem.currentStock < transferQty) {
        showToast(`Transfer rejected: Donor PHC has only ${donorItem.currentStock} units physical stock (requested ${transferQty}).`, 'error');
        return;
    }

    // Check valid non-expired batch availability
    const { matchingBatches, validBatchQty } = getItemBatchAnalysis(donorCentre, medicineName);
    if (matchingBatches.length > 0 && validBatchQty < transferQty) {
        showToast(`Transfer rejected: Donor PHC has only ${validBatchQty} units in valid non-expired batches (requested ${transferQty}). Cannot complete transfer without unbacked stock.`, 'error');
        return;
    }

    // Re-verify donor safe surplus
    const donorProcessed = processForecastItem(donorItem);
    if (donorProcessed.donorSurplus < transferQty) {
        showToast(`Transfer rejected: Requested ${transferQty} units exceeds donor safe surplus (${donorProcessed.donorSurplus} units safe surplus available).`, 'error');
        return;
    }

    // Deduct stock from Donor & record stock adjustment point
    donorItem.currentStock -= transferQty;
    donorItem.lastUpdated = getPastDateString(0);
    recordHistory(donorItem, -transferQty);

    // Credit stock to Recipient & record stock adjustment point
    if (recipientIdx >= 0) {
        inventoryState[recipientIdx].currentStock += transferQty;
        inventoryState[recipientIdx].lastUpdated = getPastDateString(0);
        recordHistory(inventoryState[recipientIdx], transferQty);
    } else {
        const newRecipientItem = {
            id: `INV-${Date.now()}`,
            centreId: recipientCentre,
            medicineName: medicineName,
            currentStock: transferQty,
            dailyConsumption: donorItem.dailyConsumption || 5,
            targetCoverageDays: donorItem.targetCoverageDays || 30,
            lastUpdated: getPastDateString(0)
        };
        recordHistory(newRecipientItem, transferQty);
        inventoryState.push(newRecipientItem);
    }

    // Batch Synchronization: Move valid batch quantities from Donor to Recipient (earliest expiry first)
    let remainingToMove = transferQty;
    const validDonorBatches = batchState
        .filter(b =>
            b.centreId === donorCentre &&
            b.medicineName.toLowerCase() === medicineName.toLowerCase() &&
            getDaysUntilExpiry(b.expiryDate) >= 0
        )
        .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

    validDonorBatches.forEach(b => {
        if (remainingToMove <= 0) return;
        const moveQty = Math.min(b.quantity, remainingToMove);
        b.quantity -= moveQty;
        remainingToMove -= moveQty;

        // Credit transferred batch to Recipient
        batchState.push({
            id: `BAT-XFER-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            batchNumber: `${b.batchNumber}-XFER`,
            centreId: recipientCentre,
            medicineName: medicineName,
            quantity: moveQty,
            expiryDate: b.expiryDate
        });
    });

    // Clean up empty donor batches
    batchState = batchState.filter(b => b.quantity > 0);

    markCustomDataActive();
    saveStateToStorage();
    populateDropdowns();
    renderDashboard();

    showToast(`⚡ Transferred ${transferQty} units of ${esc(medicineName)} from ${esc(donorCentre)} to ${esc(recipientCentre)}!`, 'success');
}

/**
 * Update Data Status Pill Indicator
 */
function markDemoDataActive() {
    const pill = document.getElementById('data-status-pill');
    if (!pill) return;
    pill.className = 'demo-mode-pill';
    pill.innerHTML = `<i class="fa-solid fa-flask"></i> DEMO MODE DATA`;
}

function markCustomDataActive() {
    const pill = document.getElementById('data-status-pill');
    if (!pill) return;
    pill.className = 'demo-mode-pill saved-mode';
    pill.innerHTML = `<i class="fa-solid fa-database"></i> SAVED OPERATIONAL DATA`;
}

/**
 * Render Facility Risk Overview Cards
 */
function renderFacilityRiskMatrix(processedInventory) {
    const container = document.getElementById('facility-risk-container');
    if (!container) return;

    const centres = Object.keys(centreNames);
    container.innerHTML = '';

    centres.forEach(centreId => {
        const centreItems = processedInventory.filter(i => i.centreId === centreId);
        const criticalItems = centreItems.filter(i => i.status === 'CRITICAL');
        const warningItems = centreItems.filter(i => i.status === 'WARNING');
        const totalShortfall = centreItems.reduce((acc, i) => acc + i.shortfall, 0);
        const totalSurplus = centreItems.reduce((acc, i) => acc + i.donorSurplus, 0);

        let riskBadgeClass = 'badge-safe';
        let riskLabel = 'LOW RISK';

        if (criticalItems.length > 0) {
            riskBadgeClass = 'badge-critical';
            riskLabel = 'HIGH RISK';
        } else if (warningItems.length > 0) {
            riskBadgeClass = 'badge-warning';
            riskLabel = 'MODERATE RISK';
        }

        const card = document.createElement('div');
        card.className = 'facility-card';
        card.innerHTML = `
            <div class="facility-card-header">
                <div>
                    <div class="facility-title">${esc(centreId)}</div>
                    <div class="facility-sub">${esc(centreNames[centreId])}</div>
                </div>
                <span class="badge ${esc(riskBadgeClass)}">${esc(riskLabel)}</span>
            </div>
            <div class="facility-metrics">
                <div class="facility-stat">
                    <span class="facility-stat-label">Critical Items</span>
                    <span class="facility-stat-val" style="color: ${criticalItems.length > 0 ? '#dc2626' : '#16a34a'};">${criticalItems.length}</span>
                </div>
                <div class="facility-stat">
                    <span class="facility-stat-label">Shortfall Qty</span>
                    <span class="facility-stat-val">${totalShortfall}</span>
                </div>
                <div class="facility-stat">
                    <span class="facility-stat-label">Safe Surplus</span>
                    <span class="facility-stat-val" style="color: #0284c7;">${totalSurplus}</span>
                </div>
                <div class="facility-stat">
                    <span class="facility-stat-label">Items Tracked</span>
                    <span class="facility-stat-val">${centreItems.length}</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

/**
 * Render What-If Supply Chain Simulator
 */
function renderSimulator(processedInventory) {
    const demandMult = parseFloat(document.getElementById('sim-demand-multiplier').value);
    const delayDays = parseInt(document.getElementById('sim-delay-days').value, 10);
    const shockPercent = parseInt(document.getElementById('sim-supply-shock').value, 10);

    document.getElementById('val-demand-multiplier').textContent = `${demandMult.toFixed(1)}x`;
    document.getElementById('val-delay-days').textContent = `+${delayDays} days`;
    document.getElementById('val-supply-shock').textContent = `${shockPercent}%`;

    const banner = document.getElementById('sim-impact-summary');
    const tbody = document.getElementById('sim-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const effectiveLeadTime = leadTimeDays + delayDays;

    let simCriticalCount = 0;
    let simTotalReq = 0;

    processedInventory.forEach(item => {
        const simStock = Math.max(0, item.usableStock * (1 - shockPercent / 100));
        const simCons = (item.effectiveConsumption || item.dailyConsumption) * demandMult;

        let simDaysLeft;
        if (simCons <= 0) {
            simDaysLeft = Infinity;
        } else if (simStock === 0) {
            simDaysLeft = 0;
        } else {
            simDaysLeft = simStock / simCons;
        }

        let simStatus = 'SAFE';
        if (item.isOutdated) {
            simStatus = 'OUTDATED';
        } else if (simDaysLeft <= effectiveLeadTime) {
            simStatus = 'CRITICAL';
            simCriticalCount++;
        } else if (simDaysLeft <= effectiveLeadTime * 1.5) {
            simStatus = 'WARNING';
        }

        const simTarget = simCons * item.targetCoverageDays;
        const simShortfall = Math.max(0, Math.round(simTarget - simStock));
        if (simShortfall > 0) simTotalReq += simShortfall;

        const simStockoutDate = calculateStockoutDate(simDaysLeft);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${esc(item.centreId)}</strong></td>
            <td><strong>${esc(item.medicineName)}</strong></td>
            <td>${item.daysRemaining === Infinity ? 'Infinite' : item.daysRemaining.toFixed(1) + 'd'}</td>
            <td><strong style="color: ${simDaysLeft <= effectiveLeadTime ? '#dc2626' : '#111827'};">${simDaysLeft === Infinity ? 'Infinite' : simDaysLeft.toFixed(1) + 'd'}</strong></td>
            <td>${esc(simStockoutDate)}</td>
            <td><span class="badge ${item.status === 'CRITICAL' ? 'badge-critical' : (item.status === 'WARNING' ? 'badge-warning' : 'badge-safe')}">${esc(item.status)}</span></td>
            <td><span class="badge ${simStatus === 'CRITICAL' ? 'badge-critical' : (simStatus === 'WARNING' ? 'badge-warning' : 'badge-safe')}">${esc(simStatus)}</span></td>
            <td>${simShortfall > 0 ? `<strong style="color:#dc2626;">${simShortfall} units</strong>` : '0'}</td>
        `;
        tbody.appendChild(tr);
    });

    if (demandMult > 1.0 || delayDays > 0 || shockPercent > 0) {
        banner.className = 'sim-status-banner';
        banner.style.backgroundColor = '#fef2f2';
        banner.style.borderColor = '#fca5a5';
        banner.style.color = '#dc2626';
        banner.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <strong>Simulation Active:</strong> ${simCriticalCount} critical shortages projected (+${simTotalReq} units district requirement under stress conditions).`;
    } else {
        banner.className = 'sim-status-banner';
        banner.style.backgroundColor = '#eff6ff';
        banner.style.borderColor = '#bfdbfe';
        banner.style.color = '#1e40af';
        banner.innerHTML = `<i class="fa-solid fa-circle-check"></i> Baseline mode active. Adjust sliders above to stress test supply network.`;
    }
}

/**
 * Render Medicine Batch & Expiry Management Table
 */
function renderBatchTable() {
    const tbody = document.getElementById('batch-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (batchState.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #6b7280; padding: 2rem;">No registered medicine batches found.</td></tr>`;
        return;
    }

    batchState.forEach(b => {
        const daysLeft = getDaysUntilExpiry(b.expiryDate);
        let badgeClass = 'badge-safe';
        let statusLabel = 'USABLE (Valid)';

        if (daysLeft < 0) {
            badgeClass = 'badge-expired';
            statusLabel = `EXPIRED (${Math.abs(daysLeft)}d ago)`;
        } else if (daysLeft <= 60) {
            badgeClass = 'badge-near-expiry';
            statusLabel = `NEAR EXPIRY (${daysLeft}d left)`;
        }

        const tr = document.createElement('tr');
        if (daysLeft < 0) tr.className = 'row-expired';

        tr.innerHTML = `
            <td><code>${esc(b.batchNumber)}</code></td>
            <td><strong>${esc(b.centreId)}</strong></td>
            <td><strong>${esc(b.medicineName)}</strong></td>
            <td><strong>${b.quantity} units</strong></td>
            <td>${esc(formatDate(b.expiryDate))}</td>
            <td>${daysLeft < 0 ? `<span style="color:#dc2626; font-weight:bold;">${daysLeft} days</span>` : `${daysLeft} days`}</td>
            <td><span class="badge ${badgeClass}">${esc(statusLabel)}</span></td>
            <td>
                <button class="btn btn-danger btn-sm btn-delete-batch" data-id="${esc(b.id)}">
                    <i class="fa-solid fa-trash"></i> Delete
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.querySelectorAll('.btn-delete-batch').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const batchId = e.currentTarget.dataset.id;
            showConfirmModal('Delete Batch Record', 'Are you sure you want to delete this batch record?', () => {
                batchState = batchState.filter(b => b.id !== batchId);
                markCustomDataActive();
                saveStateToStorage();
                renderDashboard();
                showToast('Batch record deleted successfully.', 'info');
            });
        });
    });
}

/**
 * Render Live Operational Alerts Feed in Sidebar Panel
 */
function renderAlertsFeed(processedList, suggestedTransfers) {
    const feed = document.getElementById('alerts-feed');
    if (!feed) return;
    feed.innerHTML = '';

    const criticals = processedList.filter(i => i.status === 'CRITICAL');
    const outdated = processedList.filter(i => i.status === 'OUTDATED');
    const expiredBatches = batchState.filter(b => getDaysUntilExpiry(b.expiryDate) < 0);

    let html = '';

    criticals.forEach(c => {
        html += `
            <div class="alert-item alert-item-critical">
                <i class="fa-solid fa-triangle-exclamation" style="margin-top:0.15rem;"></i>
                <div>
                    <strong>CRITICAL: ${esc(c.centreId)}</strong>
                    <div>${esc(c.medicineName)} has only ${c.usableStock} usable units (${c.daysRemaining === Infinity ? '0' : c.daysRemaining.toFixed(1)}d left).</div>
                </div>
            </div>
        `;
    });

    suggestedTransfers.forEach(t => {
        html += `
            <div class="alert-item alert-item-info">
                <i class="fa-solid fa-truck-fast" style="margin-top:0.15rem;"></i>
                <div>
                    <strong>TRANSFER OPPORTUNITY</strong>
                    <div>Move ${t.transferQty} units of ${esc(t.medicineName)} from ${esc(t.donorCentre)} → ${esc(t.recipientCentre)} (${t.distanceKm} km).</div>
                </div>
            </div>
        `;
    });

    expiredBatches.forEach(b => {
        html += `
            <div class="alert-item alert-item-warning">
                <i class="fa-solid fa-box-archive" style="margin-top:0.15rem;"></i>
                <div>
                    <strong>EXPIRED BATCH DEDUCTED</strong>
                    <div>Batch ${esc(b.batchNumber)} (${b.quantity} units) at ${esc(b.centreId)} expired on ${esc(formatDate(b.expiryDate))}.</div>
                </div>
            </div>
        `;
    });

    outdated.forEach(o => {
        html += `
            <div class="alert-item alert-item-warning">
                <i class="fa-solid fa-clock-rotate-left" style="margin-top:0.15rem;"></i>
                <div>
                    <strong>OUTDATED RECORD (>14d)</strong>
                    <div>${esc(o.centreId)} - ${esc(o.medicineName)} inventory record updated ${o.daysSinceUpdate} days ago.</div>
                </div>
            </div>
        `;
    });

    if (!html) {
        html = `<div style="color:#16a34a; font-size:0.8rem; font-weight:600; padding:0.5rem;"><i class="fa-solid fa-circle-check"></i> All primary health centres operating within safe stock levels!</div>`;
    }

    feed.innerHTML = html;
}

/**
 * Main UI Render Engine
 */
function renderDashboard() {
    // 1. Process all inventory items
    const processedList = inventoryState.map(processForecastItem);

    // 2. Apply Filters
    const searchVal = document.getElementById('filter-search').value.trim().toLowerCase();
    const centreVal = document.getElementById('filter-centre').value;
    const medVal = document.getElementById('filter-medicine').value;
    const urgencyVal = document.getElementById('filter-urgency').value;

    const filteredList = processedList.filter(item => {
        const matchesSearch = item.centreId.toLowerCase().includes(searchVal) ||
            item.medicineName.toLowerCase().includes(searchVal) ||
            (centreNames[item.centreId] && centreNames[item.centreId].toLowerCase().includes(searchVal));
        const matchesCentre = (centreVal === 'ALL' || item.centreId === centreVal);
        const matchesMed = (medVal === 'ALL' || item.medicineName === medVal);
        const matchesUrgency = (urgencyVal === 'ALL' || item.status === urgencyVal);

        return matchesSearch && matchesCentre && matchesMed && matchesUrgency;
    });

    // 3. Compute Redistribution Engine
    const { suggestedTransfers, districtRequirements } = computeRedistribution(processedList);

    // 4. Update Four Primary KPI Cards
    const uniqueCentres = new Set(processedList.map(i => i.centreId)).size;
    const totalMedicines = new Set(processedList.map(i => i.medicineName)).size;
    const lowStockCount = processedList.filter(i => i.status === 'CRITICAL' || i.status === 'WARNING').length;
    const criticalCount = processedList.filter(i => i.status === 'CRITICAL').length;
    const totalTransferUnits = suggestedTransfers.reduce((acc, t) => acc + t.transferQty, 0);
    const totalDistrictReqUnits = districtRequirements.reduce((acc, d) => acc + d.remainingDistrictReq, 0);

    let expiredBatchesCount = 0;
    batchState.forEach(b => {
        if (getDaysUntilExpiry(b.expiryDate) < 0) expiredBatchesCount++;
    });

    const elMedicines = document.getElementById('metric-medicines');
    if (elMedicines) elMedicines.textContent = totalMedicines;

    const elLowStock = document.getElementById('metric-low-stock');
    if (elLowStock) elLowStock.textContent = lowStockCount;

    const elCritical = document.getElementById('metric-critical');
    if (elCritical) elCritical.textContent = criticalCount;

    const elExpired = document.getElementById('metric-expired');
    if (elExpired) elExpired.textContent = expiredBatchesCount;

    const elCentres = document.getElementById('metric-centres');
    if (elCentres) elCentres.textContent = uniqueCentres;

    const elTransfers = document.getElementById('metric-transfers');
    if (elTransfers) elTransfers.textContent = suggestedTransfers.length;

    const elTransUnits = document.getElementById('metric-transfer-units');
    if (elTransUnits) elTransUnits.textContent = `${totalTransferUnits} units`;

    const elDistReq = document.getElementById('metric-district-req');
    if (elDistReq) elDistReq.textContent = `${totalDistrictReqUnits} units`;

    // 5. Render Overview / Needs Attention Table
    const tbodyOverview = document.getElementById('overview-tbody');
    if (tbodyOverview) {
        tbodyOverview.innerHTML = '';
        const needsAttentionItems = filteredList.filter(i => i.status === 'CRITICAL' || i.status === 'WARNING' || i.status === 'OUTDATED');
        const elAttn = document.getElementById('needs-attention-count');
        if (elAttn) elAttn.textContent = `${needsAttentionItems.length} items need attention`;

        if (needsAttentionItems.length === 0) {
            tbodyOverview.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #16a34a; padding: 2rem;"><i class="fa-solid fa-circle-check"></i> All Primary Health Centres are currently operating within safe stock levels!</td></tr>`;
        } else {
            needsAttentionItems.forEach(item => {
                const tr = document.createElement('tr');
                if (item.status === 'CRITICAL') tr.className = 'row-critical';
                if (item.status === 'OUTDATED') tr.className = 'row-outdated';

                let badgeClass = item.status === 'CRITICAL' ? 'badge-critical' : (item.status === 'WARNING' ? 'badge-warning' : 'badge-outdated');
                let actionText = item.status === 'CRITICAL' ? 'Execute Transfer / Order Stock' : (item.status === 'WARNING' ? 'Prepare Reorder' : 'Verify Physical Stock');

                tr.innerHTML = `
                    <td><span class="badge ${badgeClass}">${esc(item.status)}</span></td>
                    <td><strong>${esc(item.centreId)}</strong> <br><small style="color:#64748b;">${esc(centreNames[item.centreId] || '')}</small></td>
                    <td><strong>${esc(item.medicineName)}</strong></td>
                    <td><strong>${item.usableStock}</strong></td>
                    <td>${item.effectiveConsumption} / day <br><small style="color:#64748b; font-size:0.725rem;">${usageNote(item)}</small></td>
                    <td><strong>${item.daysRemaining === Infinity ? 'Infinite' : item.daysRemaining.toFixed(1) + 'd'}</strong></td>
                    <td>${esc(item.stockoutDate)}</td>
                    <td><small style="color:#475569;">${esc(item.riskReason)}</small></td>
                    <td><span class="btn btn-outline btn-sm">${esc(actionText)}</span></td>
                `;
                tbodyOverview.appendChild(tr);
            });
        }
    }

    // 6. Render Full Inventory Table
    const tbodyInv = document.getElementById('inventory-tbody');
    if (tbodyInv) {
        tbodyInv.innerHTML = '';
        const elInvCount = document.getElementById('inventory-count');
        if (elInvCount) elInvCount.textContent = `Showing ${filteredList.length} of ${processedList.length} items`;

        if (filteredList.length === 0) {
            tbodyInv.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #64748b; padding: 2rem;">No matching medicine stock records found.</td></tr>`;
        } else {
            filteredList.forEach(item => {
                const tr = document.createElement('tr');
                if (item.status === 'CRITICAL') tr.className = 'row-critical';
                if (item.status === 'OUTDATED') tr.className = 'row-outdated';

                let daysText = (item.daysRemaining === Infinity) ? 'Infinite (0 use)' : `${item.daysRemaining.toFixed(1)} days`;
                let badgeClass = item.status === 'CRITICAL' ? 'badge-critical' : (item.status === 'WARNING' ? 'badge-warning' : (item.status === 'OUTDATED' ? 'badge-outdated' : 'badge-safe'));

                tr.innerHTML = `
                    <td><strong>${esc(item.centreId)}</strong> <br><small style="color:#64748b;">${esc(centreNames[item.centreId] || '')}</small></td>
                    <td><strong>${esc(item.medicineName)}</strong></td>
                    <td><strong>${item.usableStock}</strong> <br><small style="color:#64748b;">(${item.currentStock} total)</small></td>
                    <td>${item.effectiveConsumption} / day <br><small style="color:#64748b; font-size:0.725rem;">${usageNote(item)}</small></td>
                    <td><strong>${esc(daysText)}</strong></td>
                    <td>${esc(item.stockoutDate)}</td>
                    <td>${item.targetCoverageDays}d (${item.targetStock} units)</td>
                    <td>${item.shortfall > 0 ? `<span style="color:#dc2626; font-weight:bold;">${item.shortfall} units</span>` : '<span style="color:#16a34a;">None</span>'}</td>
                    <td>
                        <span class="badge ${badgeClass}">${esc(item.status)}</span>
                        <br><small style="color:#64748b; font-size: 0.725rem;">${esc(item.riskReason)}</small>
                    </td>
                    <td>
                        <button class="btn btn-outline btn-sm btn-delete-item" data-id="${esc(item.id)}">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                `;
                tbodyInv.appendChild(tr);
            });

            document.querySelectorAll('.btn-delete-item').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const itemId = e.currentTarget.dataset.id;
                    showConfirmModal('Delete Inventory Record', 'Are you sure you want to delete this inventory record?', () => {
                        inventoryState = inventoryState.filter(i => i.id !== itemId);
                        markCustomDataActive();
                        saveStateToStorage();
                        renderDashboard();
                        showToast('Inventory record deleted successfully.', 'info');
                    });
                });
            });
        }
    }

    // 7. Render Redistribution Tables
    const tbodyTrans = document.getElementById('transfer-tbody');
    const tbodyTransTab = document.getElementById('transfer-tab-tbody');

    const renderTransRows = (containerEl) => {
        if (!containerEl) return;
        containerEl.innerHTML = '';
        if (suggestedTransfers.length === 0) {
            containerEl.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 2rem;">No surplus transfers required currently. All health centres operate within safe stock levels!</td></tr>`;
        } else {
            suggestedTransfers.forEach((t, idx) => {
                const tr = document.createElement('tr');
                let badgeClass = t.priority.includes('CRITICAL') ? 'badge-critical' : (t.priority.includes('OUTDATED') ? 'badge-outdated' : 'badge-warning');

                tr.innerHTML = `
                    <td><span class="badge ${badgeClass}">#${idx + 1} ${esc(t.priority)}</span></td>
                    <td>
                        <div class="transfer-route-box">
                            <span class="route-phc">${esc(t.donorCentre)}</span>
                            <span class="route-arrow"><i class="fa-solid fa-arrow-right"></i> ${t.distanceKm} km</span>
                            <span class="route-phc">${esc(t.recipientCentre)}</span>
                        </div>
                    </td>
                    <td><strong>${esc(t.medicineName)}</strong></td>
                    <td>${t.distanceKm} km</td>
                    <td><strong style="color:#0284c7; font-size: 0.95rem;">${t.transferQty} units</strong></td>
                    <td><small style="color:#475569;">${esc(t.reasoning)}</small></td>
                    <td>
                        <button class="btn btn-success btn-sm btn-exec-transfer" 
                            data-donor="${esc(t.donorCentre)}" 
                            data-recipient="${esc(t.recipientCentre)}" 
                            data-medicine="${esc(t.medicineName)}" 
                            data-qty="${t.transferQty}">
                            <i class="fa-solid fa-truck-arrow-right"></i> Execute Transfer
                        </button>
                    </td>
                `;
                containerEl.appendChild(tr);
            });
        }
    };

    renderTransRows(tbodyTrans);
    renderTransRows(tbodyTransTab);

    document.querySelectorAll('.btn-exec-transfer').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const { donor, recipient, medicine, qty } = e.currentTarget.dataset;
            const transferQty = parseInt(qty, 10);
            const recipientItem = inventoryState.find(i => i.centreId === recipient && i.medicineName === medicine);
            const isOutdated = recipientItem && getDaysSince(recipientItem.lastUpdated) > 14;

            const msg = isOutdated ?
                `⚠️ WARNING: Recipient ${recipient} inventory record is outdated (>14 days). Physical stock audit is recommended. Are you sure you want to execute transfer of ${transferQty} units of ${medicine} from ${donor}?` :
                `Confirm execution of stock transfer: ${transferQty} units of ${medicine} from ${donor} to ${recipient}?`;

            showConfirmModal('Review Stock Transfer', msg, () => {
                executeTransfer(donor, recipient, medicine, transferQty);
            });
        });
    });

    // 8. Render District Procurement Requirements Table
    const tbodyDist = document.getElementById('district-tbody');
    if (tbodyDist) {
        tbodyDist.innerHTML = '';
        if (districtRequirements.length === 0) {
            tbodyDist.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #16a34a; padding: 2rem;"><i class="fa-solid fa-circle-check"></i> No additional district procurement required. All shortfalls covered by safe PHC transfers!</td></tr>`;
        } else {
            districtRequirements.forEach(d => {
                const tr = document.createElement('tr');
                let badgeClass = d.status === 'CRITICAL' ? 'badge-critical' : (d.status === 'OUTDATED' ? 'badge-outdated' : 'badge-warning');

                tr.innerHTML = `
                    <td><strong>${esc(d.centreId)}</strong></td>
                    <td><strong>${esc(d.medicineName)}</strong></td>
                    <td>${d.totalShortfall} units</td>
                    <td>${d.coveredBySurplus} units</td>
                    <td><strong style="color:#dc2626; font-size: 0.95rem;">${d.remainingDistrictReq} units</strong></td>
                    <td>
                        <span class="badge ${badgeClass}">${esc(d.status)}</span>
                        ${d.isOutdated ? '<br><small style="color:#7e22ce;">(Manual Audit Needed)</small>' : ''}
                    </td>
                `;
                tbodyDist.appendChild(tr);
            });
        }
    }

    // 9. Render Live Operational Alerts Feed
    renderAlertsFeed(processedList, suggestedTransfers);

    // 10. Render Auxiliary Views
    renderBatchTable();
    renderFacilityRiskMatrix(processedList);
    renderSimulator(processedList);
    renderDistanceMatrix();
}

/**
 * Render PHC Distance Matrix Table
 */
function renderDistanceMatrix() {
    const table = document.getElementById('distance-matrix-table');
    if (!table) return;
    const centres = Object.keys(distanceMatrix);

    let html = `<thead><tr><th>PHC Centre</th>`;
    centres.forEach(c => { html += `<th>${esc(c)}</th>`; });
    html += `</tr></thead><tbody>`;

    centres.forEach(rowC => {
        html += `<tr><td><strong>${esc(rowC)}</strong></td>`;
        centres.forEach(colC => {
            const dist = distanceMatrix[rowC][colC];
            if (rowC === colC) {
                html += `<td class="matrix-self">0 km</td>`;
            } else {
                html += `<td class="matrix-dist">${dist} km</td>`;
            }
        });
        html += `</tr>`;
    });
    html += `</tbody>`;
    table.innerHTML = html;
}

/**
 * Populate Dropdowns
 */
function populateDropdowns() {
    const centreSelects = [
        document.getElementById('filter-centre'),
        document.getElementById('modal-centre'),
        document.getElementById('modal-batch-centre')
    ];

    const medSelects = [
        document.getElementById('filter-medicine'),
        document.getElementById('modal-batch-medicine')
    ];

    const centres = Object.keys(centreNames);
    centreSelects.forEach(sel => {
        if (!sel) return;
        const isFilter = sel.id === 'filter-centre';
        sel.innerHTML = isFilter ? '<option value="ALL">All Health Centres</option>' : '';
        centres.forEach(c => {
            sel.innerHTML += `<option value="${esc(c)}">${esc(c)} - ${esc(centreNames[c])}</option>`;
        });
    });

    const medicines = Array.from(new Set(inventoryState.map(i => i.medicineName)));
    medSelects.forEach(sel => {
        if (!sel) return;
        const isFilter = sel.id === 'filter-medicine';
        sel.innerHTML = isFilter ? '<option value="ALL">All Medicines</option>' : '';
        medicines.forEach(m => {
            sel.innerHTML += `<option value="${esc(m)}">${esc(m)}</option>`;
        });
    });
}

/**
 * DEMO SCENARIO LOADER (Fixed & Reliable)
 */
function loadDemoScenario() {
    inventoryState = [
        {
            id: 'DEMO-A',
            centreId: 'Centre A',
            medicineName: 'Paracetamol Syrup (100ml)',
            currentStock: 60,
            dailyConsumption: 10,
            targetCoverageDays: 30,
            lastUpdated: getPastDateString(0)
        },
        {
            id: 'DEMO-C',
            centreId: 'Centre C',
            medicineName: 'Paracetamol Syrup (100ml)',
            currentStock: 200,
            dailyConsumption: 2,
            targetCoverageDays: 30,
            lastUpdated: getPastDateString(0)
        },
        {
            id: 'DEMO-B',
            centreId: 'Centre B',
            medicineName: 'Amoxicillin 500mg Capsules',
            currentStock: 400,
            dailyConsumption: 10,
            targetCoverageDays: 30,
            lastUpdated: getPastDateString(1)
        },
        {
            id: 'DEMO-D',
            centreId: 'Centre D',
            medicineName: 'ORS Electrolyte Packets',
            currentStock: 500,
            dailyConsumption: 5,
            targetCoverageDays: 30,
            lastUpdated: getPastDateString(2)
        }
    ];

    batchState = [
        {
            id: 'DEMO-BAT-A',
            batchNumber: 'BATCH-2026-P01',
            centreId: 'Centre A',
            medicineName: 'Paracetamol Syrup (100ml)',
            quantity: 60,
            expiryDate: getFutureDateString(180)
        },
        {
            id: 'DEMO-BAT-C',
            batchNumber: 'BATCH-2026-P02',
            centreId: 'Centre C',
            medicineName: 'Paracetamol Syrup (100ml)',
            quantity: 200,
            expiryDate: getFutureDateString(240)
        },
        {
            id: 'BAT-003',
            batchNumber: 'BATCH-2025-A99',
            centreId: 'Centre A',
            medicineName: 'Amoxicillin 500mg Capsules',
            quantity: 30,
            expiryDate: getPastDateString(10) // EXPIRED
        },
        {
            id: 'BAT-004',
            batchNumber: 'BATCH-2026-O15',
            centreId: 'Centre C',
            medicineName: 'ORS Electrolyte Packets',
            quantity: 50,
            expiryDate: getFutureDateString(35)
        }
    ];

    saveStateToStorage();
    markDemoDataActive();

    document.getElementById('filter-search').value = '';
    document.getElementById('filter-centre').value = 'ALL';
    document.getElementById('filter-medicine').value = 'ALL';
    document.getElementById('filter-urgency').value = 'ALL';
    document.getElementById('input-lead-time').value = '10';
    leadTimeDays = 10;

    populateDropdowns();
    renderDashboard();

    switchTab('tab-overview');

    showToast('⚡ Benchmark Demo Scenario Loaded! (Centre A: 6 days stock, Centre C: 140 safe surplus)', 'warning');
}

/**
 * Reset Data to Factory Seed
 */
function resetData() {
    inventoryState = JSON.parse(JSON.stringify(initialInventorySeed));
    batchState = JSON.parse(JSON.stringify(initialBatchSeed));
    localStorage.removeItem('aushadhi_inventory_state');
    localStorage.removeItem('aushadhi_batch_state');
    markDemoDataActive();

    document.getElementById('filter-search').value = '';
    document.getElementById('filter-centre').value = 'ALL';
    document.getElementById('filter-medicine').value = 'ALL';
    document.getElementById('filter-urgency').value = 'ALL';
    document.getElementById('input-lead-time').value = '10';
    leadTimeDays = 10;

    populateDropdowns();
    renderDashboard();
    showToast('Application state reset to factory seed data.', 'info');
}

/**
 * Toast Notification System with Safe Removal
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let iconClass = type === 'success' ? 'fa-circle-check' : (type === 'warning' ? 'fa-triangle-exclamation' : (type === 'error' ? 'fa-circle-xmark' : 'fa-info-circle'));

    toast.innerHTML = `<i class="fa-solid ${iconClass}"></i> <span>${esc(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (typeof toast.remove === 'function') {
                toast.remove();
            } else if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 4000);
}

/**
 * Custom Confirmation Modal
 */
let pendingConfirmAction = null;
function showConfirmModal(title, message, onConfirm) {
    document.getElementById('confirm-title').innerHTML = `<i class="fa-solid fa-circle-question"></i> ${esc(title)}`;
    document.getElementById('confirm-message').textContent = message;
    pendingConfirmAction = onConfirm;

    const modal = document.getElementById('modal-confirm');
    modal.classList.add('open');
}

function closeConfirmModal() {
    const modal = document.getElementById('modal-confirm');
    modal.classList.remove('open');
    pendingConfirmAction = null;
}

/**
 * Tab Navigation
 */
function switchTab(tabId) {
    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === tabId);
    });
}

/**
 * Event Initialization
 */
document.addEventListener('DOMContentLoaded', () => {
    populateDropdowns();
    renderDashboard();

    document.getElementById('input-lead-time').addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val > 0) {
            leadTimeDays = val;
            renderDashboard();
        }
    });

    document.getElementById('filter-search').addEventListener('input', renderDashboard);
    document.getElementById('filter-centre').addEventListener('change', renderDashboard);
    document.getElementById('filter-medicine').addEventListener('change', renderDashboard);
    document.getElementById('filter-urgency').addEventListener('change', renderDashboard);

    document.getElementById('btn-demo').addEventListener('click', () => {
        showConfirmModal('Load Demo Data', 'Do you want to load demo data?', () => {
            loadDemoScenario();
        });
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
        showConfirmModal('Reset Application Data', 'Are you sure you want to reset all inventory and batch records to initial factory seed?', () => {
            resetData();
        });
    });

    document.getElementById('btn-action-confirm').addEventListener('click', () => {
        if (pendingConfirmAction) pendingConfirmAction();
        closeConfirmModal();
    });
    document.getElementById('btn-cancel-confirm').addEventListener('click', closeConfirmModal);
    document.getElementById('btn-close-confirm').addEventListener('click', closeConfirmModal);

    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    ['sim-demand-multiplier', 'sim-delay-days', 'sim-supply-shock'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            const processedList = inventoryState.map(processForecastItem);
            renderSimulator(processedList);
        });
    });

    document.getElementById('btn-reset-sim').addEventListener('click', () => {
        document.getElementById('sim-demand-multiplier').value = '1.0';
        document.getElementById('sim-delay-days').value = '0';
        document.getElementById('sim-supply-shock').value = '0';
        const processedList = inventoryState.map(processForecastItem);
        renderSimulator(processedList);
        showToast('Simulator parameters reset to baseline.', 'info');
    });

    // Inventory Modal Controls
    const modalStock = document.getElementById('modal-stock');
    const btnOpenStockModal = document.getElementById('btn-add-modal');
    const formStock = document.getElementById('form-stock');

    btnOpenStockModal.addEventListener('click', () => {
        modalStock.classList.add('open');
        document.getElementById('modal-last-updated').value = new Date().toISOString().split('T')[0];
    });

    document.querySelectorAll('#modal-stock .btn-close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            modalStock.classList.remove('open');
            formStock.reset();
        });
    });

    formStock.addEventListener('submit', (e) => {
        e.preventDefault();

        const centreId = document.getElementById('modal-centre').value;
        const medicineName = document.getElementById('modal-medicine').value.trim();
        const currentStock = parseFloat(document.getElementById('modal-stock-qty').value);
        const dailyConsumption = parseFloat(document.getElementById('modal-daily-cons').value);
        const targetCoverageDays = parseInt(document.getElementById('modal-target-days').value, 10);
        const lastUpdated = document.getElementById('modal-last-updated').value;

        if (!medicineName || isNaN(currentStock) || currentStock < 0 || isNaN(dailyConsumption) || dailyConsumption < 0 || isNaN(targetCoverageDays) || targetCoverageDays <= 0 || !lastUpdated) {
            showToast('Validation Error: Please enter valid non-negative numbers and a valid date.', 'error');
            return;
        }

        const existingIdx = inventoryState.findIndex(i =>
            i.centreId === centreId &&
            i.medicineName.toLowerCase() === medicineName.toLowerCase()
        );

        if (existingIdx >= 0) {
            inventoryState[existingIdx].currentStock = currentStock;
            inventoryState[existingIdx].dailyConsumption = dailyConsumption;
            inventoryState[existingIdx].targetCoverageDays = targetCoverageDays;
            inventoryState[existingIdx].lastUpdated = lastUpdated;
            recordHistory(inventoryState[existingIdx], 0, lastUpdated);
            showToast(`Updated stock record for ${medicineName} at ${centreId}.`, 'success');
        } else {
            const newItem = {
                id: `INV-${Date.now()}`,
                centreId,
                medicineName,
                currentStock,
                dailyConsumption,
                targetCoverageDays,
                lastUpdated
            };
            recordHistory(newItem, 0, lastUpdated);
            inventoryState.push(newItem);
            showToast(`Added new stock record for ${medicineName} at ${centreId}.`, 'success');
        }

        markCustomDataActive();
        saveStateToStorage();
        populateDropdowns();
        renderDashboard();
        modalStock.classList.remove('open');
        formStock.reset();
    });

    // Batch Modal Controls
    const modalBatch = document.getElementById('modal-batch');
    const btnOpenBatchModal = document.getElementById('btn-add-batch-modal');
    const formBatch = document.getElementById('form-batch');

    if (btnOpenBatchModal) {
        btnOpenBatchModal.addEventListener('click', () => {
            modalBatch.classList.add('open');
            document.getElementById('modal-batch-expiry').value = getFutureDateString(180);
        });
    }

    ['btn-close-batch-modal', 'btn-cancel-batch'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                modalBatch.classList.remove('open');
                formBatch.reset();
            });
        }
    });

    formBatch.addEventListener('submit', (e) => {
        e.preventDefault();

        const centreId = document.getElementById('modal-batch-centre').value;
        const medicineName = document.getElementById('modal-batch-medicine').value;
        const batchNumber = document.getElementById('modal-batch-num').value.trim();
        const quantity = parseInt(document.getElementById('modal-batch-qty').value, 10);
        const expiryDate = document.getElementById('modal-batch-expiry').value;

        if (!batchNumber || isNaN(quantity) || quantity <= 0 || !expiryDate) {
            showToast('Validation Error: Please provide a valid batch number, positive quantity, and expiry date.', 'error');
            return;
        }

        batchState.push({
            id: `BAT-${Date.now()}`,
            batchNumber,
            centreId,
            medicineName,
            quantity,
            expiryDate
        });

        markCustomDataActive();
        saveStateToStorage();
        renderDashboard();
        modalBatch.classList.remove('open');
        formBatch.reset();

        showToast(`Registered batch ${batchNumber} (${quantity} units) for ${medicineName}.`, 'success');
    });
});
