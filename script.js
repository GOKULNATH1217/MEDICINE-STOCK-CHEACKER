/**
 * ============================================================================
 * MEDI-CARE: PHC MEDICINE STOCK-OUT EARLY WARNING & REDISTRIBUTION ENGINE
 * ============================================================================
 * Vanilla JavaScript Implementation for Hackathon Prototype.
 * Pitch: "Count the days, then look sideways before you look up."
 * 
 * CORE ALGORITHMIC FORMULAS & WORKFLOWS:
 * 1. Usable Stock = Total Physical Stock - Expired Batch Stock (Deducted exactly once)
 * 2. Days Remaining = Usable Stock / Average Daily Consumption (0 if Usable Stock == 0, Infinity if consumption == 0)
 * 3. Target Stock = Average Daily Consumption * Target Coverage Days
 * 4. Shortfall = Max(0, Target Stock - Usable Stock)
 * 5. Donor Safe Surplus = Max(0, Usable Stock - Target Stock)
 * 6. Greedy Inter-PHC Redistribution:
 *    - Route visualization: Donor PHC → Distance (km) → Recipient PHC
 *    - Never allocates outdated donor stock (>14 days).
 *    - Shows side-by-side impact on BOTH recipient and donor centres before execution.
 *    - Requires Medical Officer approval (PIN 1234) before stock moves.
 *    - Synchronizes batch quantities upon transfer execution.
 * 7. Procurement Deficit: Displays ONLY items with remaining district requirement > 0!
 * ============================================================================
 */

// --- Global Date & Security Helpers ---

function toLocalISO(d) {
    const date = d || new Date();
    const p = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

function parseLocalDate(dateStr) {
    if (!dateStr) return new Date();
    const parts = String(dateStr).split('-');
    if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        return new Date(y, m, d, 0, 0, 0, 0);
    }
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
}

function getPastDateString(daysAgo) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - daysAgo);
    return toLocalISO(d);
}

function getFutureDateString(daysAhead) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + daysAhead);
    return toLocalISO(d);
}

function getDaysSince(dateStr) {
    if (!dateStr) return 999;
    const updated = parseLocalDate(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = today - updated;
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function getDaysUntilExpiry(expiryDateStr) {
    if (!expiryDateStr) return 0;
    const expiry = parseLocalDate(expiryDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = expiry - today;
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const parts = String(dateStr).split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
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

// Initial Seed Data (Simulated Fictional Data)
const initialInventorySeed = [
    {
        id: 'INV-001',
        centreId: 'Centre A',
        medicineName: 'Paracetamol Syrup (100ml)',
        currentStock: 40,
        dailyConsumption: 8,
        targetCoverageDays: 30,
        lastUpdated: getPastDateString(2),
        lastTransferAt: null
    },
    {
        id: 'INV-002',
        centreId: 'Centre B',
        medicineName: 'Paracetamol Syrup (100ml)',
        currentStock: 250,
        dailyConsumption: 5,
        targetCoverageDays: 30,
        lastUpdated: getPastDateString(1),
        lastTransferAt: null
    },
    {
        id: 'INV-003',
        centreId: 'Centre C',
        medicineName: 'Paracetamol Syrup (100ml)',
        currentStock: 180,
        dailyConsumption: 3,
        targetCoverageDays: 30,
        lastUpdated: getPastDateString(0),
        lastTransferAt: null
    },
    {
        id: 'INV-004',
        centreId: 'Centre A',
        medicineName: 'Amoxicillin 500mg Capsules',
        currentStock: 120,
        dailyConsumption: 15,
        targetCoverageDays: 30,
        lastUpdated: getPastDateString(18), // Outdated record (>14 days)
        lastTransferAt: null
    },
    {
        id: 'INV-005',
        centreId: 'Centre B',
        medicineName: 'Amoxicillin 500mg Capsules',
        currentStock: 500,
        dailyConsumption: 10,
        targetCoverageDays: 30,
        lastUpdated: getPastDateString(3),
        lastTransferAt: null
    },
    {
        id: 'INV-006',
        centreId: 'Centre C',
        medicineName: 'ORS Electrolyte Packets',
        currentStock: 50,
        dailyConsumption: 12,
        targetCoverageDays: 30,
        lastUpdated: getPastDateString(1),
        lastTransferAt: null
    },
    {
        id: 'INV-007',
        centreId: 'Centre D',
        medicineName: 'ORS Electrolyte Packets',
        currentStock: 450,
        dailyConsumption: 6,
        targetCoverageDays: 30,
        lastUpdated: getPastDateString(0),
        lastTransferAt: null
    },
    {
        id: 'INV-008',
        centreId: 'Centre A',
        medicineName: 'Metformin 500mg Tablets',
        currentStock: 300,
        dailyConsumption: 0, // Zero consumption test case
        targetCoverageDays: 30,
        lastUpdated: getPastDateString(4),
        lastTransferAt: null
    },
    {
        id: 'INV-009',
        centreId: 'Centre D',
        medicineName: 'Amlodipine 5mg Tablets',
        currentStock: 60,
        dailyConsumption: 7,
        targetCoverageDays: 30,
        lastUpdated: getPastDateString(2),
        lastTransferAt: null
    },
    {
        id: 'INV-010',
        centreId: 'Centre B',
        medicineName: 'Amlodipine 5mg Tablets',
        currentStock: 350,
        dailyConsumption: 4,
        targetCoverageDays: 30,
        lastUpdated: getPastDateString(1),
        lastTransferAt: null
    },
    {
        id: 'INV-011',
        centreId: 'Centre C',
        medicineName: 'Artemether Injection (80mg)',
        currentStock: 15,
        dailyConsumption: 3,
        targetCoverageDays: 30,
        lastUpdated: getPastDateString(2),
        lastTransferAt: null
    },
    {
        id: 'INV-012',
        centreId: 'Centre D',
        medicineName: 'Artemether Injection (80mg)',
        currentStock: 120,
        dailyConsumption: 2,
        targetCoverageDays: 30,
        lastUpdated: getPastDateString(0),
        lastTransferAt: null
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

// Persistent State Loaders with Graceful Migration
function loadSavedInventory() {
    const saved = localStorage.getItem('medicare_inventory_state') || localStorage.getItem('aushadhi_inventory_state');
    if (saved) {
        try { return JSON.parse(saved); } catch (e) { console.error('Error parsing saved inventory', e); }
    }
    return JSON.parse(JSON.stringify(initialInventorySeed));
}

function loadSavedBatches() {
    const saved = localStorage.getItem('medicare_batch_state') || localStorage.getItem('aushadhi_batch_state');
    if (saved) {
        try { return JSON.parse(saved); } catch (e) { console.error('Error parsing saved batches', e); }
    }
    return JSON.parse(JSON.stringify(initialBatchSeed));
}

function loadSavedPendingRequests() {
    const saved = localStorage.getItem('medicare_pending_requests');
    if (saved) {
        try { return JSON.parse(saved); } catch (e) { console.error('Error parsing pending requests', e); }
    }
    return [];
}

function loadSavedAuditLog() {
    const saved = localStorage.getItem('medicare_audit_log');
    if (saved) {
        try { return JSON.parse(saved); } catch (e) { console.error('Error parsing audit log', e); }
    }
    return [];
}

// Active Application State
let inventoryState = loadSavedInventory();
let batchState = loadSavedBatches();
let pendingRequestsState = loadSavedPendingRequests();
let auditLogState = loadSavedAuditLog();

function saveStateToStorage() {
    localStorage.setItem('medicare_inventory_state', JSON.stringify(inventoryState));
    localStorage.setItem('medicare_batch_state', JSON.stringify(batchState));
    localStorage.setItem('medicare_pending_requests', JSON.stringify(pendingRequestsState));
    localStorage.setItem('medicare_audit_log', JSON.stringify(auditLogState));
}

function logAuditAction(action, officer, route, medicine, qty, note = '') {
    const entry = {
        id: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: `${toLocalISO(new Date())} ${new Date().toLocaleTimeString('en-GB')}`,
        action,
        officer: officer || 'System',
        route,
        medicine,
        qty,
        note: note || 'N/A'
    };
    auditLogState.unshift(entry);
    saveStateToStorage();
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
 * Medicine Expiry Utility
 * Strictly EXCLUDES expired batch quantities (daysLeft < 0) from usable stock.
 * Near-expiry batches (0 <= daysLeft <= 60) remain usable.
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

    // Deduct expired batch stock from usable stock
    const { expiredQty, nearExpiryQty } = getItemBatchAnalysis(item.centreId, item.medicineName);
    const usableStock = Math.max(0, item.currentStock - expiredQty);

    // Estimated Days Remaining handling zero stock & zero consumption
    let daysRemaining;
    if (item.dailyConsumption <= 0) {
        daysRemaining = Infinity;
    } else if (usableStock === 0) {
        daysRemaining = 0;
    } else {
        daysRemaining = usableStock / item.dailyConsumption;
    }

    // Shortfall & Target Stock
    const targetStock = item.dailyConsumption * item.targetCoverageDays;
    const shortfall = Math.max(0, Math.round(targetStock - usableStock));

    // Donor Safe Surplus
    const safetyStock = item.dailyConsumption * item.targetCoverageDays;
    const rawSurplus = Math.max(0, Math.round(usableStock - safetyStock));
    const donorSurplus = isOutdated ? 0 : rawSurplus;

    // Risk Classification & Human-Readable Reason
    let status = 'SAFE';
    let riskReason = '';

    if (isOutdated) {
        status = 'OUTDATED';
        riskReason = `Record updated ${daysSinceUpdate}d ago (>14d). Physical audit recommended.`;
    } else if (usableStock === 0 && item.dailyConsumption > 0) {
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
        usableStock,
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
 * Compute transfer impact matrix for both recipient and donor
 */
function computeTransferImpact(donorCentre, recipientCentre, medicineName, qty) {
    const processedAll = inventoryState.map(processForecastItem);

    // Recipient before & projected after
    const recBefore = processedAll.find(i => i.centreId === recipientCentre && i.medicineName === medicineName) || {
        centreId: recipientCentre,
        medicineName: medicineName,
        usableStock: 0,
        currentStock: 0,
        dailyConsumption: 5,
        targetCoverageDays: 30,
        daysRemaining: 0,
        status: 'CRITICAL',
        shortfall: 150,
        isOutdated: false
    };

    const recAfterStock = recBefore.usableStock + qty;
    const recAfterDays = recBefore.dailyConsumption > 0 ? recAfterStock / recBefore.dailyConsumption : Infinity;
    const recTarget = recBefore.dailyConsumption * recBefore.targetCoverageDays;
    const recAfterShortfall = Math.max(0, Math.round(recTarget - recAfterStock));
    let recAfterStatus = 'SAFE';
    if (recBefore.isOutdated) recAfterStatus = 'OUTDATED';
    else if (recAfterStock === 0 && recBefore.dailyConsumption > 0) recAfterStatus = 'CRITICAL';
    else if (recAfterDays <= leadTimeDays) recAfterStatus = 'CRITICAL';
    else if (recAfterDays <= leadTimeDays * 1.5) recAfterStatus = 'WARNING';

    // Donor before & projected after
    const donorBefore = processedAll.find(i => i.centreId === donorCentre && i.medicineName === medicineName);
    const donorAfterStock = donorBefore ? Math.max(0, donorBefore.usableStock - qty) : 0;
    const donorAfterDays = (donorBefore && donorBefore.dailyConsumption > 0) ? donorAfterStock / donorBefore.dailyConsumption : Infinity;
    const donorTarget = donorBefore ? donorBefore.dailyConsumption * donorBefore.targetCoverageDays : 0;
    const donorAfterSurplus = Math.max(0, Math.round(donorAfterStock - donorTarget));
    let donorAfterStatus = 'SAFE';
    if (donorBefore && donorBefore.isOutdated) donorAfterStatus = 'OUTDATED';
    else if (donorAfterStock === 0 && donorBefore && donorBefore.dailyConsumption > 0) donorAfterStatus = 'CRITICAL';
    else if (donorAfterDays <= leadTimeDays) donorAfterStatus = 'CRITICAL';
    else if (donorAfterDays <= leadTimeDays * 1.5) donorAfterStatus = 'WARNING';

    return {
        recipient: {
            centre: recipientCentre,
            isOutdated: recBefore.isOutdated,
            stockBefore: recBefore.usableStock,
            stockAfter: recAfterStock,
            daysBefore: recBefore.daysRemaining,
            daysAfter: recAfterDays,
            statusBefore: recBefore.status,
            statusAfter: recAfterStatus,
            shortfallBefore: recBefore.shortfall,
            shortfallAfter: recAfterShortfall
        },
        donor: {
            centre: donorCentre,
            isOutdated: donorBefore ? donorBefore.isOutdated : false,
            stockBefore: donorBefore ? donorBefore.usableStock : 0,
            stockAfter: donorAfterStock,
            daysBefore: donorBefore ? donorBefore.daysRemaining : 0,
            daysAfter: donorAfterDays,
            statusBefore: donorBefore ? donorBefore.status : 'SAFE',
            statusAfter: donorAfterStatus,
            surplusBefore: donorBefore ? donorBefore.donorSurplus : 0,
            surplusAfter: donorAfterSurplus
        }
    };
}

function impactHtml(impact) {
    const formatDays = d => (d === Infinity ? 'Infinite' : `${d.toFixed(1)}d`);
    const badgeClass = s => (s === 'CRITICAL' ? 'badge-critical' : (s === 'WARNING' ? 'badge-warning' : (s === 'OUTDATED' ? 'badge-outdated' : 'badge-safe')));

    return `
        <div class="impact-grid">
            <div class="impact-card recipient-card">
                <h5><i class="fa-solid fa-hospital-user"></i> Recipient: ${esc(impact.recipient.centre)}</h5>
                <div class="impact-row"><span>Usable Stock:</span> <strong>${impact.recipient.stockBefore} → ${impact.recipient.stockAfter} units</strong></div>
                <div class="impact-row"><span>Days Left:</span> <strong>${formatDays(impact.recipient.daysBefore)} → ${formatDays(impact.recipient.daysAfter)}</strong></div>
                <div class="impact-row"><span>Status:</span> <div><span class="badge ${badgeClass(impact.recipient.statusBefore)}">${esc(impact.recipient.statusBefore)}</span> <i class="fa-solid fa-arrow-right"></i> <span class="badge ${badgeClass(impact.recipient.statusAfter)}">${esc(impact.recipient.statusAfter)}</span></div></div>
                <div class="impact-row"><span>Shortfall:</span> <strong>${impact.recipient.shortfallBefore} → ${impact.recipient.shortfallAfter} units</strong></div>
            </div>
            <div class="impact-card donor-card">
                <h5><i class="fa-solid fa-hand-holding-medical"></i> Donor: ${esc(impact.donor.centre)}</h5>
                <div class="impact-row"><span>Usable Stock:</span> <strong>${impact.donor.stockBefore} → ${impact.donor.stockAfter} units</strong></div>
                <div class="impact-row"><span>Days Left:</span> <strong>${formatDays(impact.donor.daysBefore)} → ${formatDays(impact.donor.daysAfter)}</strong></div>
                <div class="impact-row"><span>Status:</span> <div><span class="badge ${badgeClass(impact.donor.statusBefore)}">${esc(impact.donor.statusBefore)}</span> <i class="fa-solid fa-arrow-right"></i> <span class="badge ${badgeClass(impact.donor.statusAfter)}">${esc(impact.donor.statusAfter)}</span></div></div>
                <div class="impact-row"><span>Safe Surplus:</span> <strong>${impact.donor.surplusBefore} → ${impact.donor.surplusAfter} units</strong></div>
            </div>
        </div>
        ${impact.recipient.isOutdated ? `<div class="impact-warning-box"><i class="fa-solid fa-triangle-exclamation"></i> <strong>Physical Audit Warning:</strong> Recipient inventory record is >14 days old. A physical stock audit is recommended prior to transfer execution.</div>` : ''}
    `;
}

function impactCompactHtml(impact) {
    const formatDays = d => (d === Infinity ? 'Infinite' : `${d.toFixed(1)}d`);
    return `
        <div class="impact-preview-cell">
            <div class="impact-preview-row">
                <span class="impact-tag impact-recipient-tag">Recip</span>
                <span>${esc(impact.recipient.centre)}: ${impact.recipient.stockBefore}→${impact.recipient.stockAfter} units (${formatDays(impact.recipient.daysBefore)}→${formatDays(impact.recipient.daysAfter)})</span>
            </div>
            <div class="impact-preview-row">
                <span class="impact-tag impact-donor-tag">Donor</span>
                <span>${esc(impact.donor.centre)}: ${impact.donor.stockBefore}→${impact.donor.stockAfter} units (${formatDays(impact.donor.daysBefore)}→${formatDays(impact.donor.daysAfter)})</span>
            </div>
        </div>
    `;
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
            const impact = computeTransferImpact(donorItem.centreId, recipient.centreId, recipient.medicineName, transferAmount);
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
                impact,
                reasoning
            });

            surplusTracker[donorItem.id] -= transferAmount;
            neededQty -= transferAmount;
            totalAllocatedForRecipient += transferAmount;
        });

        // Calculate remaining district requirement
        const remainingDistrictReq = recipient.shortfall - totalAllocatedForRecipient;
        // REQUIREMENT: Only list procurement rows where remaining requirement > 0!
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
 * Execute Approved Transfer (Updates stock & syncs batches upon Medical Officer approval)
 * Requirement 4: DO NOT touch lastUpdated on transfer! Set lastTransferAt instead.
 */
function executeApprovedTransfer(donorCentre, recipientCentre, medicineName, qty) {
    const donorIdx = inventoryState.findIndex(i => i.centreId === donorCentre && i.medicineName === medicineName);
    let recipientIdx = inventoryState.findIndex(i => i.centreId === recipientCentre && i.medicineName === medicineName);

    if (donorIdx < 0) {
        showToast('Error: Donor inventory record not found.', 'error');
        return false;
    }

    if (inventoryState[donorIdx].currentStock < qty) {
        showToast('Error: Donor PHC does not have enough physical stock to complete transfer.', 'error');
        return false;
    }

    // Check valid non-expired batch availability
    const { matchingBatches, validBatchQty } = getItemBatchAnalysis(donorCentre, medicineName);
    if (matchingBatches.length > 0 && validBatchQty < qty) {
        showToast(`Transfer rejected: Donor PHC has only ${validBatchQty} units in valid non-expired batches (requested ${qty} units).`, 'error');
        return false;
    }

    // Re-verify donor surplus before executing
    const donorProcessed = processForecastItem(inventoryState[donorIdx]);
    if (donorProcessed.donorSurplus < qty) {
        showToast(`Warning: Re-validation check failed. Donor safe surplus is currently ${donorProcessed.donorSurplus} units.`, 'warning');
        return false;
    }

    const todayIso = toLocalISO(new Date());

    // Deduct stock from Donor (DO NOT update lastUpdated, update lastTransferAt)
    inventoryState[donorIdx].currentStock -= qty;
    inventoryState[donorIdx].lastTransferAt = todayIso;

    // Credit stock to Recipient (DO NOT update lastUpdated, update lastTransferAt)
    if (recipientIdx >= 0) {
        inventoryState[recipientIdx].currentStock += qty;
        inventoryState[recipientIdx].lastTransferAt = todayIso;
    } else {
        inventoryState.push({
            id: `INV-${Date.now()}`,
            centreId: recipientCentre,
            medicineName: medicineName,
            currentStock: qty,
            dailyConsumption: inventoryState[donorIdx].dailyConsumption || 5,
            targetCoverageDays: inventoryState[donorIdx].targetCoverageDays || 30,
            lastUpdated: todayIso,
            lastTransferAt: todayIso
        });
    }

    // Batch Synchronization: Move valid batch quantities from Donor to Recipient
    let remainingToMove = qty;
    const donorBatches = batchState.filter(b =>
        b.centreId === donorCentre &&
        b.medicineName.toLowerCase() === medicineName.toLowerCase() &&
        getDaysUntilExpiry(b.expiryDate) >= 0
    );

    donorBatches.forEach(b => {
        if (remainingToMove <= 0) return;
        const moveQty = Math.min(b.quantity, remainingToMove);
        b.quantity -= moveQty;
        remainingToMove -= moveQty;

        // Add transferred batch record to Recipient
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

    saveStateToStorage();
    return true;
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
                <span class="badge ${riskBadgeClass}">${esc(riskLabel)}</span>
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
 * Render What-If Supply Chain Simulator (Step 7: Checkbox to assume suggested transfers executed)
 */
function renderSimulator(processedInventory) {
    const demandMult = parseFloat(document.getElementById('sim-demand-multiplier').value);
    const delayDays = parseInt(document.getElementById('sim-delay-days').value, 10);
    const shockPercent = parseInt(document.getElementById('sim-supply-shock').value, 10);
    const assumeTransfers = document.getElementById('sim-assume-transfers').checked;

    document.getElementById('val-demand-multiplier').textContent = `${demandMult.toFixed(1)}x`;
    document.getElementById('val-delay-days').textContent = `+${delayDays} days`;
    document.getElementById('val-supply-shock').textContent = `${shockPercent}%`;

    const banner = document.getElementById('sim-impact-summary');
    const tbody = document.getElementById('sim-tbody');
    tbody.innerHTML = '';

    // Calculate baseline transfers
    const { suggestedTransfers } = computeRedistribution(processedInventory);

    // Create a copy of inventory items for simulation
    let simInventory = processedInventory.map(i => ({ ...i }));

    if (assumeTransfers && suggestedTransfers.length > 0) {
        suggestedTransfers.forEach(t => {
            const recipient = simInventory.find(i => i.centreId === t.recipientCentre && i.medicineName === t.medicineName);
            const donor = simInventory.find(i => i.centreId === t.donorCentre && i.medicineName === t.medicineName);
            if (recipient) recipient.usableStock += t.transferQty;
            if (donor) donor.usableStock = Math.max(0, donor.usableStock - t.transferQty);
        });
    }

    // Re-calculate daysRemaining on simInventory items
    simInventory.forEach(item => {
        if (item.dailyConsumption <= 0) item.daysRemaining = Infinity;
        else if (item.usableStock === 0) item.daysRemaining = 0;
        else item.daysRemaining = item.usableStock / item.dailyConsumption;
    });

    const effectiveLeadTime = leadTimeDays + delayDays;
    let simCriticalCount = 0;
    let simTotalReq = 0;

    simInventory.forEach(item => {
        const simStock = Math.max(0, item.usableStock * (1 - shockPercent / 100));
        const simCons = item.dailyConsumption * demandMult;

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

        const baseDaysText = (item.daysRemaining === Infinity || item.daysRemaining === undefined || isNaN(item.daysRemaining)) ? 'Infinite' : `${item.daysRemaining.toFixed(1)}d`;
        const simDaysText = (simDaysLeft === Infinity || isNaN(simDaysLeft)) ? 'Infinite' : `${simDaysLeft.toFixed(1)}d`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${esc(item.centreId)}</strong></td>
            <td><strong>${esc(item.medicineName)}</strong></td>
            <td>${baseDaysText}</td>
            <td><strong style="color: ${simDaysLeft <= effectiveLeadTime ? '#dc2626' : '#111827'};">${simDaysText}</strong></td>
            <td>${esc(simStockoutDate)}</td>
            <td><span class="badge ${item.status === 'CRITICAL' ? 'badge-critical' : (item.status === 'WARNING' ? 'badge-warning' : (item.status === 'OUTDATED' ? 'badge-outdated' : 'badge-safe'))}">${esc(item.status)}</span></td>
            <td><span class="badge ${simStatus === 'CRITICAL' ? 'badge-critical' : (simStatus === 'WARNING' ? 'badge-warning' : (simStatus === 'OUTDATED' ? 'badge-outdated' : 'badge-safe'))}">${esc(simStatus)}</span></td>
            <td>${simShortfall > 0 ? `<strong style="color:#dc2626;">${simShortfall} units</strong>` : '0'}</td>
        `;
        tbody.appendChild(tr);
    });

    if (demandMult > 1.0 || delayDays > 0 || shockPercent > 0 || assumeTransfers) {
        banner.className = 'sim-status-banner';
        banner.style.backgroundColor = simCriticalCount > 0 ? '#fef2f2' : '#f0fdf4';
        banner.style.borderColor = simCriticalCount > 0 ? '#fca5a5' : '#86efac';
        banner.style.color = simCriticalCount > 0 ? '#dc2626' : '#166534';
        banner.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <strong>Simulation Active:</strong> ${simCriticalCount} critical shortages projected (${assumeTransfers ? 'Transfers assumed pre-executed; ' : ''}+${simTotalReq} units district requirement under stress conditions).`;
    } else {
        banner.className = 'sim-status-banner';
        banner.style.backgroundColor = '#eff6ff';
        banner.style.borderColor = '#bfdbfe';
        banner.style.color = '#1e40af';
        banner.innerHTML = `<i class="fa-solid fa-circle-check"></i> Baseline mode active. Adjust sliders or toggle transfer assumption above to stress test supply network.`;
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
                saveStateToStorage();
                renderDashboard();
                showToast('Batch record deleted successfully.', 'info');
            });
        });
    });
}

/**
 * Render Pending Approvals & Audit Log Tab
 */
function renderPendingApprovalsAndAudit() {
    const pendingTbody = document.getElementById('pending-tbody');
    const auditTbody = document.getElementById('audit-tbody');
    const pendingNavBadge = document.getElementById('pending-nav-badge');

    const pendingList = pendingRequestsState.filter(r => r.status === 'PENDING');
    if (pendingNavBadge) {
        pendingNavBadge.textContent = pendingList.length;
        pendingNavBadge.style.display = pendingList.length > 0 ? 'inline-block' : 'none';
    }

    // Render Pending Requests Table
    if (pendingTbody) {
        pendingTbody.innerHTML = '';
        if (pendingList.length === 0) {
            pendingTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #16a34a; padding: 2rem;"><i class="fa-solid fa-circle-check"></i> No pending transfer requests requiring Medical Officer approval.</td></tr>`;
        } else {
            pendingList.forEach(req => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${esc(req.requestedAt)}</strong></td>
                    <td>
                        <div class="transfer-route-box">
                            <span class="route-phc">${esc(req.donor)}</span>
                            <span class="route-arrow"><i class="fa-solid fa-arrow-right"></i></span>
                            <span class="route-phc">${esc(req.recipient)}</span>
                        </div>
                    </td>
                    <td><strong>${esc(req.medicine)}</strong></td>
                    <td><strong style="color:#0284c7; font-size: 0.95rem;">${req.qty} units</strong></td>
                    <td>${impactCompactHtml(req.impact)}</td>
                    <td><span class="badge badge-pending">Pending Approval</span></td>
                    <td>
                        <div style="display:flex; gap:0.4rem;">
                            <button class="btn btn-success btn-sm btn-approve-req" data-id="${esc(req.id)}">
                                <i class="fa-solid fa-user-check"></i> Approve
                            </button>
                            <button class="btn btn-danger btn-sm btn-reject-req" data-id="${esc(req.id)}">
                                <i class="fa-solid fa-user-xmark"></i> Reject
                            </button>
                        </div>
                    </td>
                `;
                pendingTbody.appendChild(tr);
            });

            document.querySelectorAll('.btn-approve-req').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const reqId = e.currentTarget.dataset.id;
                    const req = pendingRequestsState.find(r => r.id === reqId);
                    if (req) openApproveModal(req);
                });
            });

            document.querySelectorAll('.btn-reject-req').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const reqId = e.currentTarget.dataset.id;
                    const req = pendingRequestsState.find(r => r.id === reqId);
                    if (req) openRejectModal(req);
                });
            });
        }
    }

    // Render Audit Log Table
    if (auditTbody) {
        auditTbody.innerHTML = '';
        if (auditLogState.length === 0) {
            auditTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #6b7280; padding: 2rem;">No audit log records recorded yet.</td></tr>`;
        } else {
            auditLogState.forEach(log => {
                let actionBadge = 'badge-safe';
                if (log.action === 'Requested') actionBadge = 'badge-pending';
                if (log.action === 'Approved') actionBadge = 'badge-approved';
                if (log.action === 'Rejected' || log.action === 'Invalid') actionBadge = 'badge-rejected';

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><code>${esc(log.timestamp)}</code></td>
                    <td><span class="badge ${actionBadge}">${esc(log.action)}</span></td>
                    <td><strong>${esc(log.officer)}</strong></td>
                    <td><strong>${esc(log.route)}</strong></td>
                    <td><strong>${esc(log.medicine)}</strong></td>
                    <td>${log.qty} units</td>
                    <td><small style="color:#4b5563;">${esc(log.note)}</small></td>
                `;
                auditTbody.appendChild(tr);
            });
        }
    }
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

    // 4. Update Summary KPI Metrics
    const uniqueCentres = new Set(processedList.map(i => i.centreId)).size;
    const uniqueMeds = new Set(processedList.map(i => i.medicineName)).size;
    const criticalCount = processedList.filter(i => i.status === 'CRITICAL').length;
    const totalTransferUnits = suggestedTransfers.reduce((acc, t) => acc + t.transferQty, 0);
    const pendingCount = pendingRequestsState.filter(r => r.status === 'PENDING').length;
    const totalDistrictReqUnits = districtRequirements.reduce((acc, d) => acc + d.remainingDistrictReq, 0);

    // Step 5: Split Batch Expiry Metrics
    const expiredBatchesCount = batchState.filter(b => getDaysUntilExpiry(b.expiryDate) < 0).length;
    const nearExpiryBatchesCount = batchState.filter(b => {
        const d = getDaysUntilExpiry(b.expiryDate);
        return d >= 0 && d <= 60;
    }).length;

    document.getElementById('metric-centres').textContent = uniqueCentres;
    document.getElementById('metric-medicines').textContent = uniqueMeds;
    document.getElementById('metric-critical').textContent = criticalCount;
    document.getElementById('metric-transfers').textContent = suggestedTransfers.length;
    document.getElementById('metric-transfer-units').textContent = `${totalTransferUnits} units total`;
    document.getElementById('metric-pending-approvals').textContent = pendingCount;
    document.getElementById('metric-district-req').textContent = totalDistrictReqUnits;
    document.getElementById('metric-expired').textContent = expiredBatchesCount;
    document.getElementById('metric-near-expiry').textContent = nearExpiryBatchesCount;

    // 5. Render Overview Table
    const tbodyOverview = document.getElementById('overview-tbody');
    tbodyOverview.innerHTML = '';
    const needsAttentionItems = filteredList.filter(i => i.status === 'CRITICAL' || i.status === 'WARNING' || i.status === 'OUTDATED');
    document.getElementById('needs-attention-count').textContent = `Showing ${filteredList.length} items (${needsAttentionItems.length} need action)`;

    if (filteredList.length === 0) {
        tbodyOverview.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #16a34a; padding: 2rem;"><i class="fa-solid fa-circle-check"></i> No matching medicine stock records found.</td></tr>`;
    } else {
        filteredList.forEach(item => {
            const tr = document.createElement('tr');
            if (item.status === 'CRITICAL') tr.className = 'row-critical';
            if (item.status === 'OUTDATED') tr.className = 'row-outdated';

            let badgeClass = item.status === 'CRITICAL' ? 'badge-critical' : (item.status === 'WARNING' ? 'badge-warning' : (item.status === 'OUTDATED' ? 'badge-outdated' : 'badge-safe'));
            let actionText = item.status === 'CRITICAL' ? 'Execute Transfer / Order Stock' : (item.status === 'WARNING' ? 'Prepare Reorder' : (item.status === 'OUTDATED' ? 'Verify Physical Stock' : 'Stock Optimal'));

            tr.innerHTML = `
                <td><span class="badge ${badgeClass}">${esc(item.status)}</span></td>
                <td><strong>${esc(item.centreId)}</strong> <br><small style="color:#6b7280;">${esc(centreNames[item.centreId] || '')}</small></td>
                <td><strong>${esc(item.medicineName)}</strong></td>
                <td><strong>${item.usableStock}</strong></td>
                <td>${item.dailyConsumption} / day</td>
                <td><strong>${item.daysRemaining === Infinity ? 'Infinite' : item.daysRemaining.toFixed(1) + 'd'}</strong></td>
                <td>${esc(item.stockoutDate)}</td>
                <td><small style="color:#4b5563;">${esc(item.riskReason)}</small></td>
                <td><span class="btn btn-outline btn-sm">${esc(actionText)}</span></td>
            `;
            tbodyOverview.appendChild(tr);
        });
    }

    // 6. Render Full Inventory Table
    const tbodyInv = document.getElementById('inventory-tbody');
    tbodyInv.innerHTML = '';
    document.getElementById('inventory-count').textContent = `Showing ${filteredList.length} of ${processedList.length} items`;

    if (filteredList.length === 0) {
        tbodyInv.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #6b7280; padding: 2rem;">No matching medicine stock records found.</td></tr>`;
    } else {
        filteredList.forEach(item => {
            const tr = document.createElement('tr');
            if (item.status === 'CRITICAL') tr.className = 'row-critical';
            if (item.status === 'OUTDATED') tr.className = 'row-outdated';

            let daysText = (item.daysRemaining === Infinity) ? 'Infinite (0 use)' : `${item.daysRemaining.toFixed(1)} days`;
            let badgeClass = item.status === 'CRITICAL' ? 'badge-critical' : (item.status === 'WARNING' ? 'badge-warning' : (item.status === 'OUTDATED' ? 'badge-outdated' : 'badge-safe'));

            tr.innerHTML = `
                <td><strong>${esc(item.centreId)}</strong> <br><small style="color:#6b7280;">${esc(centreNames[item.centreId] || '')}</small></td>
                <td><strong>${esc(item.medicineName)}</strong></td>
                <td><strong>${item.usableStock}</strong> <br><small style="color:#6b7280;">(${item.currentStock} total)</small></td>
                <td>${item.dailyConsumption} / day</td>
                <td><strong>${daysText}</strong></td>
                <td>${esc(item.stockoutDate)}</td>
                <td>${item.targetCoverageDays}d (${item.targetStock} units)</td>
                <td>${item.shortfall > 0 ? `<span style="color:#dc2626; font-weight:bold;">${item.shortfall} units</span>` : '<span style="color:#16a34a;">None</span>'}</td>
                <td>
                    <span class="badge ${badgeClass}">${esc(item.status)}</span>
                    <br><small style="color:#6b7280; font-size: 0.725rem;">${esc(item.riskReason)}</small>
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
                    saveStateToStorage();
                    renderDashboard();
                    showToast('Inventory record deleted successfully.', 'info');
                });
            });
        });
    }

    // 7. Render Redistribution Table with Visual Route Diagram & Pending Approval Status
    const tbodyTrans = document.getElementById('transfer-tbody');
    tbodyTrans.innerHTML = '';

    if (suggestedTransfers.length === 0) {
        tbodyTrans.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #6b7280; padding: 2rem;">No surplus transfers required currently. All health centres operate within safe stock levels!</td></tr>`;
    } else {
        suggestedTransfers.forEach((t, idx) => {
            const tr = document.createElement('tr');
            let badgeClass = t.priority.includes('CRITICAL') ? 'badge-critical' : (t.priority.includes('OUTDATED') ? 'badge-outdated' : 'badge-warning');

            // Check if there is already a pending request for donor+recipient+medicine
            const isPending = pendingRequestsState.some(r =>
                r.status === 'PENDING' &&
                r.donor === t.donorCentre &&
                r.recipient === t.recipientCentre &&
                r.medicine === t.medicineName
            );

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
                <td><small style="color:#4b5563;">${esc(t.reasoning)}</small></td>
                <td>
                    ${isPending ? `
                        <button class="btn btn-outline btn-sm" disabled style="opacity:0.7; cursor:not-allowed;">
                            <i class="fa-solid fa-clock"></i> Pending Approval
                        </button>
                    ` : `
                        <button class="btn btn-success btn-sm btn-request-transfer" 
                            data-donor="${esc(t.donorCentre)}" 
                            data-recipient="${esc(t.recipientCentre)}" 
                            data-medicine="${esc(t.medicineName)}" 
                            data-qty="${t.transferQty}">
                            <i class="fa-solid fa-truck-fast"></i> Request Transfer
                        </button>
                    `}
                </td>
            `;
            tbodyTrans.appendChild(tr);
        });

        document.querySelectorAll('.btn-request-transfer').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const { donor, recipient, medicine, qty } = e.currentTarget.dataset;
                const transferQty = parseInt(qty, 10);
                openRequestTransferModal(donor, recipient, medicine, transferQty);
            });
        });
    }

    // 8. Render District Procurement Requirements Table (Filter remainingDistrictReq > 0)
    const tbodyDist = document.getElementById('district-tbody');
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
                <td><strong style="color:#dc2626; font-size: 1rem;">${d.remainingDistrictReq} units</strong></td>
                <td>
                    <span class="badge ${badgeClass}">${esc(d.status)}</span>
                    ${d.isOutdated ? '<br><small style="color:#7e22ce;">(Manual Audit Needed)</small>' : ''}
                </td>
            `;
            tbodyDist.appendChild(tr);
        });
    }

    // 9. Render Auxiliary Views & Pending Approvals Tab
    renderBatchTable();
    renderFacilityRiskMatrix(processedList);
    renderSimulator(processedList);
    renderDistanceMatrix();
    renderPendingApprovalsAndAudit();
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
 * Populate Dropdowns (Escapes options and option values)
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
 * Open Request Transfer Modal
 */
let activeRequestData = null;
function openRequestTransferModal(donor, recipient, medicine, qty) {
    activeRequestData = { donor, recipient, medicine, qty };
    const impact = computeTransferImpact(donor, recipient, medicine, qty);

    document.getElementById('req-transfer-summary').innerHTML = `
        <div style="font-size:0.9rem; font-weight:700; margin-bottom:0.5rem; color:#111827;">
            Requesting Transfer of <span style="color:#0284c7;">${qty} units</span> of <strong>${esc(medicine)}</strong> from <strong>${esc(donor)}</strong> to <strong>${esc(recipient)}</strong>
        </div>
        ${impactHtml(impact)}
    `;

    document.getElementById('modal-request-transfer').classList.add('open');
}

function closeRequestTransferModal() {
    document.getElementById('modal-request-transfer').classList.remove('open');
    activeRequestData = null;
}

/**
 * Open Medical Officer Approval Modal
 */
let activePendingRequestToApprove = null;
function openApproveModal(req) {
    activePendingRequestToApprove = req;
    document.getElementById('approve-route-summary').innerHTML = `
        <div style="font-size:0.85rem; font-weight:700; margin-bottom:0.4rem;">
            Transfer Route: <strong>${esc(req.donor)}</strong> → <strong>${esc(req.recipient)}</strong> | ${req.qty} units of <strong>${esc(req.medicine)}</strong>
        </div>
        ${impactHtml(req.impact)}
    `;
    document.getElementById('input-officer-name').value = '';
    document.getElementById('input-officer-pin').value = '';
    document.getElementById('input-approve-note').value = '';
    document.getElementById('modal-approve-transfer').classList.add('open');
}

function closeApproveModal() {
    document.getElementById('modal-approve-transfer').classList.remove('open');
    activePendingRequestToApprove = null;
}

/**
 * Open Rejection Modal
 */
let activePendingRequestToReject = null;
function openRejectModal(req) {
    activePendingRequestToReject = req;
    document.getElementById('reject-route-summary').innerHTML = `
        <div style="font-size:0.85rem; font-weight:700;">
            Rejecting Request: <strong>${esc(req.donor)}</strong> → <strong>${esc(req.recipient)}</strong> (${req.qty} units of ${esc(req.medicine)})
        </div>
    `;
    document.getElementById('input-reject-reason').value = '';
    document.getElementById('modal-reject-transfer').classList.add('open');
}

function closeRejectModal() {
    document.getElementById('modal-reject-transfer').classList.remove('open');
    activePendingRequestToReject = null;
}

/**
 * DEMO SCENARIO LOADER (Benchmark Benchmark)
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
            lastUpdated: getPastDateString(0),
            lastTransferAt: null
        },
        {
            id: 'DEMO-C',
            centreId: 'Centre C',
            medicineName: 'Paracetamol Syrup (100ml)',
            currentStock: 200,
            dailyConsumption: 2,
            targetCoverageDays: 30,
            lastUpdated: getPastDateString(0),
            lastTransferAt: null
        },
        {
            id: 'DEMO-B',
            centreId: 'Centre B',
            medicineName: 'Amoxicillin 500mg Capsules',
            currentStock: 400,
            dailyConsumption: 10,
            targetCoverageDays: 30,
            lastUpdated: getPastDateString(1),
            lastTransferAt: null
        },
        {
            id: 'DEMO-D',
            centreId: 'Centre D',
            medicineName: 'ORS Electrolyte Packets',
            currentStock: 500,
            dailyConsumption: 5,
            targetCoverageDays: 30,
            lastUpdated: getPastDateString(2),
            lastTransferAt: null
        }
    ];

    batchState = [
        {
            id: 'DEMO-BAT-A',
            batchNumber: 'DEMO-BATCH-01',
            centreId: 'Centre A',
            medicineName: 'Paracetamol Syrup (100ml)',
            quantity: 60,
            expiryDate: getFutureDateString(180)
        },
        {
            id: 'DEMO-BAT-C',
            batchNumber: 'DEMO-BATCH-02',
            centreId: 'Centre C',
            medicineName: 'Paracetamol Syrup (100ml)',
            quantity: 200,
            expiryDate: getFutureDateString(240)
        }
    ];

    pendingRequestsState = [];
    auditLogState = [];

    saveStateToStorage();

    document.getElementById('filter-search').value = '';
    document.getElementById('filter-centre').value = 'ALL';
    document.getElementById('filter-medicine').value = 'ALL';
    document.getElementById('filter-urgency').value = 'ALL';
    document.getElementById('input-lead-time').value = '10';
    leadTimeDays = 10;

    populateDropdowns();
    renderDashboard();

    switchTab('tab-overview');

    showToast('⚡ Demonstration Scenario Loaded! Check Centre A (6 days left) and Centre C (140 safe surplus).', 'warning');
}

/**
 * Reset Data to Factory Seed
 */
function resetData() {
    inventoryState = JSON.parse(JSON.stringify(initialInventorySeed));
    batchState = JSON.parse(JSON.stringify(initialBatchSeed));
    pendingRequestsState = [];
    auditLogState = [];

    localStorage.removeItem('medicare_inventory_state');
    localStorage.removeItem('medicare_batch_state');
    localStorage.removeItem('medicare_pending_requests');
    localStorage.removeItem('medicare_audit_log');
    localStorage.removeItem('aushadhi_inventory_state');
    localStorage.removeItem('aushadhi_batch_state');

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
 * Toast Notification System (Escapes dynamic messages safely)
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
 * Custom Confirmation Modal (Escapes title & message safely)
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
        if (!isNaN(val) && val >= 1 && val <= 90) {
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
        showConfirmModal('Reset Application Data', 'Are you sure you want to reset all inventory, batch, and pending approval records to initial factory seed?', () => {
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

    // Request Transfer Modal Listeners
    document.getElementById('btn-close-req-modal').addEventListener('click', closeRequestTransferModal);
    document.getElementById('btn-cancel-req').addEventListener('click', closeRequestTransferModal);
    document.getElementById('btn-submit-req').addEventListener('click', () => {
        if (!activeRequestData) return;
        const { donor, recipient, medicine, qty } = activeRequestData;
        const impact = computeTransferImpact(donor, recipient, medicine, qty);

        const newReq = {
            id: `REQ-${Date.now()}`,
            donor,
            recipient,
            medicine,
            qty,
            impact,
            requestedAt: `${toLocalISO(new Date())} ${new Date().toLocaleTimeString('en-GB')}`,
            requestedBy: 'System Recommendation',
            status: 'PENDING'
        };

        pendingRequestsState.unshift(newReq);
        logAuditAction('Requested', 'System Recommendation', `${donor} → ${recipient}`, medicine, qty, 'Submitted for Medical Officer approval');
        saveStateToStorage();
        closeRequestTransferModal();
        renderDashboard();
        showToast(`Transfer request submitted for ${qty} units of ${medicine} (${donor} → ${recipient}). Pending Medical Officer approval.`, 'info');
    });

    // Approve Modal Listeners
    document.getElementById('btn-close-approve-modal').addEventListener('click', closeApproveModal);
    document.getElementById('btn-cancel-approve').addEventListener('click', closeApproveModal);
    document.getElementById('form-approve-transfer').addEventListener('submit', (e) => {
        e.preventDefault();
        if (!activePendingRequestToApprove) return;

        const officerName = document.getElementById('input-officer-name').value.trim();
        const pin = document.getElementById('input-officer-pin').value.trim();
        const note = document.getElementById('input-approve-note').value.trim();

        if (!officerName) {
            showToast('Validation Error: Please enter Medical Officer Name.', 'error');
            return;
        }

        if (pin !== '1234') {
            showToast('Authorization Error: Invalid PIN! (Demo PIN is 1234).', 'error');
            return;
        }

        const req = activePendingRequestToApprove;

        // Re-validate against CURRENT data
        const donorItem = inventoryState.find(i => i.centreId === req.donor && i.medicineName === req.medicine);
        const donorProcessed = donorItem ? processForecastItem(donorItem) : null;
        const { validBatchQty } = getItemBatchAnalysis(req.donor, req.medicine);

        if (!donorProcessed || donorProcessed.isOutdated || donorProcessed.donorSurplus < req.qty || validBatchQty < req.qty) {
            req.status = 'INVALID';
            logAuditAction('Invalid', officerName, `${req.donor} → ${req.recipient}`, req.medicine, req.qty, `Approval failed re-validation: Donor surplus or valid batch stock insufficient.`);
            saveStateToStorage();
            closeApproveModal();
            renderDashboard();
            showToast(`Approval failed: Donor safe surplus or valid batch stock is no longer sufficient. Request marked INVALID.`, 'error');
            return;
        }

        // Execute actual stock & batch movement
        const success = executeApprovedTransfer(req.donor, req.recipient, req.medicine, req.qty);
        if (success) {
            req.status = 'APPROVED';
            logAuditAction('Approved', officerName, `${req.donor} → ${req.recipient}`, req.medicine, req.qty, note || 'Transfer approved by Medical Officer');
            saveStateToStorage();
            closeApproveModal();
            renderDashboard();
            showToast(`⚡ Transfer Approved! ${req.qty} units of ${req.medicine} moved from ${req.donor} to ${req.recipient}.`, 'success');
        }
    });

    // Reject Modal Listeners
    document.getElementById('btn-close-reject-modal').addEventListener('click', closeRejectModal);
    document.getElementById('btn-cancel-reject').addEventListener('click', closeRejectModal);
    document.getElementById('form-reject-transfer').addEventListener('submit', (e) => {
        e.preventDefault();
        if (!activePendingRequestToReject) return;

        const reason = document.getElementById('input-reject-reason').value.trim();
        if (!reason) {
            showToast('Validation Error: Please enter a rejection reason.', 'error');
            return;
        }

        const req = activePendingRequestToReject;
        req.status = 'REJECTED';
        logAuditAction('Rejected', 'Medical Officer', `${req.donor} → ${req.recipient}`, req.medicine, req.qty, `Reason: ${reason}`);

        saveStateToStorage();
        closeRejectModal();
        renderDashboard();
        showToast(`Transfer request rejected: ${reason}`, 'info');
    });

    // Simulator Listeners
    ['sim-demand-multiplier', 'sim-delay-days', 'sim-supply-shock', 'sim-assume-transfers'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                const processedList = inventoryState.map(processForecastItem);
                renderSimulator(processedList);
            });
            el.addEventListener('change', () => {
                const processedList = inventoryState.map(processForecastItem);
                renderSimulator(processedList);
            });
        }
    });

    document.getElementById('btn-reset-sim').addEventListener('click', () => {
        document.getElementById('sim-demand-multiplier').value = '1.0';
        document.getElementById('sim-delay-days').value = '0';
        document.getElementById('sim-supply-shock').value = '0';
        document.getElementById('sim-assume-transfers').checked = false;
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
        document.getElementById('modal-last-updated').value = toLocalISO(new Date());
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

        // Case-insensitive deduplication check
        const existingIdx = inventoryState.findIndex(i =>
            i.centreId === centreId &&
            i.medicineName.toLowerCase().trim() === medicineName.toLowerCase().trim()
        );

        if (existingIdx >= 0) {
            inventoryState[existingIdx].currentStock = currentStock;
            inventoryState[existingIdx].dailyConsumption = dailyConsumption;
            inventoryState[existingIdx].targetCoverageDays = targetCoverageDays;
            inventoryState[existingIdx].lastUpdated = lastUpdated;
            showToast(`Updated stock record for ${medicineName} at ${centreId}.`, 'success');
        } else {
            inventoryState.push({
                id: `INV-${Date.now()}`,
                centreId,
                medicineName,
                currentStock,
                dailyConsumption,
                targetCoverageDays,
                lastUpdated,
                lastTransferAt: null
            });
            showToast(`Added new stock record for ${medicineName} at ${centreId}.`, 'success');
        }

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

        saveStateToStorage();
        renderDashboard();
        modalBatch.classList.remove('open');
        formBatch.reset();

        showToast(`Registered batch ${batchNumber} (${quantity} units) for ${medicineName}.`, 'success');
    });
});
