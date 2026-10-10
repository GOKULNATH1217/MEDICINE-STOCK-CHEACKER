/**
 * ============================================================================
 * AUSHADHI-ALERT: PHC MEDICINE STOCK-OUT EARLY WARNING & REDISTRIBUTION ENGINE
 * ============================================================================
 * Senior-level Vanilla JavaScript Implementation for Hackathon Prototype.
 * 
 * CORE ALGORITHMIC FORMULAS & ENHANCEMENTS:
 * 1. Usable Stock = Total Stock - Expired Stock (Expired stock strictly excluded!)
 * 2. Estimated Days Remaining = Usable Stock / Average Daily Consumption
 * 3. Target Stock = Average Daily Consumption * Target Coverage Days
 * 4. Shortfall (Recipient Need) = Max(0, Target Stock - Usable Stock)
 * 5. Donor Safe Surplus = Max(0, Donor Usable Stock - Donor Safety Stock)
 * 6. Greedy Redistribution with One-Click Transfer Execution:
 *    - Excludes outdated donor records (>14 days).
 *    - Flags stale recipient records for manual audit.
 *    - Prefers closest donor PHCs based on distance matrix (km).
 *    - Allows instant execution of transfers, dynamically updating inventory state.
 * 7. Batch & Expiry Management (Near-expiry <60 days, Expired exclusion).
 * 8. Facility Risk Overview Matrix.
 * 9. Interactive What-If Supply Chain Simulator.
 * ============================================================================
 */

// Global State
let leadTimeDays = 10; // Default replenishment lead time in days

// Distance matrix between PHCs in kilometers (Symmetric)
const distanceMatrix = {
    'Centre A': { 'Centre A': 0, 'Centre B': 15, 'Centre C': 9, 'Centre D': 22 },
    'Centre B': { 'Centre A': 15, 'Centre B': 0, 'Centre C': 12, 'Centre D': 8 },
    'Centre C': { 'Centre A': 9, 'Centre B': 12, 'Centre C': 0, 'Centre D': 18 },
    'Centre D': { 'Centre A': 22, 'Centre B': 8, 'Centre C': 18, 'Centre D': 0 }
};

// Full name mapping for PHCs
const centreNames = {
    'Centre A': 'Centre A (PHC Alpha - Rampur)',
    'Centre B': 'Centre B (PHC Beta - Sundarpur)',
    'Centre C': 'Centre C (PHC Gamma - Chandanpur)',
    'Centre D': 'Centre D (PHC Delta - Krishnapur)'
};

// Helper: Format relative dates
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
        lastUpdated: getPastDateString(18) // Outdated record (>14 days)
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
        dailyConsumption: 0, // Zero consumption test case
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
        expiryDate: getFutureDateString(180) // Valid 6 months
    },
    {
        id: 'BAT-002',
        batchNumber: 'BATCH-2026-P02',
        centreId: 'Centre C',
        medicineName: 'Paracetamol Syrup (100ml)',
        quantity: 180,
        expiryDate: getFutureDateString(240) // Valid 8 months
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
        expiryDate: getFutureDateString(35) // NEAR EXPIRY (<60 days)
    }
];

// Persistent State Loaders
function loadSavedInventory() {
    const saved = localStorage.getItem('aushadhi_inventory_state');
    if (saved) {
        try { return JSON.parse(saved); } catch (e) { console.error('Error loading inventory from storage', e); }
    }
    return JSON.parse(JSON.stringify(initialInventorySeed));
}

function loadSavedBatches() {
    const saved = localStorage.getItem('aushadhi_batch_state');
    if (saved) {
        try { return JSON.parse(saved); } catch (e) { console.error('Error loading batches from storage', e); }
    }
    return JSON.parse(JSON.stringify(initialBatchSeed));
}

// Active Application State
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

/**
 * Calculate estimated stockout date safely handling fractional days.
 */
function calculateStockoutDate(daysRemaining) {
    if (!isFinite(daysRemaining) || isNaN(daysRemaining) || daysRemaining < 0) {
        return 'No Risk (0 Use)';
    }
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + Math.floor(daysRemaining));
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * PRIORITY 3: Medicine Expiry Calculation Utility
 * Returns batch analysis for a specific centre & medicine item.
 * Strictly EXCLUDES expired batch quantities from usable stock.
 */
function getItemBatchAnalysis(centreId, medicineName) {
    const matchingBatches = batchState.filter(b => 
        b.centreId === centreId && 
        b.medicineName.toLowerCase() === medicineName.toLowerCase()
    );

    let expiredQty = 0;
    let nearExpiryQty = 0;

    matchingBatches.forEach(b => {
        const daysLeft = getDaysUntilExpiry(b.expiryDate);
        if (daysLeft < 0) {
            expiredQty += b.quantity;
        } else if (daysLeft <= 60) {
            nearExpiryQty += b.quantity;
        }
    });

    return { matchingBatches, expiredQty, nearExpiryQty };
}

/**
 * Perform Forecasting Calculations for an inventory item
 */
function processForecastItem(item) {
    const daysSinceUpdate = getDaysSince(item.lastUpdated);
    const isOutdated = daysSinceUpdate > 14 || daysSinceUpdate < 0;

    // PRIORITY 3: DEDUCT EXPIRED BATCHES FROM USABLE STOCK
    const { expiredQty, nearExpiryQty } = getItemBatchAnalysis(item.centreId, item.medicineName);
    const usableStock = Math.max(0, item.currentStock - expiredQty);

    // 1. Estimated Days Remaining handling zero consumption safely
    let daysRemaining;
    if (item.dailyConsumption <= 0) {
        daysRemaining = Infinity;
    } else {
        daysRemaining = usableStock / item.dailyConsumption;
    }

    // 2. Shortfall & Target Stock Calculation
    const targetStock = item.dailyConsumption * item.targetCoverageDays;
    const shortfall = Math.max(0, Math.round(targetStock - usableStock));

    // 3. Donor Safe Surplus Calculation
    const safetyStock = item.dailyConsumption * item.targetCoverageDays;
    const rawSurplus = Math.max(0, Math.round(usableStock - safetyStock));
    // CRITICAL: Outdated records CANNOT donate surplus (surplus = 0)
    const donorSurplus = isOutdated ? 0 : rawSurplus;

    // 4. Status & Human-Readable Risk Reason Determination
    let status = 'SAFE';
    let riskReason = '';

    if (isOutdated) {
        status = 'OUTDATED';
        riskReason = `Record updated ${daysSinceUpdate}d ago (>14d). Physical audit required.`;
    } else if (daysRemaining <= leadTimeDays) {
        status = 'CRITICAL';
        riskReason = `Stock depletes in ${daysRemaining.toFixed(1)}d (≤ ${leadTimeDays}d lead time). High stock-out risk.`;
    } else if (daysRemaining <= leadTimeDays * 1.5) {
        status = 'WARNING';
        riskReason = `Stock covers ${daysRemaining.toFixed(1)}d (≤ ${Math.round(leadTimeDays * 1.5)}d threshold). Reorder soon.`;
    } else if (daysRemaining === Infinity) {
        status = 'SAFE';
        riskReason = `Zero daily usage reported. Current stock intact.`;
    } else {
        status = 'SAFE';
        riskReason = `Stock covers ${daysRemaining.toFixed(1)}d safely exceeding ${leadTimeDays}d lead time.`;
    }

    if (expiredQty > 0) {
        riskReason += ` (${expiredQty} units expired & excluded).`;
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
 * Smart Redistribution & Allocation Algorithm
 */
function computeRedistribution(processedInventory) {
    const suggestedTransfers = [];
    const districtRequirements = [];

    // Step A: Filter items with shortfall > 0 (Recipients)
    const shortages = processedInventory
        .filter(item => item.shortfall > 0)
        .sort((a, b) => a.daysRemaining - b.daysRemaining);

    // Step B: Create donor surplus map so surplus is NEVER allocated twice
    const surplusTracker = {};
    processedInventory.forEach(item => {
        surplusTracker[item.id] = item.isOutdated ? 0 : item.donorSurplus;
    });

    // Step C: Process each shortage item
    shortages.forEach(recipient => {
        let neededQty = recipient.shortfall;
        let totalAllocatedForRecipient = 0;

        // Find candidate donors with same medicine & surplus > 0 & NOT outdated
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

        // Allocate surplus greedily across candidate donors
        candidateDonors.forEach(({ donorItem, distance }) => {
            if (neededQty <= 0) return;

            const availableSurplus = surplusTracker[donorItem.id];
            if (availableSurplus <= 0) return;

            const transferAmount = Math.min(neededQty, availableSurplus);

            // PRIORITY 2: Transparent Algorithm Reasoning
            const reasoning = `${donorItem.centreId} holds ${availableSurplus} units safe surplus above safety stock. Distance: ${distance} km.`;

            // Record Transfer Suggestion
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

            // Update trackers
            surplusTracker[donorItem.id] -= transferAmount;
            neededQty -= transferAmount;
            totalAllocatedForRecipient += transferAmount;
        });

        // Step D: Calculate remaining district requirement
        const remainingDistrictReq = recipient.shortfall - totalAllocatedForRecipient;
        if (remainingDistrictReq > 0 || recipient.shortfall > 0) {
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
 * PRIORITY 2: Execute Transfer Action
 * Updates donor stock and recipient stock in real-time.
 */
function executeTransfer(donorCentre, recipientCentre, medicineName, qty) {
    const donorIdx = inventoryState.findIndex(i => i.centreId === donorCentre && i.medicineName === medicineName);
    const recipientIdx = inventoryState.findIndex(i => i.centreId === recipientCentre && i.medicineName === medicineName);

    if (donorIdx < 0 || recipientIdx < 0) {
        showToast('Error: Donor or Recipient inventory record not found.', 'error');
        return;
    }

    if (inventoryState[donorIdx].currentStock < qty) {
        showToast('Error: Donor PHC does not have enough stock to complete transfer.', 'error');
        return;
    }

    // Execute stock transfer
    inventoryState[donorIdx].currentStock -= qty;
    inventoryState[donorIdx].lastUpdated = getPastDateString(0);

    inventoryState[recipientIdx].currentStock += qty;
    inventoryState[recipientIdx].lastUpdated = getPastDateString(0);

    saveStateToStorage();
    renderDashboard();

    showToast(`⚡ Transferred ${qty} units of ${medicineName} from ${donorCentre} to ${recipientCentre}!`, 'success');
}

/**
 * PRIORITY 4: Render Facility Risk Overview Cards
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
                    <div class="facility-title">${centreId}</div>
                    <div class="facility-sub">${centreNames[centreId]}</div>
                </div>
                <span class="badge ${riskBadgeClass}">${riskLabel}</span>
            </div>
            <div class="facility-metrics">
                <div class="facility-stat">
                    <span class="facility-stat-label">Critical Items</span>
                    <span class="facility-stat-val" style="color: ${criticalItems.length > 0 ? '#dc2626' : '#10b981'};">${criticalItems.length}</span>
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
 * PRIORITY 5: Render What-If Supply Chain Simulator
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
    tbody.innerHTML = '';

    const effectiveLeadTime = leadTimeDays + delayDays;

    let simCriticalCount = 0;
    let simTotalReq = 0;

    processedInventory.forEach(item => {
        const simStock = Math.max(0, item.usableStock * (1 - shockPercent / 100));
        const simCons = item.dailyConsumption * demandMult;

        let simDaysLeft;
        if (simCons <= 0) {
            simDaysLeft = Infinity;
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
            <td><strong>${item.centreId}</strong></td>
            <td><strong>${item.medicineName}</strong></td>
            <td>${item.daysRemaining === Infinity ? 'Infinite' : item.daysRemaining.toFixed(1) + 'd'}</td>
            <td><strong style="color: ${simDaysLeft <= effectiveLeadTime ? '#dc2626' : '#1e293b'};">${simDaysLeft === Infinity ? 'Infinite' : simDaysLeft.toFixed(1) + 'd'}</strong></td>
            <td>${simStockoutDate}</td>
            <td><span class="badge ${item.status === 'CRITICAL' ? 'badge-critical' : 'badge-safe'}">${item.status}</span></td>
            <td><span class="badge ${simStatus === 'CRITICAL' ? 'badge-critical' : (simStatus === 'WARNING' ? 'badge-warning' : 'badge-safe')}">${simStatus}</span></td>
            <td>${simShortfall > 0 ? `<strong style="color:#dc2626;">${simShortfall} units</strong>` : '0'}</td>
        `;
        tbody.appendChild(tr);
    });

    if (demandMult > 1.0 || delayDays > 0 || shockPercent > 0) {
        banner.className = 'sim-impact-banner';
        banner.style.backgroundColor = '#fef2f2';
        banner.style.borderColor = '#fca5a5';
        banner.style.color = '#dc2626';
        banner.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <strong>Simulation Active:</strong> ${simCriticalCount} critical shortages projected (+${simTotalReq} units district requirement under stress conditions).`;
    } else {
        banner.className = 'sim-impact-banner';
        banner.style.backgroundColor = '#eff6ff';
        banner.style.borderColor = '#bfdbfe';
        banner.style.color = '#1e40af';
        banner.innerHTML = `<i class="fa-solid fa-circle-check"></i> Baseline mode active. Adjust sliders above to stress test supply network.`;
    }
}

/**
 * Render Batch & Expiry Management Table
 */
function renderBatchTable() {
    const tbody = document.getElementById('batch-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (batchState.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #64748b; padding: 2rem;">No registered medicine batches found.</td></tr>`;
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
            <td><code>${b.batchNumber}</code></td>
            <td><strong>${b.centreId}</strong></td>
            <td><strong>${b.medicineName}</strong></td>
            <td><strong>${b.quantity} units</strong></td>
            <td>${formatDate(b.expiryDate)}</td>
            <td>${daysLeft < 0 ? `<span style="color:#dc2626; font-weight:bold;">${daysLeft} days</span>` : `${daysLeft} days`}</td>
            <td><span class="badge ${badgeClass}">${statusLabel}</span></td>
            <td>
                <button class="btn btn-danger btn-sm btn-delete-batch" data-id="${b.id}">
                    <i class="fa-solid fa-trash"></i> Delete
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Add delete event listeners
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
 * UI Render Engine
 */
function renderDashboard() {
    // 1. Process all inventory items
    const processedList = inventoryState.map(processForecastItem);

    // 2. Filter list based on UI Controls
    const searchVal = document.getElementById('filter-search').value.trim().toLowerCase();
    const centreVal = document.getElementById('filter-centre').value;
    const medVal = document.getElementById('filter-medicine').value;
    const urgencyVal = document.getElementById('filter-urgency').value;

    const filteredList = processedList.filter(item => {
        const matchesSearch = item.centreId.toLowerCase().includes(searchVal) ||
                              item.medicineName.toLowerCase().includes(searchVal) ||
                              centreNames[item.centreId]?.toLowerCase().includes(searchVal);
        const matchesCentre = (centreVal === 'ALL' || item.centreId === centreVal);
        const matchesMed = (medVal === 'ALL' || item.medicineName === medVal);
        const matchesUrgency = (urgencyVal === 'ALL' || item.status === urgencyVal);

        return matchesSearch && matchesCentre && matchesMed && matchesUrgency;
    });

    // 3. Compute Redistribution
    const { suggestedTransfers, districtRequirements } = computeRedistribution(processedList);

    // 4. Update KPI Metrics
    const uniqueCentres = new Set(processedList.map(i => i.centreId)).size;
    const uniqueMeds = new Set(processedList.map(i => i.medicineName)).size;
    const criticalCount = processedList.filter(i => i.status === 'CRITICAL').length;
    const totalTransferUnits = suggestedTransfers.reduce((acc, t) => acc + t.transferQty, 0);
    const totalDistrictReqUnits = districtRequirements.reduce((acc, d) => acc + d.remainingDistrictReq, 0);

    const expiredBatchesCount = batchState.filter(b => getDaysUntilExpiry(b.expiryDate) < 0 || getDaysUntilExpiry(b.expiryDate) <= 60).length;

    document.getElementById('metric-centres').textContent = uniqueCentres;
    document.getElementById('metric-medicines').textContent = uniqueMeds;
    document.getElementById('metric-critical').textContent = criticalCount;
    document.getElementById('metric-transfers').textContent = suggestedTransfers.length;
    document.getElementById('metric-transfer-units').textContent = `${totalTransferUnits} units total`;
    document.getElementById('metric-district-req').textContent = totalDistrictReqUnits;
    document.getElementById('metric-expired').textContent = expiredBatchesCount;

    // 5. Render Inventory Table
    const tbodyInv = document.getElementById('inventory-tbody');
    tbodyInv.innerHTML = '';
    document.getElementById('inventory-count').textContent = `Showing ${filteredList.length} of ${processedList.length} items`;

    if (filteredList.length === 0) {
        tbodyInv.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #64748b; padding: 2rem;">No matching medicine stock records found.</td></tr>`;
    } else {
        filteredList.forEach(item => {
            const tr = document.createElement('tr');
            if (item.status === 'CRITICAL') tr.className = 'row-critical';
            if (item.status === 'OUTDATED') tr.className = 'row-outdated';

            let daysText = (item.daysRemaining === Infinity) ? 'Infinite (0 use)' : `${item.daysRemaining.toFixed(1)} days`;
            let badgeClass = 'badge-safe';
            let badgeIcon = 'fa-check-circle';

            if (item.status === 'CRITICAL') {
                badgeClass = 'badge-critical';
                badgeIcon = 'fa-triangle-exclamation';
            } else if (item.status === 'WARNING') {
                badgeClass = 'badge-warning';
                badgeIcon = 'fa-clock';
            } else if (item.status === 'OUTDATED') {
                badgeClass = 'badge-outdated';
                badgeIcon = 'fa-calendar-xmark';
            }

            let statusLabel = item.status;
            if (item.status === 'OUTDATED') {
                statusLabel = `Outdated (${item.daysSinceUpdate}d ago)`;
            }

            tr.innerHTML = `
                <td><strong>${item.centreId}</strong> <br><small style="color:#64748b;">${centreNames[item.centreId] || ''}</small></td>
                <td><strong>${item.medicineName}</strong></td>
                <td><strong>${item.usableStock}</strong> <br><small style="color:#64748b;">(${item.currentStock} total)</small></td>
                <td>${item.dailyConsumption} / day</td>
                <td><strong>${daysText}</strong></td>
                <td>${item.stockoutDate}</td>
                <td>${item.targetCoverageDays}d (${item.targetStock} units)</td>
                <td>${item.shortfall > 0 ? `<span style="color:#dc2626; font-weight:bold;">${item.shortfall} units</span>` : '<span style="color:#10b981;">None</span>'}</td>
                <td>
                    <span class="badge ${badgeClass}"><i class="fa-solid ${badgeIcon}"></i> ${statusLabel}</span>
                    <br><small style="color:#64748b; font-size: 0.725rem;">${item.riskReason}</small>
                </td>
                <td>
                    <button class="btn btn-secondary btn-sm btn-delete-item" data-id="${item.id}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            tbodyInv.appendChild(tr);
        });

        // Add Delete Item Listener
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

    // 6. Render Redistribution Table with Execute Action Button
    const tbodyTrans = document.getElementById('transfer-tbody');
    tbodyTrans.innerHTML = '';

    if (suggestedTransfers.length === 0) {
        tbodyTrans.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #64748b; padding: 2rem;">No surplus transfers required currently. All health centres are within safe stock thresholds!</td></tr>`;
    } else {
        suggestedTransfers.forEach((t, idx) => {
            const tr = document.createElement('tr');
            let badgeClass = 'badge-warning';
            if (t.priority.includes('CRITICAL')) badgeClass = 'badge-critical';
            if (t.priority.includes('OUTDATED')) badgeClass = 'badge-outdated';

            tr.innerHTML = `
                <td><span class="badge ${badgeClass}">#${idx + 1} ${t.priority}</span></td>
                <td><strong>${t.recipientCentre}</strong> ${t.recipientIsOutdated ? '<br><small style="color:#a855f7;">(Verify Stale Recipient)</small>' : ''}</td>
                <td><strong>${t.donorCentre}</strong></td>
                <td>${t.medicineName}</td>
                <td><i class="fa-solid fa-location-dot"></i> ${t.distanceKm} km</td>
                <td><strong style="color:#0284c7; font-size: 1rem;">${t.transferQty} units</strong></td>
                <td><small style="color:#475569;">${t.reasoning}</small></td>
                <td>
                    <button class="btn btn-success btn-sm btn-exec-transfer" 
                        data-donor="${t.donorCentre}" 
                        data-recipient="${t.recipientCentre}" 
                        data-medicine="${t.medicineName}" 
                        data-qty="${t.transferQty}">
                        <i class="fa-solid fa-truck-arrow-right"></i> Execute Transfer
                    </button>
                </td>
            `;
            tbodyTrans.appendChild(tr);
        });

        // Add Execute Transfer Button Listeners
        document.querySelectorAll('.btn-exec-transfer').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const { donor, recipient, medicine, qty } = e.currentTarget.dataset;
                const transferQty = parseInt(qty, 10);

                showConfirmModal(
                    'Confirm Stock Transfer',
                    `Do you want to execute a transfer of ${transferQty} units of ${medicine} from ${donor} to ${recipient}?`,
                    () => {
                        executeTransfer(donor, recipient, medicine, transferQty);
                    }
                );
            });
        });
    }

    // 7. Render District Procurement Requirements Table
    const tbodyDist = document.getElementById('district-tbody');
    tbodyDist.innerHTML = '';

    if (districtRequirements.length === 0) {
        tbodyDist.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 2rem;">No additional district procurement required. All shortfalls covered by PHC surpluses!</td></tr>`;
    } else {
        districtRequirements.forEach(d => {
            const tr = document.createElement('tr');
            let badgeClass = 'badge-warning';
            if (d.status === 'CRITICAL') badgeClass = 'badge-critical';
            if (d.status === 'OUTDATED') badgeClass = 'badge-outdated';

            tr.innerHTML = `
                <td><strong>${d.centreId}</strong></td>
                <td><strong>${d.medicineName}</strong></td>
                <td>${d.totalShortfall} units</td>
                <td>${d.coveredBySurplus} units</td>
                <td><strong style="color:#dc2626; font-size: 1.05rem;">${d.remainingDistrictReq} units</strong></td>
                <td>
                    <span class="badge ${badgeClass}">${d.status}</span>
                    ${d.isOutdated ? '<br><small style="color:#a855f7;">(Manual Audit Needed)</small>' : ''}
                </td>
            `;
            tbodyDist.appendChild(tr);
        });
    }

    // 8. Render Batch Table, Facility Risk Matrix & Simulator
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
    const centres = Object.keys(distanceMatrix);
    
    let html = `<thead><tr><th>PHC Centre</th>`;
    centres.forEach(c => { html += `<th>${c}</th>`; });
    html += `</tr></thead><tbody>`;

    centres.forEach(rowC => {
        html += `<tr><td><strong>${rowC}</strong></td>`;
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
 * Populate Dropdown Filters and Modal Options
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
            sel.innerHTML += `<option value="${c}">${c} - ${centreNames[c]}</option>`;
        });
    });

    const medicines = Array.from(new Set(inventoryState.map(i => i.medicineName)));
    medSelects.forEach(sel => {
        if (!sel) return;
        const isFilter = sel.id === 'filter-medicine';
        sel.innerHTML = isFilter ? '<option value="ALL">All Medicines</option>' : '';
        medicines.forEach(m => {
            sel.innerHTML += `<option value="${m}">${m}</option>`;
        });
    });
}

/**
 * DEMO SCENARIO LOADER (Benchmark Verification)
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

    saveStateToStorage();

    document.getElementById('filter-search').value = '';
    document.getElementById('filter-centre').value = 'ALL';
    document.getElementById('filter-medicine').value = 'ALL';
    document.getElementById('filter-urgency').value = 'ALL';
    document.getElementById('input-lead-time').value = '10';
    leadTimeDays = 10;

    populateDropdowns();
    renderDashboard();

    switchTab('tab-inventory');

    showToast('⚡ Demonstration Scenario Loaded! Check Centre A (6 days left) and Centre C (140 safe surplus).', 'warning');
}

/**
 * Reset Data to Factory Seed
 */
function resetData() {
    inventoryState = JSON.parse(JSON.stringify(initialInventorySeed));
    batchState = JSON.parse(JSON.stringify(initialBatchSeed));
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
 * Toast Notification System
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let iconClass = 'fa-info-circle';
    if (type === 'success') iconClass = 'fa-circle-check';
    if (type === 'warning') iconClass = 'fa-triangle-exclamation';
    if (type === 'error') iconClass = 'fa-circle-xmark';

    toast.innerHTML = `<i class="fa-solid ${iconClass}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

/**
 * Custom Confirmation Modal
 */
let pendingConfirmAction = null;
function showConfirmModal(title, message, onConfirm) {
    document.getElementById('confirm-title').innerHTML = `<i class="fa-solid fa-circle-question"></i> ${title}`;
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
 * Tab Switching Functionality
 */
function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === tabId);
    });
}

/**
 * Event Listeners & Initialization
 */
document.addEventListener('DOMContentLoaded', () => {
    populateDropdowns();
    renderDashboard();

    // Lead Time Input Change
    document.getElementById('input-lead-time').addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val > 0) {
            leadTimeDays = val;
            renderDashboard();
        }
    });

    // Filters Event Listeners
    document.getElementById('filter-search').addEventListener('input', renderDashboard);
    document.getElementById('filter-centre').addEventListener('change', renderDashboard);
    document.getElementById('filter-medicine').addEventListener('change', renderDashboard);
    document.getElementById('filter-urgency').addEventListener('change', renderDashboard);

    // Action Buttons with Confirmation
    document.getElementById('btn-demo').addEventListener('click', () => {
        showConfirmModal('Load Demo Scenario', 'Do you want to load the hackathon demonstration scenario benchmark?', () => {
            loadDemoScenario();
        });
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
        showConfirmModal('Reset Application Data', 'Are you sure you want to reset all inventory and batch records to initial factory seed?', () => {
            resetData();
        });
    });

    // Confirm Modal Button Actions
    document.getElementById('btn-action-confirm').addEventListener('click', () => {
        if (pendingConfirmAction) pendingConfirmAction();
        closeConfirmModal();
    });
    document.getElementById('btn-cancel-confirm').addEventListener('click', closeConfirmModal);
    document.getElementById('btn-close-confirm').addEventListener('click', closeConfirmModal);

    // Navigation Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Simulator Sliders Event Listeners
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

    // Inventory Modal Control
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

    // Add Stock Form Submit
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
            showToast(`Updated stock record for ${medicineName} at ${centreId}.`, 'success');
        } else {
            inventoryState.push({
                id: `INV-${Date.now()}`,
                centreId,
                medicineName,
                currentStock,
                dailyConsumption,
                targetCoverageDays,
                lastUpdated
            });
            showToast(`Added new stock record for ${medicineName} at ${centreId}.`, 'success');
        }

        saveStateToStorage();
        populateDropdowns();
        renderDashboard();
        modalStock.classList.remove('open');
        formStock.reset();
    });

    // Batch Modal Control
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

    // Add Batch Form Submit
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
