/**
 * ============================================================================
 * MEDI-CARE: PHC MEDICINE STOCK-OUT EARLY WARNING & REDISTRIBUTION ENGINE
 * ============================================================================
 * Pitch: "Count the days, then look sideways before you look up."
 * ============================================================================
 */

// --- Global Helpers & Date Formatting ---

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
    const loc = currentLanguage === 'ta' ? 'ta-IN' : 'en-IN';
    const parsed = parseLocalDate(dateStr);
    return parsed.toLocaleDateString(loc, { day: '2-digit', month: 'short', year: 'numeric' });
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

// --- Active State Variables ---
let leadTimeDays = 10;
let voiceAssistantEnabled = false;
let isSimpleModeActive = false;
let selectedVoiceLanguage = 'ta-IN';
let activeSpeechRecognition = null;
let isDemoDataLoaded = false;

let currentLanguage = localStorage.getItem('medicare_site_lang') || 'en';
let currentTheme = localStorage.getItem('medicare_theme') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

// --- Distance Matrix & Display Names ---
const distanceMatrix = {
    'Centre A': { 'Centre A': 0, 'Centre B': 15, 'Centre C': 9, 'Centre D': 22 },
    'Centre B': { 'Centre A': 15, 'Centre B': 0, 'Centre C': 12, 'Centre D': 8 },
    'Centre C': { 'Centre A': 9, 'Centre B': 12, 'Centre C': 0, 'Centre D': 18 },
    'Centre D': { 'Centre A': 22, 'Centre B': 8, 'Centre C': 18, 'Centre D': 0 }
};

const centreNames = {
    'Centre A': 'Centre A (PHC Alpha - Rampur)',
    'Centre B': 'Centre B (PHC Beta - Sundarpur)',
    'Centre C': 'Centre C (PHC Gamma - Chandanpur)',
    'Centre D': 'Centre D (PHC Delta - Krishnapur)'
};

const centreNamesTa = {
    'Centre A': 'மையம் A (PHC ஆல்ப-ராம்பூர்)',
    'Centre B': 'மையம் B (PHC பீட்டா-சுந்தர்பூர்)',
    'Centre C': 'மையம் C (PHC காமா-சந்தன்பூர்)',
    'Centre D': 'மையம் D (PHC டெல்டா-கிருஷ்ணாபூர்)'
};

const medicineNamesTa = {
    'Paracetamol Syrup (100ml)': 'பாராசிட்டமால் சிரப் (100 மி.லி)',
    'Amoxicillin 500mg Capsules': 'அமாக்சிசிலின் 500 மிகிராம் கேப்சூல்கள்',
    'ORS Electrolyte Packets': 'ORS எலக்ட்ரோலைட் பாக்கெட்டுகள்',
    'Metformin 500mg Tablets': 'மெட்ஃபார்மின் 500 மிகிராம் மாத்திரைகள்',
    'Amlodipine 5mg Tablets': 'ஆம்லோடிபைன் 5 மிகிராம் மாத்திரைகள்',
    'Artemether Injection (80mg)': 'ஆர்டெமிதர் ஊசி (80 மிகிராம்)',
    'Ciprofloxacin 500mg Tablets': 'சிப்ரோஃப்ளோக்சசின் 500 மிகிராம் மாத்திரைகள்',
    'Azithromycin 500mg Tablets': 'அசித்ரோமைசின் 500 மிகிராம் மாத்திரைகள்'
};

const barcodeCatalogue = {
    '8901234567890': { medicineName: 'Paracetamol Syrup (100ml)', unit: '100ml', defaultDailyUse: 8, targetDays: 30 },
    '8901234567891': { medicineName: 'Amoxicillin 500mg Capsules', unit: 'Capsules', defaultDailyUse: 15, targetDays: 30 },
    '8901234567892': { medicineName: 'ORS Electrolyte Packets', unit: 'Packets', defaultDailyUse: 12, targetDays: 30 },
    '8901234567893': { medicineName: 'Metformin 500mg Tablets', unit: 'Tablets', defaultDailyUse: 10, targetDays: 30 },
    '8901234567894': { medicineName: 'Amlodipine 5mg Tablets', unit: 'Tablets', defaultDailyUse: 7, targetDays: 30 },
    '8901234567895': { medicineName: 'Artemether Injection (80mg)', unit: 'Vials', defaultDailyUse: 3, targetDays: 30 },
    '8901234567896': { medicineName: 'Ciprofloxacin 500mg Tablets', unit: 'Tablets', defaultDailyUse: 5, targetDays: 30 },
    '8901234567897': { medicineName: 'Azithromycin 500mg Tablets', unit: 'Tablets', defaultDailyUse: 4, targetDays: 30 }
};

// Initial Seed Data
const initialInventorySeed = [
    { id: 'INV-001', centreId: 'Centre A', medicineName: 'Paracetamol Syrup (100ml)', currentStock: 40, dailyConsumption: 8, targetCoverageDays: 30, lastUpdated: getPastDateString(2), lastTransferAt: null },
    { id: 'INV-002', centreId: 'Centre B', medicineName: 'Paracetamol Syrup (100ml)', currentStock: 250, dailyConsumption: 5, targetCoverageDays: 30, lastUpdated: getPastDateString(1), lastTransferAt: null },
    { id: 'INV-003', centreId: 'Centre C', medicineName: 'Paracetamol Syrup (100ml)', currentStock: 180, dailyConsumption: 3, targetCoverageDays: 30, lastUpdated: getPastDateString(0), lastTransferAt: null },
    { id: 'INV-004', centreId: 'Centre A', medicineName: 'Amoxicillin 500mg Capsules', currentStock: 120, dailyConsumption: 15, targetCoverageDays: 30, lastUpdated: getPastDateString(18), lastTransferAt: null },
    { id: 'INV-005', centreId: 'Centre B', medicineName: 'Amoxicillin 500mg Capsules', currentStock: 500, dailyConsumption: 10, targetCoverageDays: 30, lastUpdated: getPastDateString(3), lastTransferAt: null },
    { id: 'INV-006', centreId: 'Centre C', medicineName: 'ORS Electrolyte Packets', currentStock: 50, dailyConsumption: 12, targetCoverageDays: 30, lastUpdated: getPastDateString(1), lastTransferAt: null },
    { id: 'INV-007', centreId: 'Centre D', medicineName: 'ORS Electrolyte Packets', currentStock: 450, dailyConsumption: 6, targetCoverageDays: 30, lastUpdated: getPastDateString(0), lastTransferAt: null },
    { id: 'INV-008', centreId: 'Centre A', medicineName: 'Metformin 500mg Tablets', currentStock: 300, dailyConsumption: 0, targetCoverageDays: 30, lastUpdated: getPastDateString(4), lastTransferAt: null },
    { id: 'INV-009', centreId: 'Centre D', medicineName: 'Amlodipine 5mg Tablets', currentStock: 60, dailyConsumption: 7, targetCoverageDays: 30, lastUpdated: getPastDateString(2), lastTransferAt: null },
    { id: 'INV-010', centreId: 'Centre B', medicineName: 'Artemether Injection (80mg)', currentStock: 90, dailyConsumption: 3, targetCoverageDays: 30, lastUpdated: getPastDateString(5), lastTransferAt: null }
];

const initialBatchSeed = [
    { id: 'BAT-001', batchNumber: 'BATCH-2025-P01', centreId: 'Centre A', medicineName: 'Paracetamol Syrup (100ml)', quantity: 40, expiryDate: getFutureDateString(120) },
    { id: 'BAT-002', batchNumber: 'BATCH-2025-P02', centreId: 'Centre B', medicineName: 'Paracetamol Syrup (100ml)', quantity: 250, expiryDate: getFutureDateString(200) },
    { id: 'BAT-003', batchNumber: 'BATCH-2025-A99', centreId: 'Centre A', medicineName: 'Amoxicillin 500mg Capsules', quantity: 30, expiryDate: getPastDateString(10) },
    { id: 'BAT-004', batchNumber: 'BATCH-2026-O15', centreId: 'Centre C', medicineName: 'ORS Electrolyte Packets', quantity: 50, expiryDate: getFutureDateString(35) }
];

// Persistent State Loaders
function loadSavedInventory() {
    const saved = localStorage.getItem('medicare_inventory_state');
    if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
    }
    return JSON.parse(JSON.stringify(initialInventorySeed));
}

function loadSavedBatches() {
    const saved = localStorage.getItem('medicare_batch_state');
    if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
    }
    return JSON.parse(JSON.stringify(initialBatchSeed));
}

function loadSavedPendingRequests() {
    const saved = localStorage.getItem('medicare_pending_requests');
    if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
}

function loadSavedAuditLog() {
    const saved = localStorage.getItem('medicare_audit_log');
    if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
}

function loadSavedSyncQueue() {
    const saved = localStorage.getItem('medicare_sync_queue');
    if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
}

let inventoryState = loadSavedInventory();
let batchState = loadSavedBatches();
let pendingRequestsState = loadSavedPendingRequests();
let auditLogState = loadSavedAuditLog();
let syncQueueState = loadSavedSyncQueue();

function saveStateToStorage() {
    try {
        localStorage.setItem('medicare_inventory_state', JSON.stringify(inventoryState));
        localStorage.setItem('medicare_batch_state', JSON.stringify(batchState));
        localStorage.setItem('medicare_pending_requests', JSON.stringify(pendingRequestsState));
        localStorage.setItem('medicare_audit_log', JSON.stringify(auditLogState));
        localStorage.setItem('medicare_sync_queue', JSON.stringify(syncQueueState));
    } catch (e) {
        console.error('Storage quota error', e);
        showToast('Storage Limit Reached: Could not save state to browser storage.', 'error');
    }
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

function calculateStockoutDate(daysRemaining) {
    if (!isFinite(daysRemaining) || isNaN(daysRemaining) || daysRemaining < 0) {
        return currentLanguage === 'ta' ? 'அபாயமில்லை (0 பயன்பாடு)' : 'No Risk (0 Use)';
    }
    if (daysRemaining === 0) {
        return currentLanguage === 'ta' ? 'இன்றே தீர்ந்துவிட்டது' : 'OUT OF STOCK TODAY';
    }
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + Math.floor(daysRemaining));
    const loc = currentLanguage === 'ta' ? 'ta-IN' : 'en-IN';
    return d.toLocaleDateString(loc, { day: '2-digit', month: 'short', year: 'numeric' });
}

// --- Outbox Sync Queue Module ---
const OutboxQueue = {
    getQueue() {
        try {
            return JSON.parse(localStorage.getItem('medicare_sync_queue') || '[]');
        } catch (e) {
            return [];
        }
    },
    saveQueue(queue) {
        try {
            localStorage.setItem('medicare_sync_queue', JSON.stringify(queue));
            syncQueueState = queue;
        } catch (e) {}
    },
    enqueue(type, payload) {
        const queue = this.getQueue();
        const record = {
            id: `SYNC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            type,
            payload,
            createdAt: new Date().toISOString(),
            deviceId: 'DEV-PHC-01',
            attempts: 0,
            status: 'pending'
        };
        queue.push(record);
        this.saveQueue(queue);
        updateNetworkStatus();
        this.flush();
        return record;
    },
    async flush() {
        const isOnline = await checkRealConnectivity();
        if (!isOnline) return;

        const queue = this.getQueue();
        const pending = queue.filter(r => r.status === 'pending');
        if (pending.length === 0) return;

        let changed = false;
        for (const record of pending) {
            record.attempts++;
            const result = syncAdapter.send(record);
            if (result.success) {
                record.status = 'synced';
                changed = true;
            } else if (result.needsReview) {
                record.status = 'needs_review';
                changed = true;
                showToast(`Conflict detected for record ${record.id}. Sent for Medical Officer review.`, 'warning');
            } else {
                record.status = 'failed';
                changed = true;
            }
        }
        if (changed) {
            this.saveQueue(queue);
            updateNetworkStatus();
            renderSyncStatusPanel();
        }
    }
};

const syncAdapter = {
    send(record) {
        let serverDb = {};
        try {
            serverDb = JSON.parse(localStorage.getItem('medicare_mock_server_db') || '{}');
        } catch (e) {}

        const key = `rec_${record.type}_${record.payload.id || record.id}`;

        if (record.type === 'TRANSFER_APPROVE') {
            const { donor, recipient, medicine, qty } = record.payload;
            const donorItem = inventoryState.find(i => i.centreId === donor && i.medicineName === medicine);
            if (!donorItem || donorItem.currentStock < qty) {
                return { success: false, needsReview: true };
            }
        }

        serverDb[key] = { ...record, syncedAt: new Date().toISOString() };
        try {
            localStorage.setItem('medicare_mock_server_db', JSON.stringify(serverDb));
        } catch (e) {}

        return { success: true };
    }
};

let isRealOnline = navigator.onLine;
let lastSyncedTime = new Date();

async function checkRealConnectivity() {
    if (!navigator.onLine) {
        isRealOnline = false;
        return false;
    }
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`./ping.txt?t=${Date.now()}`, { cache: 'no-store', signal: controller.signal });
        clearTimeout(timeoutId);
        isRealOnline = res.ok;
        if (res.ok) lastSyncedTime = new Date();
        return res.ok;
    } catch (e) {
        isRealOnline = false;
        return false;
    }
}

function updateNetworkStatus() {
    const pill = document.getElementById('status-offline');
    const lbl = document.getElementById('lbl-network');
    const queue = OutboxQueue.getQueue();
    const pendingCount = queue.filter(r => r.status === 'pending').length;

    if (!pill || !lbl) return;

    const formattedTime = lastSyncedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (!isRealOnline) {
        pill.className = 'network-pill offline';
        lbl.textContent = currentLanguage === 'ta' 
            ? `ஆஃப்லைன் (${pendingCount} சேமிக்கப்பட்டது)` 
            : `Offline (${pendingCount} pending)`;
    } else if (pendingCount > 0) {
        pill.className = 'network-pill syncing';
        lbl.textContent = currentLanguage === 'ta' 
            ? `இணைக்கப்படுகிறது (${pendingCount})` 
            : `Syncing (${pendingCount})`;
    } else {
        pill.className = 'network-pill online';
        lbl.textContent = currentLanguage === 'ta' 
            ? `ஆன்லைன் (${formattedTime})` 
            : `Online (Synced ${formattedTime})`;
    }
}

// Centralized Translation Dictionary (English & Tamil)
const i18n = {
    en: {
        app_title: "MEDI-CARE",
        app_subtitle: "PHC Medicine Stock-Out Early Warning & Redistribution Engine",
        policy_notice: "Operational Policy: Inter-PHC stock redistribution requires Medical Officer PIN verification. Count days before ordering district stock.",
        network_online: "Online (Synced)",
        network_offline: "Offline Mode (Local Storage)",
        voice_off: "Voice: OFF",
        voice_on: "Voice: ON",
        simple_mode_on: "Switch to Standard View",
        simple_mode_off: "Guided Simple Mode",
        theme_light: "Light Mode",
        theme_dark: "Dark Mode",
        settings: "Settings",
        add_update_stock: "Add / Update Stock",
        choice_subtitle: "Select how you want to add medicine stock to the inventory:",
        btn_scan_barcode: "Scan Barcode",
        choice_scan_sub: "Use camera to scan medicine GTIN barcode",
        btn_enter_manually: "Enter Manually",
        choice_manual_sub: "Fill out physical stock form or 3-step wizard",
        settings_title: "System Settings & Data Tools",
        settings_desc: "Configure application parameters or load demonstration datasets for evaluation.",
        demo_data_heading: "Demonstration Benchmark Dataset",
        demo_data_desc: "Load the official hackathon benchmark dataset featuring Centre A shortage (60 stock, 6 days remaining) and Centre C safe surplus (140 transfer capacity).",
        btn_load_demo_confirm: "Load Demo Scenario Data",
        btn_reset_storage: "Clear Local Storage & Reset",
        btn_cancel: "Cancel",
        btn_confirm: "Confirm",
        voice_help_text: "Speak medicine names or quantities in Tamil or English to fill stock entries hands-free with mandatory confirmation.",
        btn_start_voice: "Start Speaking",
        btn_stop_voice: "Stop",
        btn_replay_voice: "Repeat Guidance",
        toast_demo_loaded: "Demo scenario data loaded successfully.",
        toast_stock_saved: "Stock entry saved successfully!",
        toast_transfer_requested: "Transfer request submitted for approval.",
        toast_transfer_approved: "Transfer approved and executed successfully!",
        toast_transfer_rejected: "Transfer request rejected.",
        toast_camera_stopped: "Camera stopped.",
        tab_overview: "Overview",
        tab_transfers: "Transfers",
        tab_approvals: "Approvals",
        tab_inventory: "Inventory",
        tab_batches: "Batches",
        tab_network: "Network",
        tab_simulator: "Simulator",
        tab_voice: "Voice",
        step1_predict: "1. Predict Days Left",
        step2_sideways: "2. Look Sideways (Surplus)",
        step3_district: "3. Then Look Up (District)",
        kpi_critical: "Critical Shortage",
        kpi_transfers: "Transfers Recommended",
        kpi_district: "District Order Needed",
        kpi_approvals: "Pending MO Approvals",
        section_alerts_title: "Active Stock Alert Cards (Action Required)",
        section_transfers_title: "Recommended Inter-PHC Stock Transfers",
        section_district_title: "District Supply Procurement Requirements",
        sync_status_heading: "Offline Sync Outbox",
        btn_sync_now: "Sync Now",
        status_critical: "CRITICAL",
        status_warning: "WARNING",
        status_safe: "SAFE",
        status_outdated: "OUTDATED",
        status_topup: "TOP-UP"
    },
    ta: {
        app_title: "MEDI-CARE (மேடி-கேர்)",
        app_subtitle: "ஆரம்ப சுகாதார நிலைய மருந்து பற்றாக்குறை எச்சரிக்கை மற்றும் மறுபகிர்வு முறைமை",
        policy_notice: "செயல்பாட்டு விதி: PHC இடையே மருந்து மாற்றம் செய்ய மருத்துவ அலுவலரின் PIN சரிபார்ப்பு தேவை. மாவட்ட ஆர்டருக்கு முன் நாட்களை கணக்கிடுங்கள்.",
        network_online: "ஆன்லைன் (இணைக்கப்பட்டது)",
        network_offline: "ஆஃப்லைன் முறைமை (உள்ளூர் சேமிப்பு)",
        voice_off: "குரல் உதவி: முடக்கப்பட்டது",
        voice_on: "குரல் உதவி: இயக்கப்பட்டது",
        simple_mode_on: "சாதாரண பார்வைக்கு மாறுக",
        simple_mode_off: "எளிய வழிகாட்டல் முறைமை",
        theme_light: "வெளிச்ச முறைமை (Light)",
        theme_dark: "இருண்ட முறைமை (Dark)",
        settings: "அமைப்புகள்",
        add_update_stock: "மருந்து இருப்பு சேர்க்க / புதுப்பிக்க",
        choice_subtitle: "மருந்து இருப்பு சேர்க்கும் முறையைத் தேர்ந்தெடுக்கவும்:",
        btn_scan_barcode: "பார்கோடு ஸ்கேன் செய்ய",
        choice_scan_sub: "கேமராவைப் பயன்படுத்தி பார்கோடு ஸ்கேன் செய்க",
        btn_enter_manually: "கைமுறையாக உள்ளிட",
        choice_manual_sub: "படிவம் மூலம் மருந்து விவரங்களை உள்ளிடுக",
        settings_title: "முறைமை அமைப்புகள் & தரவு கருவிகள்",
        settings_desc: "செயலி அமைப்புகளை மாற்றவும் அல்லது சோதனை தரவை ஏற்றவும்.",
        demo_data_heading: "சோதனை தரவு & காட்சிகள்",
        demo_data_desc: "சென்டர் A பற்றாக்குறை மற்றும் சென்டர் C மேலதிக இருப்பைக் கொண்ட ஹேக்கத்தான் மாதிரி தரவை ஏற்றவும்.",
        btn_load_demo_confirm: "மாதிரி காட்சி தரவை ஏற்றுக",
        btn_reset_storage: "உள்ளூர் நினைவகத்தை அழித்து மீட்டமைக்கவும்",
        btn_cancel: "ரத்து செய்",
        btn_confirm: "உறுதி செய்",
        voice_help_text: "மருந்து பெயர்கள் அல்லது எண்ணிக்கையை தமிழ் அல்லது ஆங்கிலத்தில் கூறி இருப்பை உள்ளிடுக. இறுதி உறுதிப்படுத்தல் கட்டாயமாகும்.",
        btn_start_voice: "பேசத் தொடங்கு",
        btn_stop_voice: "நிறுத்து",
        btn_replay_voice: "மீண்டும் கேள்",
        toast_demo_loaded: "மாதிரி தரவு வெற்றிகரமாக ஏற்றப்பட்டது.",
        toast_stock_saved: "மருந்து இருப்பு வெற்றிகரமாக சேமிக்கப்பட்டது!",
        toast_transfer_requested: "மருந்து மாற்றக் கோரிக்கை சமர்ப்பிக்கப்பட்டது.",
        toast_transfer_approved: "மருந்து மாற்றம் ஒப்புதல் அளிக்கப்பட்டு செயல்படுத்தப்பட்டது!",
        toast_transfer_rejected: "மருந்து மாற்றக் கோரிக்கை நிராகரிக்கப்பட்டது.",
        toast_camera_stopped: "கேமரா நிறுத்தப்பட்டது.",
        tab_overview: "மேலோட்டம்",
        tab_transfers: "மருந்து மாற்றங்கள்",
        tab_approvals: "ஒப்புதல்கள்",
        tab_inventory: "இருப்பு விவரம்",
        tab_batches: "தொகுப்புகள்",
        tab_network: "நிலையங்கள்",
        tab_simulator: "மாதிரி சோதனையகம்",
        tab_voice: "குரல் உதவி",
        step1_predict: "1. நாட்களை கணித்தல்",
        step2_sideways: "2. அருகிலுள்ள PHC (மேலதிக இருப்பு)",
        step3_district: "3. மாவட்ட கோரிக்கை",
        kpi_critical: "அவசர பற்றாக்குறை",
        kpi_transfers: "பரிந்துரைக்கப்பட்ட மாற்றங்கள்",
        kpi_district: "மாவட்ட ஆர்டர் தேவை",
        kpi_approvals: "காத்திருக்கும் ஒப்புதல்கள்",
        section_alerts_title: "செயலில் உள்ள எச்சரிக்கை கார்டுகள்",
        section_transfers_title: "பரிந்துரைக்கப்பட்ட PHC மருந்து மாற்றங்கள்",
        section_district_title: "மாவட்ட மருந்து கொள்முதல் தேவைகள்",
        sync_status_heading: "ஆஃப்லைன் ஒத்திசைவு வரிசை",
        btn_sync_now: "இப்போதே ஒத்திசை",
        status_critical: "அவசரம்",
        status_warning: "எச்சரிக்கை",
        status_safe: "பாதுகாப்பு",
        status_outdated: "பழைய பதிவு",
        status_topup: "இருப்பு ஈடுசெய்தல்"
    }
};

function t(key, params = {}) {
    let str = (i18n[currentLanguage] && i18n[currentLanguage][key])
        ? i18n[currentLanguage][key]
        : (i18n['en'][key] || key);

    Object.keys(params).forEach(p => {
        str = str.replace(new RegExp(`\\{${p}\\}`, 'g'), params[p]);
    });
    return str;
}

function setLanguage(lang) {
    if (lang !== 'en' && lang !== 'ta') lang = 'en';
    currentLanguage = lang;
    localStorage.setItem('medicare_site_lang', lang);

    document.documentElement.setAttribute('lang', lang);

    const selSiteLang = document.getElementById('select-site-lang');
    if (selSiteLang) selSiteLang.value = lang;

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const k = el.getAttribute('data-i18n');
        if (k && i18n[lang] && i18n[lang][k]) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = i18n[lang][k];
            } else {
                el.innerHTML = i18n[lang][k];
            }
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const k = el.getAttribute('data-i18n-placeholder');
        if (k && i18n[lang] && i18n[lang][k]) {
            el.placeholder = i18n[lang][k];
        }
    });

    const lblMode = document.getElementById('lbl-mode');
    if (lblMode) lblMode.textContent = isSimpleModeActive ? t('simple_mode_on') : t('simple_mode_off');

    const lblVoice = document.getElementById('lbl-voice');
    if (lblVoice) lblVoice.textContent = voiceAssistantEnabled ? (currentLanguage === 'ta' ? 'குரல்: இயக்கத்தில்' : 'Voice: ON') : t('voice_off');

    const lblTheme = document.getElementById('lbl-theme');
    if (lblTheme) lblTheme.textContent = currentTheme === 'dark' ? t('theme_light') : t('theme_dark');

    renderDashboard();
    updateNetworkStatus();

    if (window.location.search.includes('i18ncheck')) {
        runI18nDevCheck();
    }
}

function runI18nDevCheck() {
    console.log('=== MEDI-CARE I18N DEV CHECK ===');
    const enKeys = Object.keys(i18n.en);
    const taKeys = Object.keys(i18n.ta);
    const missingInTa = enKeys.filter(k => !taKeys.includes(k));
    if (missingInTa.length > 0) {
        console.warn('Missing Tamil keys:', missingInTa);
    } else {
        console.log('All English keys present in Tamil dictionary.');
    }
}

function setTheme(theme) {
    if (theme !== 'dark' && theme !== 'light') theme = 'light';
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('medicare_theme', theme);

    const lblTheme = document.getElementById('lbl-theme');
    if (lblTheme) lblTheme.textContent = theme === 'dark' ? t('theme_light') : t('theme_dark');
}

function toggleTheme() {
    setTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

// --- Forecast & Redistribution Engine (Core Formulas Preserved) ---

function getItemBatchAnalysis(centreId, medicineName) {
    const matchingBatches = batchState.filter(b =>
        b.centreId === centreId &&
        b.medicineName.toLowerCase().trim() === medicineName.toLowerCase().trim()
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

function getMedicineUnitNoun(medicineName) {
    if (!medicineName) return { en: 'units', ta: 'அலகுகள்' };
    const nameLower = medicineName.toLowerCase();
    const catEntry = Object.values(barcodeCatalogue).find(c => c.medicineName.toLowerCase() === nameLower);
    let u = catEntry ? catEntry.unit.toLowerCase() : '';

    if (u.includes('capsule') || nameLower.includes('capsule')) return { en: 'capsules', ta: 'கேப்சூல்கள்' };
    if (u.includes('packet') || nameLower.includes('packet') || nameLower.includes('ors')) return { en: 'packets', ta: 'பாக்கெட்டுகள்' };
    if (u.includes('vial') || nameLower.includes('injection') || nameLower.includes('vial')) return { en: 'vials', ta: 'வயல்கள்' };
    if (u.includes('bottle') || u.includes('100ml') || nameLower.includes('syrup') || nameLower.includes('100ml')) return { en: 'bottles', ta: 'பாட்டில்கள்' };
    return { en: 'tablets', ta: 'மாத்திரைகள்' };
}

// Phase 3: Single explainAlert function returning { en, ta } sentences <= 25 words
function explainAlert(item, context = null) {
    const medNameEn = item.medicineName;
    const medNameTa = medicineNamesTa[item.medicineName] || item.medicineName;
    const centreNameEn = item.centreId;
    const centreNameTa = centreNamesTa[item.centreId] || item.centreId;
    const unit = getMedicineUnitNoun(item.medicineName);

    const daysSince = item.daysSinceUpdate;
    if (item.isOutdated) {
        return {
            en: `The ${medNameEn} count at ${centreNameEn} is ${daysSince} days old. Please count the stock and update it.`,
            ta: `${centreNameTa}-இல் ${medNameTa} எண்ணிக்கை ${daysSince} நாட்களுக்கு முந்தையது. இருப்பை எண்ணி புதுப்பிக்கவும்.`
        };
    }

    let suggestedTransfer = null;
    let districtReq = null;
    if (context) {
        if (context.suggestedTransfers) {
            suggestedTransfer = context.suggestedTransfers.find(t => t.recipientCentre === item.centreId && t.medicineName === item.medicineName);
        }
        if (context.districtRequirements) {
            districtReq = context.districtRequirements.find(d => d.centreId === item.centreId && d.medicineName === item.medicineName);
        }
    }

    const { expiredQty, nearExpiryQty } = getItemBatchAnalysis(item.centreId, item.medicineName);
    const daysLeft = item.daysRemaining;
    const daysStr = daysLeft === Infinity ? '30+' : daysLeft.toFixed(1);

    if (item.usableStock === 0 && item.dailyConsumption > 0) {
        if (suggestedTransfer) {
            const donorTa = centreNamesTa[suggestedTransfer.donorCentre] || suggestedTransfer.donorCentre;
            return {
                en: `${medNameEn} is finished at ${centreNameEn}. Ask ${suggestedTransfer.donorCentre} (${suggestedTransfer.distanceKm} km away) for ${suggestedTransfer.transferQty} ${unit.en} today.`,
                ta: `${centreNameTa}-இல் ${medNameTa} தீர்ந்துவிட்டது. இன்றே ${donorTa}-இடம் (${suggestedTransfer.distanceKm} கிமீ) ${suggestedTransfer.transferQty} ${unit.ta} கேளுங்கள்.`
            };
        } else if (districtReq) {
            return {
                en: `${medNameEn} is finished at ${centreNameEn}. Request ${districtReq.remainingDistrictReq} ${unit.en} from the district immediately.`,
                ta: `${centreNameTa}-இல் ${medNameTa} தீர்ந்துவிட்டது. உடனடியாக மாவட்டத்திடம் ${districtReq.remainingDistrictReq} ${unit.ta} கோருங்கள்.`
            };
        }
        return {
            en: `${medNameEn} is finished at ${centreNameEn}. Replenishment is required immediately.`,
            ta: `${centreNameTa}-இல் ${medNameTa} தீர்ந்துவிட்டது. உடனடியாக புதிய இருப்பு தேவை.`
        };
    }

    if (daysLeft <= leadTimeDays) {
        if (suggestedTransfer && districtReq && districtReq.remainingDistrictReq > 0) {
            const donorTa = centreNamesTa[suggestedTransfer.donorCentre] || suggestedTransfer.donorCentre;
            return {
                en: `${medNameEn} at ${centreNameEn} will run out in ${daysStr} days. Ask ${suggestedTransfer.donorCentre} (${suggestedTransfer.distanceKm} km away) for ${suggestedTransfer.transferQty} ${unit.en}, then request the other ${districtReq.remainingDistrictReq} from the district.`,
                ta: `${centreNameTa}-இல் ${medNameTa} ${daysStr} நாட்களில் தீர்ந்துவிடும். ${donorTa}-இடமிருந்து (${suggestedTransfer.distanceKm} கிமீ) ${suggestedTransfer.transferQty} ${unit.ta} கேளுங்கள்; மீதமுள்ள ${districtReq.remainingDistrictReq}-ஐ மாவட்டத்திடம் கோருங்கள்.`
            };
        } else if (suggestedTransfer) {
            const donorTa = centreNamesTa[suggestedTransfer.donorCentre] || suggestedTransfer.donorCentre;
            return {
                en: `${medNameEn} at ${centreNameEn} will run out in ${daysStr} days. Ask ${suggestedTransfer.donorCentre} (${suggestedTransfer.distanceKm} km away) for ${suggestedTransfer.transferQty} ${unit.en}.`,
                ta: `${centreNameTa}-இல் ${medNameTa} ${daysStr} நாட்களில் தீர்ந்துவிடும். ${donorTa}-இடமிருந்து (${suggestedTransfer.distanceKm} கிமீ) ${suggestedTransfer.transferQty} ${unit.ta} கேளுங்கள்.`
            };
        } else if (districtReq) {
            return {
                en: `${medNameEn} at ${centreNameEn} will run out in ${daysStr} days. Request ${districtReq.remainingDistrictReq} ${unit.en} from the district.`,
                ta: `${centreNameTa}-இல் ${medNameTa} ${daysStr} நாட்களில் தீர்ந்துவிடும். மாவட்டத்திடம் ${districtReq.remainingDistrictReq} ${unit.ta} கோருங்கள்.`
            };
        }
        return {
            en: `${medNameEn} at ${centreNameEn} will run out in ${daysStr} days. Please arrange replenishment.`,
            ta: `${centreNameTa}-இல் ${medNameTa} ${daysStr} நாட்களில் தீர்ந்துவிடும். புதிய இருப்புக்கு ஏற்பாடு செய்யுங்கள்.`
        };
    }

    if (expiredQty > 0) {
        return {
            en: `${centreNameEn} has ${expiredQty} expired ${unit.en} of ${medNameEn}. Remove expired stock and audit.`,
            ta: `${centreNameTa}-இல் ${expiredQty} காலாவதியான ${medNameTa} ${unit.ta} உள்ளன. அவற்றை அகற்றி சரிபார்க்கவும்.`
        };
    }

    if (nearExpiryQty > 0) {
        return {
            en: `${centreNameEn} has ${nearExpiryQty} ${unit.en} of ${medNameEn} expiring soon. Dispense these batches first.`,
            ta: `${centreNameTa}-இல் ${nearExpiryQty} ${unit.ta} ${medNameTa} விரைவில் காலாவதியாகும். இந்த தொகுப்புகளை முதலில் வழங்கவும்.`
        };
    }

    if (daysLeft <= leadTimeDays * 1.5 || item.shortfall > 0) {
        return {
            en: `${medNameEn} stock at ${centreNameEn} covers ${daysStr} days. Plan replenishment soon to maintain safe stock.`,
            ta: `${centreNameTa}-இல் ${medNameTa} இருப்பு ${daysStr} நாட்களுக்கு உள்ளது. பாதுகாப்பான இருப்பை பராமரிக்க விரைவில் திட்டமிடுங்கள்.`
        };
    }

    return {
        en: `${medNameEn} stock at ${centreNameEn} safely covers ${daysStr} days.`,
        ta: `${centreNameTa}-இல் ${medNameTa} இருப்பு ${daysStr} நாட்களுக்கு பாதுகாப்பாக உள்ளது.`
    };
}

function processForecastItem(item) {
    const daysSinceUpdate = getDaysSince(item.lastUpdated);
    const isOutdated = daysSinceUpdate > 14 || daysSinceUpdate < 0;

    const { expiredQty, nearExpiryQty } = getItemBatchAnalysis(item.centreId, item.medicineName);
    const usableStock = Math.max(0, item.currentStock - expiredQty);

    let daysRemaining;
    if (item.dailyConsumption <= 0) {
        daysRemaining = Infinity;
    } else if (usableStock === 0) {
        daysRemaining = 0;
    } else {
        daysRemaining = usableStock / item.dailyConsumption;
    }

    const targetStock = item.dailyConsumption * item.targetCoverageDays;
    const shortfall = Math.max(0, Math.round(targetStock - usableStock));

    const safetyStock = item.dailyConsumption * item.targetCoverageDays;
    const rawSurplus = Math.max(0, Math.round(usableStock - safetyStock));
    const donorSurplus = isOutdated ? 0 : rawSurplus;

    let status = 'SAFE';
    if (isOutdated) {
        status = 'OUTDATED';
    } else if (usableStock === 0 && item.dailyConsumption > 0) {
        status = 'CRITICAL';
    } else if (daysRemaining <= leadTimeDays) {
        status = 'CRITICAL';
    } else if (daysRemaining <= leadTimeDays * 1.5) {
        status = 'WARNING';
    } else {
        status = 'SAFE';
    }

    const alertObj = explainAlert({ ...item, usableStock, daysRemaining, daysSinceUpdate, isOutdated, shortfall });

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
        rawSurplus,
        donorSurplus,
        status,
        riskReason: alertObj.en,
        alertObj
    };
}

function computeTransferImpact(donorCentre, recipientCentre, medicineName, qty) {
    const donorItem = inventoryState.find(i => i.centreId === donorCentre && i.medicineName === medicineName);
    const recipientItem = inventoryState.find(i => i.centreId === recipientCentre && i.medicineName === medicineName);

    if (!donorItem || !recipientItem) {
        return {
            donor: { centre: donorCentre, stockBefore: 0, stockAfter: 0, daysBefore: 0, daysAfter: 0, statusBefore: 'SAFE', statusAfter: 'SAFE', surplusBefore: 0, surplusAfter: 0 },
            recipient: { centre: recipientCentre, stockBefore: 0, stockAfter: 0, daysBefore: 0, daysAfter: 0, statusBefore: 'CRITICAL', statusAfter: 'SAFE', shortfallBefore: 0, shortfallAfter: 0 }
        };
    }

    const donorP = processForecastItem(donorItem);
    const recipP = processForecastItem(recipientItem);

    const donorNewStock = Math.max(0, donorItem.currentStock - qty);
    const recipNewStock = recipientItem.currentStock + qty;

    const donorMockItem = { ...donorItem, currentStock: donorNewStock };
    const recipMockItem = { ...recipientItem, currentStock: recipNewStock };

    const donorAfter = processForecastItem(donorMockItem);
    const recipAfter = processForecastItem(recipMockItem);

    return {
        donor: {
            centre: donorCentre,
            stockBefore: donorP.usableStock,
            stockAfter: donorAfter.usableStock,
            daysBefore: donorP.daysRemaining,
            daysAfter: donorAfter.daysRemaining,
            statusBefore: donorP.status,
            statusAfter: donorAfter.status,
            surplusBefore: donorP.donorSurplus,
            surplusAfter: donorAfter.donorSurplus
        },
        recipient: {
            centre: recipientCentre,
            stockBefore: recipP.usableStock,
            stockAfter: recipAfter.usableStock,
            daysBefore: recipP.daysRemaining,
            daysAfter: recipAfter.daysRemaining,
            statusBefore: recipP.status,
            statusAfter: recipAfter.status,
            shortfallBefore: recipP.shortfall,
            shortfallAfter: recipAfter.shortfall
        }
    };
}

function impactHtml(impact) {
    const formatDays = d => (d === Infinity ? 'Infinite' : `${d.toFixed(1)}d`);
    const recipName = currentLanguage === 'ta' ? (centreNamesTa[impact.recipient.centre] || impact.recipient.centre) : impact.recipient.centre;
    const donorName = currentLanguage === 'ta' ? (centreNamesTa[impact.donor.centre] || impact.donor.centre) : impact.donor.centre;

    return `
        <div class="impact-card">
            <div class="impact-title">${currentLanguage === 'ta' ? 'இரட்டை PHC தாக்கத்தின் கணிப்பு (Transfer Impact)' : 'Before & After Impact Analysis'}</div>
            <div class="impact-grid">
                <div class="impact-box recipient-box">
                    <div class="impact-box-title">${currentLanguage === 'ta' ? 'பெறுநர் (Recipient)' : 'Recipient PHC'}: ${esc(recipName)}</div>
                    <div class="impact-row"><span>${currentLanguage === 'ta' ? 'இருப்பு' : 'Usable Stock'}:</span> <strong>${impact.recipient.stockBefore} → ${impact.recipient.stockAfter}</strong></div>
                    <div class="impact-row"><span>${currentLanguage === 'ta' ? 'நாட்கள்' : 'Days Covered'}:</span> <strong>${formatDays(impact.recipient.daysBefore)} → ${formatDays(impact.recipient.daysAfter)}</strong></div>
                    <div class="impact-row"><span>${currentLanguage === 'ta' ? 'பற்றாக்குறை' : 'Shortfall'}:</span> <strong>${impact.recipient.shortfallBefore} → ${impact.recipient.shortfallAfter}</strong></div>
                </div>
                <div class="impact-box donor-box">
                    <div class="impact-box-title">${currentLanguage === 'ta' ? 'வழங்குநர் (Donor)' : 'Donor PHC'}: ${esc(donorName)}</div>
                    <div class="impact-row"><span>${currentLanguage === 'ta' ? 'இருப்பு' : 'Usable Stock'}:</span> <strong>${impact.donor.stockBefore} → ${impact.donor.stockAfter}</strong></div>
                    <div class="impact-row"><span>${currentLanguage === 'ta' ? 'நாட்கள்' : 'Days Covered'}:</span> <strong>${formatDays(impact.donor.daysBefore)} → ${formatDays(impact.donor.daysAfter)}</strong></div>
                    <div class="impact-row"><span>${currentLanguage === 'ta' ? 'மேலதிக இருப்பு' : 'Safe Surplus'}:</span> <strong>${impact.donor.surplusBefore} → ${impact.donor.surplusAfter}</strong></div>
                </div>
            </div>
        </div>
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

function computeRedistribution(processedInventory) {
    const suggestedTransfers = [];
    const districtRequirements = [];

    const shortages = processedInventory
        .filter(item => item.shortfall > 0)
        .sort((a, b) => a.daysRemaining - b.daysRemaining);

    const surplusTracker = {};
    processedInventory.forEach(item => {
        surplusTracker[item.id] = item.isOutdated ? 0 : item.donorSurplus;
    });

    shortages.forEach(recipient => {
        let neededQty = recipient.shortfall;
        let totalAllocatedForRecipient = 0;

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
            const unit = getMedicineUnitNoun(recipient.medicineName);
            const donorName = currentLanguage === 'ta' ? (centreNamesTa[donorItem.centreId] || donorItem.centreId) : donorItem.centreId;
            const reasoning = `${donorName} keeps its own 30 days of stock and can spare ${availableSurplus} ${unit.en}. Distance: ${distance} km.`;

            // Phase 1 bug fix: Use honest label TOP-UP when daysRemaining > leadTimeDays
            suggestedTransfers.push({
                priority: recipient.isOutdated ? 'OUTDATED (Verify)' : (recipient.daysRemaining <= leadTimeDays ? 'CRITICAL' : 'TOP-UP'),
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

function executeApprovedTransfer(donorCentre, recipientCentre, medicineName, qty) {
    const donorIdx = inventoryState.findIndex(i => i.centreId === donorCentre && i.medicineName === medicineName);
    let recipientIdx = inventoryState.findIndex(i => i.centreId === recipientCentre && i.medicineName === medicineName);

    if (donorIdx < 0) {
        showToast('Error: Donor inventory record not found.', 'error');
        return false;
    }

    const donorItem = inventoryState[donorIdx];
    const { validBatchQty } = getItemBatchAnalysis(donorCentre, medicineName);

    if (donorItem.currentStock < qty || validBatchQty < qty) {
        showToast(`Cannot execute transfer: Donor stock (${donorItem.currentStock}) or valid batch stock (${validBatchQty}) is less than transfer quantity (${qty}).`, 'error');
        return false;
    }

    donorItem.currentStock -= qty;
    donorItem.lastUpdated = toLocalISO(new Date());
    donorItem.lastTransferAt = toLocalISO(new Date());

    if (recipientIdx >= 0) {
        inventoryState[recipientIdx].currentStock += qty;
        inventoryState[recipientIdx].lastUpdated = toLocalISO(new Date());
        inventoryState[recipientIdx].lastTransferAt = toLocalISO(new Date());
    } else {
        inventoryState.push({
            id: `INV-${Date.now()}`,
            centreId: recipientCentre,
            medicineName,
            currentStock: qty,
            dailyConsumption: donorItem.dailyConsumption || 5,
            targetCoverageDays: 30,
            lastUpdated: toLocalISO(new Date()),
            lastTransferAt: toLocalISO(new Date())
        });
    }

    // Deduct quantity from donor non-expired batches
    let remainingToDeduct = qty;
    const donorBatches = batchState.filter(b => b.centreId === donorCentre && b.medicineName.toLowerCase() === medicineName.toLowerCase() && getDaysUntilExpiry(b.expiryDate) >= 0);
    donorBatches.sort((a, b) => getDaysUntilExpiry(a.expiryDate) - getDaysUntilExpiry(b.expiryDate));

    for (let b of donorBatches) {
        if (remainingToDeduct <= 0) break;
        if (b.quantity <= remainingToDeduct) {
            remainingToDeduct -= b.quantity;
            b.quantity = 0;
        } else {
            b.quantity -= remainingToDeduct;
            remainingToDeduct = 0;
        }
    }
    batchState = batchState.filter(b => b.quantity > 0);

    // Add new batch for recipient
    batchState.push({
        id: `BAT-${Date.now()}`,
        batchNumber: `TRANS-${Math.floor(Math.random() * 10000)}`,
        centreId: recipientCentre,
        medicineName,
        quantity: qty,
        expiryDate: getFutureDateString(180)
    });

    saveStateToStorage();
    OutboxQueue.enqueue('TRANSFER_APPROVE', { donor: donorCentre, recipient: recipientCentre, medicine: medicineName, qty });
    return true;
}

// --- Dashboard Rendering ---

function renderDashboard() {
    if (typeof document === 'undefined') return;

    const searchTerm = (document.getElementById('filter-search')?.value || '').toLowerCase().trim();
    const selCentre = document.getElementById('filter-centre')?.value || 'ALL';
    const selMed = document.getElementById('filter-medicine')?.value || 'ALL';
    const selUrgency = document.getElementById('filter-urgency')?.value || 'ALL';

    const processedInventory = inventoryState.map(processForecastItem);
    const redistribution = computeRedistribution(processedInventory);

    // Filtered inventory list for tables
    const filteredInventory = processedInventory.filter(item => {
        if (selCentre !== 'ALL' && item.centreId !== selCentre) return false;
        if (selMed !== 'ALL' && item.medicineName !== selMed) return false;
        if (selUrgency !== 'ALL' && item.status !== selUrgency) return false;
        if (searchTerm) {
            const matchesMed = item.medicineName.toLowerCase().includes(searchTerm);
            const matchesCentre = item.centreId.toLowerCase().includes(searchTerm);
            if (!matchesMed && !matchesCentre) return false;
        }
        return true;
    });

    renderKpiSummary(processedInventory, redistribution);
    renderActiveAlertCards(processedInventory, redistribution);
    renderRedistribution(redistribution);
    renderPendingApprovals();
    renderInventoryTable(filteredInventory, redistribution);
    renderBatchTable();
    renderAuditLogTable();
    renderFacilityCards(processedInventory);
    renderSimulator(processedInventory);
    renderSimpleModeView(processedInventory, redistribution);
    renderSyncStatusPanel();
}

function renderKpiSummary(processedInventory, redistribution) {
    const criticalCount = processedInventory.filter(i => i.status === 'CRITICAL').length;
    const transferCount = redistribution.suggestedTransfers.length;
    const districtCount = redistribution.districtRequirements.length;
    const pendingApprovalCount = pendingRequestsState.filter(r => r.status === 'PENDING').length;

    const elCrit = document.getElementById('metric-critical');
    if (elCrit) elCrit.textContent = criticalCount;

    const elTrans = document.getElementById('metric-transfers');
    if (elTrans) elTrans.textContent = transferCount;

    const elDist = document.getElementById('metric-district');
    if (elDist) elDist.textContent = districtCount;

    const elAppr = document.getElementById('metric-pending-approvals');
    if (elAppr) elAppr.textContent = pendingApprovalCount;

    // Badges on nav tabs
    const badgeAppr = document.getElementById('nav-badge-approvals');
    if (badgeAppr) {
        badgeAppr.textContent = pendingApprovalCount;
        badgeAppr.style.display = pendingApprovalCount > 0 ? 'inline-block' : 'none';
    }
}

function renderActiveAlertCards(processedInventory, redistribution) {
    const container = document.getElementById('active-alerts-cards-container');
    if (!container) return;

    const alertItems = processedInventory.filter(i => i.status === 'CRITICAL' || i.status === 'WARNING' || i.status === 'OUTDATED');
    if (alertItems.length === 0) {
        container.innerHTML = `<div class="empty-state">${currentLanguage === 'ta' ? 'தற்போது அவசர எச்சரிக்கைகள் எதுவுமில்லை. அனைத்து PHC மருந்துகளும் பாதுகாப்பாக உள்ளன.' : 'No active critical alerts. All PHC stock levels are currently safe.'}</div>`;
        return;
    }

    container.innerHTML = alertItems.map(item => {
        const plainSentence = explainAlert(item, redistribution)[currentLanguage];
        const statusLabel = t(`status_${item.status.toLowerCase()}`);
        const cName = currentLanguage === 'ta' ? (centreNamesTa[item.centreId] || item.centreId) : item.centreId;
        const mName = currentLanguage === 'ta' ? (medicineNamesTa[item.medicineName] || item.medicineName) : item.medicineName;
        const pct = Math.min(100, Math.round((item.daysRemaining / (leadTimeDays * 3)) * 100));

        let actionBtn = '';
        const hasTransfer = redistribution.suggestedTransfers.some(t => t.recipientCentre === item.centreId && t.medicineName === item.medicineName);
        if (hasTransfer) {
            actionBtn = `<button class="btn btn-primary btn-sm" onclick="switchTab('tab-transfers')">${currentLanguage === 'ta' ? 'மாற்றத்தை பரிசீலிக்கவும்' : 'Review Transfer'}</button>`;
        } else if (item.isOutdated) {
            actionBtn = `<button class="btn btn-outline btn-sm" onclick="switchTab('tab-inventory')">${currentLanguage === 'ta' ? 'இருப்பை புதுப்பிக்கவும்' : 'Audit Stock'}</button>`;
        } else {
            actionBtn = `<button class="btn btn-outline btn-sm" onclick="switchTab('tab-transfers')">${currentLanguage === 'ta' ? 'மாவட்ட ஆர்டரை காண்க' : 'View District Req'}</button>`;
        }

        return `
            <div class="alert-card alert-card-${item.status.toLowerCase()}">
                <div class="alert-card-header">
                    <div class="alert-card-title">
                        <span class="status-pill status-${item.status.toLowerCase()}">${statusLabel}</span>
                        <strong>${esc(mName)}</strong>
                    </div>
                    <span class="alert-card-centre">${esc(cName)}</span>
                </div>
                <p class="alert-card-sentence">${esc(plainSentence)}</p>
                <div class="alert-card-footer">
                    <div class="progress-bar-wrap" title="Coverage days vs safety target">
                        <div class="progress-bar-fill progress-${item.status.toLowerCase()}" style="width: ${pct}%"></div>
                    </div>
                    <div class="alert-card-actions">
                        <small>${currentLanguage === 'ta' ? 'தீரும் தேதி' : 'Stockout'}: ${calculateStockoutDate(item.daysRemaining)}</small>
                        ${actionBtn}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderRedistribution(redistribution) {
    const containerTransfers = document.getElementById('suggested-transfers-container');
    if (containerTransfers) {
        if (redistribution.suggestedTransfers.length === 0) {
            containerTransfers.innerHTML = `<div class="empty-state">${currentLanguage === 'ta' ? 'தற்போது PHC இடையே மாற்றக்கூடிய மேலதிக இருப்பு எதுவும் இல்லை.' : 'No inter-PHC transfers recommended at this time.'}</div>`;
        } else {
            containerTransfers.innerHTML = redistribution.suggestedTransfers.map((tItem, idx) => {
                const isPending = pendingRequestsState.some(r => r.status === 'PENDING' && r.donor === tItem.donorCentre && r.recipient === tItem.recipientCentre && r.medicine === tItem.medicineName);
                const recName = currentLanguage === 'ta' ? (centreNamesTa[tItem.recipientCentre] || tItem.recipientCentre) : tItem.recipientCentre;
                const donName = currentLanguage === 'ta' ? (centreNamesTa[tItem.donorCentre] || tItem.donorCentre) : tItem.donorCentre;
                const mName = currentLanguage === 'ta' ? (medicineNamesTa[tItem.medicineName] || tItem.medicineName) : tItem.medicineName;
                const unit = getMedicineUnitNoun(tItem.medicineName);
                const prioLabel = tItem.priority === 'CRITICAL' ? t('status_critical') : (tItem.priority === 'TOP-UP' ? t('status_topup') : t('status_warning'));

                return `
                    <div class="transfer-card">
                        <div class="transfer-card-header">
                            <div>
                                <span class="status-pill status-${tItem.priority.toLowerCase()}">${prioLabel}</span>
                                <strong>${esc(mName)}</strong>
                            </div>
                            <small class="text-muted">${tItem.distanceKm} km away</small>
                        </div>
                        <div class="transfer-route-strip">
                            <div class="route-node">
                                <span class="route-label">${currentLanguage === 'ta' ? 'வழங்குநர் (Donor)' : 'Donor'}</span>
                                <strong>${esc(donName)}</strong>
                            </div>
                            <div class="route-arrow">
                                <span>${tItem.transferQty} ${unit[currentLanguage]}</span>
                                <div class="arrow-line">→</div>
                            </div>
                            <div class="route-node">
                                <span class="route-label">${currentLanguage === 'ta' ? 'பெறுநர் (Recipient)' : 'Recipient'}</span>
                                <strong>${esc(recName)}</strong>
                            </div>
                        </div>
                        <p class="transfer-reason">${esc(tItem.reasoning)}</p>
                        ${impactHtml(tItem.impact)}
                        <div class="transfer-card-footer">
                            ${isPending 
                                ? `<span class="badge badge-pending">${currentLanguage === 'ta' ? 'ஒப்புதலுக்கு காத்திருக்கிறது' : 'Request Pending Approval'}</span>`
                                : `<button class="btn btn-primary btn-sm" onclick="openRequestTransferModalByIndex(${idx})">${currentLanguage === 'ta' ? 'மாற்றத்தை கோருங்கள்' : 'Request Inter-PHC Transfer'}</button>`
                            }
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    const containerDistrict = document.getElementById('district-requirements-container');
    if (containerDistrict) {
        if (redistribution.districtRequirements.length === 0) {
            containerDistrict.innerHTML = `<div class="empty-state">${currentLanguage === 'ta' ? 'தற்போது மாவட்டத்திற்கு அனுப்ப வேண்டிய புதிய கோரிக்கைகள் இல்லை.' : 'All health centre shortfalls are currently satisfied by inter-PHC transfers.'}</div>`;
        } else {
            containerDistrict.innerHTML = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>${currentLanguage === 'ta' ? 'மையம்' : 'Centre'}</th>
                            <th>${currentLanguage === 'ta' ? 'மருந்து' : 'Medicine'}</th>
                            <th>${currentLanguage === 'ta' ? 'மொத்த பற்றாக்குறை' : 'Total Shortfall'}</th>
                            <th>${currentLanguage === 'ta' ? 'PHC மூலம் கிடைத்தது' : 'Covered by PHC Transfer'}</th>
                            <th>${currentLanguage === 'ta' ? 'மாவட்ட தேவை' : 'Remaining District Order'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${redistribution.districtRequirements.map(d => {
                            const cName = currentLanguage === 'ta' ? (centreNamesTa[d.centreId] || d.centreId) : d.centreId;
                            const mName = currentLanguage === 'ta' ? (medicineNamesTa[d.medicineName] || d.medicineName) : d.medicineName;
                            const unit = getMedicineUnitNoun(d.medicineName);
                            return `
                                <tr>
                                    <td><strong>${esc(cName)}</strong></td>
                                    <td>${esc(mName)}</td>
                                    <td class="num">${d.totalShortfall} ${unit[currentLanguage]}</td>
                                    <td class="num" style="color: var(--color-safe);">${d.coveredBySurplus} ${unit[currentLanguage]}</td>
                                    <td class="num" style="color: var(--color-critical); font-weight: 700;">${d.remainingDistrictReq} ${unit[currentLanguage]}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
        }
    }
}

function openRequestTransferModalByIndex(idx) {
    const processedList = inventoryState.map(processForecastItem);
    const { suggestedTransfers } = computeRedistribution(processedList);
    const tItem = suggestedTransfers[idx];
    if (tItem) openRequestTransferModal(tItem);
}

let activeRequestData = null;
function openRequestTransferModal(transfer) {
    activeRequestData = {
        donor: transfer.donorCentre,
        recipient: transfer.recipientCentre,
        medicine: transfer.medicineName,
        qty: transfer.transferQty,
        impact: transfer.impact
    };

    const cReqTitle = document.getElementById('req-modal-title');
    if (cReqTitle) cReqTitle.textContent = currentLanguage === 'ta' ? 'PHC மருந்து மாற்றக் கோரிக்கை' : 'Confirm Inter-PHC Stock Transfer Request';

    const cSummary = document.getElementById('req-impact-summary');
    if (cSummary) cSummary.innerHTML = impactHtml(transfer.impact);

    const modal = document.getElementById('modal-request-transfer');
    if (modal) modal.classList.add('open');
}

function closeRequestTransferModal() {
    const modal = document.getElementById('modal-request-transfer');
    if (modal) modal.classList.remove('open');
    activeRequestData = null;
}

function renderPendingApprovals() {
    const container = document.getElementById('pending-approvals-container');
    if (!container) return;

    const pending = pendingRequestsState.filter(r => r.status === 'PENDING');
    if (pending.length === 0) {
        container.innerHTML = `<div class="empty-state">${currentLanguage === 'ta' ? 'மருத்துவ அலுவலரின் ஒப்புதலுக்காக காத்திருக்கும் கோரிக்கைகள் எதுவும் இல்லை.' : 'No pending inter-PHC transfer requests awaiting Medical Officer approval.'}</div>`;
        return;
    }

    container.innerHTML = pending.map(req => {
        const donName = currentLanguage === 'ta' ? (centreNamesTa[req.donor] || req.donor) : req.donor;
        const recName = currentLanguage === 'ta' ? (centreNamesTa[req.recipient] || req.recipient) : req.recipient;
        const mName = currentLanguage === 'ta' ? (medicineNamesTa[req.medicine] || req.medicine) : req.medicine;
        const unit = getMedicineUnitNoun(req.medicine);

        return `
            <div class="approval-card">
                <div class="approval-card-header">
                    <div>
                        <span class="badge badge-pending">PENDING APPROVAL</span>
                        <strong>${esc(mName)} (${req.qty} ${unit[currentLanguage]})</strong>
                    </div>
                    <small class="text-muted">${esc(req.requestedAt)}</small>
                </div>
                <div class="approval-route">${esc(donName)} → ${esc(recName)}</div>
                ${impactHtml(req.impact)}
                <div class="approval-card-actions">
                    <button class="btn btn-outline btn-sm btn-danger" onclick="openRejectModalById('${req.id}')">${currentLanguage === 'ta' ? 'நிராகரி' : 'Reject'}</button>
                    <button class="btn btn-primary btn-sm" onclick="openApproveModalById('${req.id}')">${currentLanguage === 'ta' ? 'PIN மூலம் ஒப்புதல் அளி' : 'Approve with PIN'}</button>
                </div>
            </div>
        `;
    }).join('');
}

function openApproveModalById(id) {
    const req = pendingRequestsState.find(r => r.id === id);
    if (req) openApproveModal(req);
}

function openRejectModalById(id) {
    const req = pendingRequestsState.find(r => r.id === id);
    if (req) openRejectModal(req);
}

let activePendingRequestToApprove = null;
function openApproveModal(req) {
    activePendingRequestToApprove = req;
    const summary = document.getElementById('approve-route-summary');
    if (summary) {
        summary.innerHTML = `
            <div style="font-size:0.9rem; font-weight:700; margin-bottom:0.5rem;">
                ${esc(req.donor)} → ${esc(req.recipient)} | ${req.qty} units of ${esc(req.medicine)}
            </div>
            ${impactHtml(req.impact)}
        `;
    }
    document.getElementById('input-officer-name').value = '';
    document.getElementById('input-officer-pin').value = '';
    document.getElementById('input-approve-note').value = '';

    // Phase 1 bug fix: Show demo PIN hint only when demo data is active
    const pinHint = document.getElementById('pin-demo-hint');
    if (pinHint) pinHint.style.display = isDemoDataLoaded ? 'block' : 'none';

    document.getElementById('modal-approve-transfer').classList.add('open');
}

function closeApproveModal() {
    document.getElementById('modal-approve-transfer').classList.remove('open');
    activePendingRequestToApprove = null;
}

let activePendingRequestToReject = null;
function openRejectModal(req) {
    activePendingRequestToReject = req;
    document.getElementById('reject-route-summary').innerHTML = `
        <div style="font-size:0.9rem; font-weight:700;">
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

function renderInventoryTable(filteredInventory, context) {
    const container = document.getElementById('inventory-table-container');
    if (!container) return;

    if (filteredInventory.length === 0) {
        container.innerHTML = `<div class="empty-state">${currentLanguage === 'ta' ? 'பொருந்தும் இருப்பு பதிவுகள் எதுவும் இல்லை.' : 'No matching inventory records found.'}</div>`;
        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>${currentLanguage === 'ta' ? 'மையம்' : 'Centre'}</th>
                    <th>${currentLanguage === 'ta' ? 'மருந்து' : 'Medicine'}</th>
                    <th>${currentLanguage === 'ta' ? 'மொத்த இருப்பு' : 'Current Stock'}</th>
                    <th>${currentLanguage === 'ta' ? 'பயன்பாட்டு இருப்பு' : 'Usable Stock'}</th>
                    <th>${currentLanguage === 'ta' ? 'தினசரி பயன்பாடு' : 'Daily Use'}</th>
                    <th>${currentLanguage === 'ta' ? 'நாட்கள்' : 'Days Left'}</th>
                    <th>${currentLanguage === 'ta' ? 'நிலை' : 'Status'}</th>
                    <th>${currentLanguage === 'ta' ? 'விளக்கம்' : 'Alert Explanation'}</th>
                    <th>${currentLanguage === 'ta' ? 'செயல்' : 'Action'}</th>
                </tr>
            </thead>
            <tbody>
                ${filteredInventory.map(item => {
                    const cName = currentLanguage === 'ta' ? (centreNamesTa[item.centreId] || item.centreId) : item.centreId;
                    const mName = currentLanguage === 'ta' ? (medicineNamesTa[item.medicineName] || item.medicineName) : item.medicineName;
                    const unit = getMedicineUnitNoun(item.medicineName);
                    const daysStr = item.daysRemaining === Infinity ? '30+' : item.daysRemaining.toFixed(1);
                    const statusLabel = t(`status_${item.status.toLowerCase()}`);
                    const plainSentence = explainAlert(item, context)[currentLanguage];

                    return `
                        <tr>
                            <td><strong>${esc(cName)}</strong></td>
                            <td>${esc(mName)}</td>
                            <td class="num">${item.currentStock} ${unit[currentLanguage]}</td>
                            <td class="num"><strong>${item.usableStock}</strong> ${unit[currentLanguage]}</td>
                            <td class="num">${item.dailyConsumption} / day</td>
                            <td class="num"><strong>${daysStr} d</strong></td>
                            <td><span class="status-pill status-${item.status.toLowerCase()}">${statusLabel}</span></td>
                            <td style="font-size:0.85rem; max-width:280px;">${esc(plainSentence)}</td>
                            <td>
                                <button class="btn btn-outline btn-sm" onclick="editInventoryRecord('${item.id}')">${currentLanguage === 'ta' ? 'திருத்து' : 'Edit'}</button>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

function editInventoryRecord(id) {
    const item = inventoryState.find(i => i.id === id);
    if (!item) return;

    document.getElementById('modal-centre').value = item.centreId;
    document.getElementById('modal-medicine').value = item.medicineName;
    document.getElementById('modal-stock-qty').value = item.currentStock;
    document.getElementById('modal-daily-cons').value = item.dailyConsumption;
    document.getElementById('modal-target-days').value = item.targetCoverageDays;
    document.getElementById('modal-last-updated').value = item.lastUpdated;

    const modalStock = document.getElementById('modal-stock');
    if (modalStock) modalStock.classList.add('open');
}

function renderBatchTable() {
    const container = document.getElementById('batch-table-container');
    if (!container) return;

    if (batchState.length === 0) {
        container.innerHTML = `<div class="empty-state">${currentLanguage === 'ta' ? 'பதிவு செய்யப்பட்ட தொகுப்புகள் எதுவும் இல்லை.' : 'No registered medicine batches found.'}</div>`;
        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>${currentLanguage === 'ta' ? 'தொகுதி எண்' : 'Batch No'}</th>
                    <th>${currentLanguage === 'ta' ? 'மையம்' : 'Centre'}</th>
                    <th>${currentLanguage === 'ta' ? 'மருந்து' : 'Medicine'}</th>
                    <th>${currentLanguage === 'ta' ? 'எண்ணிக்கை' : 'Quantity'}</th>
                    <th>${currentLanguage === 'ta' ? 'காலாவதி தேதி' : 'Expiry Date'}</th>
                    <th>${currentLanguage === 'ta' ? 'மீதமுள்ள நாட்கள்' : 'Days Until Expiry'}</th>
                </tr>
            </thead>
            <tbody>
                ${batchState.map(b => {
                    const daysLeft = getDaysUntilExpiry(b.expiryDate);
                    const isExp = daysLeft < 0;
                    const cName = currentLanguage === 'ta' ? (centreNamesTa[b.centreId] || b.centreId) : b.centreId;
                    const mName = currentLanguage === 'ta' ? (medicineNamesTa[b.medicineName] || b.medicineName) : b.medicineName;

                    return `
                        <tr class="${isExp ? 'row-expired' : ''}">
                            <td><code>${esc(b.batchNumber)}</code></td>
                            <td>${esc(cName)}</td>
                            <td>${esc(mName)}</td>
                            <td class="num">${b.quantity}</td>
                            <td>${formatDate(b.expiryDate)}</td>
                            <td><strong style="color: ${isExp ? 'var(--color-critical)' : 'inherit'}">${isExp ? (currentLanguage === 'ta' ? 'காலாவதியானது' : 'EXPIRED') : `${daysLeft} days`}</strong></td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

function renderAuditLogTable() {
    const container = document.getElementById('audit-log-container');
    if (!container) return;

    if (auditLogState.length === 0) {
        container.innerHTML = `<div class="empty-state">${currentLanguage === 'ta' ? 'தணிக்கை பதிவு விவரங்கள் எதுவுமில்லை.' : 'No audit log entries recorded yet.'}</div>`;
        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>${currentLanguage === 'ta' ? 'நேரம்' : 'Timestamp'}</th>
                    <th>${currentLanguage === 'ta' ? 'செயல்' : 'Action'}</th>
                    <th>${currentLanguage === 'ta' ? 'அதிகாரி' : 'Officer'}</th>
                    <th>${currentLanguage === 'ta' ? 'வழித்தடம்' : 'Route'}</th>
                    <th>${currentLanguage === 'ta' ? 'மருந்து' : 'Medicine'}</th>
                    <th>${currentLanguage === 'ta' ? 'அளவு' : 'Qty'}</th>
                    <th>${currentLanguage === 'ta' ? 'குறிப்பு' : 'Note'}</th>
                </tr>
            </thead>
            <tbody>
                ${auditLogState.map(a => `
                    <tr>
                        <td style="font-size:0.8rem;">${esc(a.timestamp)}</td>
                        <td><span class="badge ${a.action === 'Approved' ? 'badge-safe' : (a.action === 'Rejected' ? 'badge-danger' : 'badge-info')}">${esc(a.action)}</span></td>
                        <td>${esc(a.officer)}</td>
                        <td>${esc(a.route)}</td>
                        <td>${esc(a.medicine)}</td>
                        <td class="num">${a.qty}</td>
                        <td style="font-size:0.8rem;">${esc(a.note)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderFacilityCards(processedInventory) {
    const container = document.getElementById('facility-cards-container');
    if (!container) return;

    const centres = ['Centre A', 'Centre B', 'Centre C', 'Centre D'];
    container.innerHTML = centres.map(cId => {
        const cName = currentLanguage === 'ta' ? (centreNamesTa[cId] || cId) : cId;
        const cItems = processedInventory.filter(i => i.centreId === cId);
        const critItems = cItems.filter(i => i.status === 'CRITICAL');
        const warnItems = cItems.filter(i => i.status === 'WARNING');
        const safeItems = cItems.filter(i => i.status === 'SAFE');

        return `
            <div class="facility-card">
                <div class="facility-card-header">
                    <h4>${esc(cName)}</h4>
                    <span class="badge ${critItems.length > 0 ? 'badge-danger' : 'badge-safe'}">
                        ${critItems.length > 0 ? `${critItems.length} Critical` : 'Operational'}
                    </span>
                </div>
                <div class="facility-card-body">
                    <div class="stat-pill-row">
                        <span class="stat-pill pill-critical">${critItems.length} Critical</span>
                        <span class="stat-pill pill-warning">${warnItems.length} Warning</span>
                        <span class="stat-pill pill-safe">${safeItems.length} Safe</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderSyncStatusPanel() {
    const container = document.getElementById('sync-status-panel-container');
    if (!container) return;

    const queue = OutboxQueue.getQueue();
    if (queue.length === 0) {
        container.innerHTML = `<p class="text-muted" style="font-size:0.85rem;">${currentLanguage === 'ta' ? 'அனைத்து தரவுகளும் ஒத்திசைக்கப்பட்டுள்ளன (வரிசை காலியாக உள்ளது).' : 'All local changes are fully synced to server storage (outbox empty).'}</p>`;
        return;
    }

    container.innerHTML = `
        <div class="sync-panel">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                <strong>${t('sync_status_heading')} (${queue.length} items)</strong>
                <button class="btn btn-outline btn-sm" onclick="OutboxQueue.flush()">${t('btn_sync_now')}</button>
            </div>
            <div class="sync-queue-list">
                ${queue.map(q => `
                    <div class="sync-item sync-${q.status}">
                        <span><strong>${q.type}</strong> (${q.payload.medicineName || q.payload.medicine || 'Stock update'})</span>
                        <span class="badge badge-${q.status === 'synced' ? 'safe' : (q.status === 'pending' ? 'pending' : 'danger')}">${q.status}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderSimpleModeView(processedInventory, redistribution) {
    const container = document.getElementById('simple-mode-view');
    if (!container) return;

    const criticals = processedInventory.filter(i => i.status === 'CRITICAL');
    container.innerHTML = `
        <div class="simple-mode-card">
            <h3>${currentLanguage === 'ta' ? 'எளிய வழிகாட்டல் இருப்பு பார்வை (Guided Operating Mode)' : 'Guided Simple Operating Panel'}</h3>
            <p>${currentLanguage === 'ta' ? 'சிக்கலான விளக்கப்படங்கள் இல்லாமல் உடனடி செயல்பாடுகளை மட்டும் காணவும்.' : 'Clear single-action interface designed for fast physical count entry and transfer verification.'}</p>
            <div class="simple-grid">
                <button class="btn btn-primary btn-lg" onclick="document.getElementById('modal-add-stock-choice').classList.add('open')">
                    ➕ ${t('add_update_stock')}
                </button>
                <button class="btn btn-outline btn-lg" onclick="switchTab('tab-transfers')">
                    🚚 ${currentLanguage === 'ta' ? 'PHC மாற்றங்களை பார்' : 'View Transfer Recommendations'}
                </button>
            </div>
        </div>
    `;
}

function renderSimulator(processedList) {
    const container = document.getElementById('sim-results-container');
    if (!container) return;

    const mult = parseFloat(document.getElementById('sim-demand-multiplier')?.value || 1.0);
    const delay = parseInt(document.getElementById('sim-delay-days')?.value || 0, 10);
    const shock = parseInt(document.getElementById('sim-supply-shock')?.value || 0, 10);

    const simResults = processedList.map(item => {
        const simCons = item.dailyConsumption * mult;
        const simStock = Math.max(0, item.usableStock - shock);
        let simDays = simCons > 0 ? (simStock / simCons) - delay : Infinity;
        if (simDays < 0) simDays = 0;

        return {
            ...item,
            simStock,
            simCons,
            simDays
        };
    });

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>${currentLanguage === 'ta' ? 'மையம்' : 'Centre'}</th>
                    <th>${currentLanguage === 'ta' ? 'மருந்து' : 'Medicine'}</th>
                    <th>${currentLanguage === 'ta' ? 'இயல்பு நிலை (நாட்கள்)' : 'Baseline Days'}</th>
                    <th>${currentLanguage === 'ta' ? 'சோதனை நிலை (நாட்கள்)' : 'Simulated Days'}</th>
                </tr>
            </thead>
            <tbody>
                ${simResults.map(s => {
                    const baseStr = s.daysRemaining === Infinity ? '30+' : s.daysRemaining.toFixed(1);
                    const simStr = s.simDays === Infinity ? '30+' : s.simDays.toFixed(1);
                    return `
                        <tr>
                            <td><strong>${esc(s.centreId)}</strong></td>
                            <td>${esc(s.medicineName)}</td>
                            <td>${baseStr} d</td>
                            <td><strong style="color: ${s.simDays <= leadTimeDays ? 'var(--color-critical)' : 'inherit'}">${simStr} d</strong></td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

// --- Benchmark Demo Data & Reset (Phase 1 Fixes) ---

function loadDemoScenario() {
    isDemoDataLoaded = true;

    inventoryState = [
        { id: 'DEMO-A', centreId: 'Centre A', medicineName: 'Paracetamol Syrup (100ml)', currentStock: 60, dailyConsumption: 10, targetCoverageDays: 30, lastUpdated: getPastDateString(0), lastTransferAt: null },
        { id: 'DEMO-C', centreId: 'Centre C', medicineName: 'Paracetamol Syrup (100ml)', currentStock: 200, dailyConsumption: 2, targetCoverageDays: 30, lastUpdated: getPastDateString(0), lastTransferAt: null },
        { id: 'DEMO-B', centreId: 'Centre B', medicineName: 'Amoxicillin 500mg Capsules', currentStock: 400, dailyConsumption: 10, targetCoverageDays: 30, lastUpdated: getPastDateString(1), lastTransferAt: null },
        { id: 'DEMO-D', centreId: 'Centre D', medicineName: 'ORS Electrolyte Packets', currentStock: 500, dailyConsumption: 5, targetCoverageDays: 30, lastUpdated: getPastDateString(2), lastTransferAt: null }
    ];

    batchState = [
        { id: 'DEMO-BAT-A', batchNumber: 'DEMO-BATCH-01', centreId: 'Centre A', medicineName: 'Paracetamol Syrup (100ml)', quantity: 60, expiryDate: getFutureDateString(180) },
        { id: 'DEMO-BAT-C', batchNumber: 'DEMO-BATCH-02', centreId: 'Centre C', medicineName: 'Paracetamol Syrup (100ml)', quantity: 200, expiryDate: getFutureDateString(240) }
    ];

    pendingRequestsState = [];
    auditLogState = [];

    saveStateToStorage();

    if (document.getElementById('filter-search')) document.getElementById('filter-search').value = '';
    if (document.getElementById('filter-centre')) document.getElementById('filter-centre').value = 'ALL';
    if (document.getElementById('filter-medicine')) document.getElementById('filter-medicine').value = 'ALL';
    if (document.getElementById('filter-urgency')) document.getElementById('filter-urgency').value = 'ALL';
    if (document.getElementById('input-lead-time')) document.getElementById('input-lead-time').value = '10';
    leadTimeDays = 10;

    populateDropdowns();
    renderDashboard();
    switchTab('tab-overview');

    showToast(t('toast_demo_loaded'), 'success');
}

function loadDemoData() {
    loadDemoScenario();
}

function resetData() {
    isDemoDataLoaded = false;
    inventoryState = JSON.parse(JSON.stringify(initialInventorySeed));
    batchState = JSON.parse(JSON.stringify(initialBatchSeed));
    pendingRequestsState = [];
    auditLogState = [];
    syncQueueState = [];

    localStorage.removeItem('medicare_inventory_state');
    localStorage.removeItem('medicare_batch_state');
    localStorage.removeItem('medicare_pending_requests');
    localStorage.removeItem('medicare_audit_log');
    localStorage.removeItem('medicare_sync_queue');

    if (document.getElementById('filter-search')) document.getElementById('filter-search').value = '';
    if (document.getElementById('filter-centre')) document.getElementById('filter-centre').value = 'ALL';
    if (document.getElementById('filter-medicine')) document.getElementById('filter-medicine').value = 'ALL';
    if (document.getElementById('filter-urgency')) document.getElementById('filter-urgency').value = 'ALL';
    if (document.getElementById('input-lead-time')) document.getElementById('input-lead-time').value = '10';
    leadTimeDays = 10;

    populateDropdowns();
    renderDashboard();
    showToast('Application state reset to seed dataset.', 'info');
}

function resetAllData() {
    resetData();
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let iconName = type === 'success' ? '#icon-check-circle' : (type === 'warning' ? '#icon-alert' : (type === 'error' ? '#icon-x' : '#icon-gear'));

    toast.innerHTML = `<svg class="icon"><use href="${iconName}"></use></svg> <span>${esc(message)}</span>`;
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

let pendingConfirmAction = null;
function showConfirmModal(title, message, onConfirm) {
    const elTitle = document.getElementById('confirm-title');
    if (elTitle) elTitle.innerHTML = `<svg class="icon"><use href="#icon-gear"></use></svg> ${esc(title)}`;

    const elMsg = document.getElementById('confirm-message');
    if (elMsg) elMsg.textContent = message;

    pendingConfirmAction = onConfirm;

    const modal = document.getElementById('modal-confirm');
    if (modal) modal.classList.add('open');
}

function closeConfirmModal() {
    const modal = document.getElementById('modal-confirm');
    if (modal) modal.classList.remove('open');
    pendingConfirmAction = null;
}

function populateDropdowns() {
    const centres = ['Centre A', 'Centre B', 'Centre C', 'Centre D'];
    const medicines = Array.from(new Set(inventoryState.map(i => i.medicineName))).sort();

    const fillSelect = (id, items, allText) => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const currentVal = sel.value;
        let html = allText ? `<option value="ALL">${allText}</option>` : '';
        items.forEach(item => {
            const displayName = id.includes('centre') ? (currentLanguage === 'ta' ? (centreNamesTa[item] || item) : item) : (currentLanguage === 'ta' ? (medicineNamesTa[item] || item) : item);
            html += `<option value="${esc(item)}">${esc(displayName)}</option>`;
        });
        sel.innerHTML = html;
        if (currentVal && items.includes(currentVal)) sel.value = currentVal;
    };

    fillSelect('filter-centre', centres, currentLanguage === 'ta' ? 'அனைத்து PHC மையங்களும்' : 'All PHCs');
    fillSelect('filter-medicine', medicines, currentLanguage === 'ta' ? 'அனைத்து மருந்துகளும்' : 'All Medicines');
    fillSelect('modal-centre', centres);
    fillSelect('modal-medicine', medicines);
    fillSelect('modal-batch-centre', centres);
    fillSelect('modal-batch-medicine', medicines);
    fillSelect('wizard-centre', centres);
    fillSelect('wizard-medicine', medicines);
}

function switchTab(tabId) {
    if (!tabId || typeof document === 'undefined') return;

    if (document.querySelectorAll) {
        document.querySelectorAll('.nav-tab').forEach(btn => {
            const isActive = btn.dataset.tab === tabId;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
    }

    const kpiSummary = document.getElementById('kpi-summary');
    if (kpiSummary) {
        kpiSummary.style.display = (tabId === 'tab-overview') ? 'grid' : 'none';
    }

    const filterToolbar = document.querySelector('.filter-toolbar');
    if (filterToolbar) {
        filterToolbar.style.display = (tabId === 'tab-overview' || tabId === 'tab-inventory') ? 'flex' : 'none';
    }

    if (document.querySelectorAll) {
        document.querySelectorAll('.tab-content').forEach(content => {
            const isActive = content.id === tabId;
            content.classList.toggle('active', isActive);
        });
    }

    const mainContainer = document.querySelector('.dashboard-container');
    if (mainContainer && typeof mainContainer.scrollIntoView === 'function') {
        mainContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// --- Barcode Scanner Logic ---

function handleBarcodeDetected(code) {
    const cleanCode = String(code).trim();
    const match = barcodeCatalogue[cleanCode];

    if (match) {
        stopCameraScanner();
        document.getElementById('modal-barcode-scanner')?.classList.remove('open');
        document.getElementById('modal-add-stock-choice')?.classList.remove('open');

        document.getElementById('modal-medicine').value = match.medicineName;
        document.getElementById('modal-daily-cons').value = match.defaultDailyUse;
        document.getElementById('modal-target-days').value = match.targetDays;

        const modalStock = document.getElementById('modal-stock');
        if (modalStock) {
            modalStock.classList.add('open');
            document.getElementById('modal-last-updated').value = toLocalISO(new Date());
        }

        showToast(`Barcode Scanned: Identified ${match.medicineName}`, 'success');
    } else {
        showToast(`Unknown Barcode GTIN: ${cleanCode}. Please select medicine manually.`, 'warning');
    }
}

let cameraStream = null;
function startCameraScanner() {
    const video = document.getElementById('scanner-video');
    if (!video) return;

    if ('BarcodeDetector' in window) {
        try {
            const detector = new BarcodeDetector({ formats: ['ean_13', 'code_128', 'qr_code'] });
            navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(stream => {
                cameraStream = stream;
                video.srcObject = stream;
                video.play();

                const scanInterval = setInterval(() => {
                    if (!cameraStream) {
                        clearInterval(scanInterval);
                        return;
                    }
                    detector.detect(video).then(barcodes => {
                        if (barcodes.length > 0) {
                            clearInterval(scanInterval);
                            handleBarcodeDetected(barcodes[0].rawValue);
                        }
                    }).catch(() => {});
                }, 500);
            }).catch(() => {
                showToast('Camera Access Error: Please use manual GTIN entry fallback.', 'warning');
            });
        } catch (e) {
            showToast('Native BarcodeDetector not supported. Use manual GTIN entry below.', 'info');
        }
    } else {
        showToast('Native BarcodeDetector unavailable. Use manual GTIN barcode entry.', 'info');
    }
}

function stopCameraScanner() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
        cameraStream = null;
    }
    const video = document.getElementById('scanner-video');
    if (video) video.srcObject = null;
}

// --- DOM Initialization & Event Handlers ---

document.addEventListener('DOMContentLoaded', () => {
    // Register Service Worker for PWA Offline App Shell
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').then(() => {
            console.log('[SW] Registered successfully');
        }).catch(err => console.error('[SW] Registration failed:', err));
    }

    populateDropdowns();
    renderDashboard();
    updateNetworkStatus();

    setLanguage(currentLanguage);
    setTheme(currentTheme);

    // Heartbeat for reliable connectivity detection every 15s
    setInterval(() => {
        if (!document.hidden) {
            checkRealConnectivity().then(() => {
                updateNetworkStatus();
                OutboxQueue.flush();
            });
        }
    }, 15000);

    window.addEventListener('online', () => {
        checkRealConnectivity().then(() => {
            updateNetworkStatus();
            OutboxQueue.flush();
        });
    });
    window.addEventListener('offline', () => {
        updateNetworkStatus();
    });

    const selectSiteLang = document.getElementById('select-site-lang');
    if (selectSiteLang) {
        selectSiteLang.value = currentLanguage;
        selectSiteLang.addEventListener('change', (e) => {
            setLanguage(e.target.value);
        });
    }

    const btnToggleTheme = document.getElementById('btn-toggle-theme');
    if (btnToggleTheme) {
        btnToggleTheme.addEventListener('click', () => {
            toggleTheme();
        });
    }

    const modalSettings = document.getElementById('modal-settings');
    const btnOpenSettings = document.getElementById('btn-open-settings');
    if (btnOpenSettings && modalSettings) {
        btnOpenSettings.addEventListener('click', () => modalSettings.classList.add('open'));
    }
    ['btn-close-settings-modal', 'btn-cancel-settings'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn && modalSettings) {
            btn.addEventListener('click', () => modalSettings.classList.remove('open'));
        }
    });

    const btnLoadDemoModal = document.getElementById('btn-load-demo-modal');
    if (btnLoadDemoModal) {
        btnLoadDemoModal.addEventListener('click', () => {
            loadDemoData();
            if (modalSettings) modalSettings.classList.remove('open');
        });
    }

    const btnResetModal = document.getElementById('btn-reset-modal');
    if (btnResetModal) {
        btnResetModal.addEventListener('click', () => {
            showConfirmModal(
                'Reset All Data',
                'Are you sure you want to clear local storage and reset all inventory state?',
                () => {
                    resetAllData();
                    if (modalSettings) modalSettings.classList.remove('open');
                }
            );
        });
    }

    // Single click listeners for header demo/reset buttons
    const btnDemoHeader = document.getElementById('btn-demo');
    if (btnDemoHeader) {
        btnDemoHeader.addEventListener('click', () => {
            showConfirmModal('Load Demo Data', 'Do you want to load demo benchmark data?', () => {
                loadDemoScenario();
            });
        });
    }
    const btnResetHeader = document.getElementById('btn-reset');
    if (btnResetHeader) {
        btnResetHeader.addEventListener('click', () => {
            showConfirmModal('Reset Application Data', 'Are you sure you want to reset all inventory data?', () => {
                resetAllData();
            });
        });
    }

    // Choice Modal Controls
    const modalChoice = document.getElementById('modal-add-stock-choice');
    const btnCloseChoice = document.getElementById('btn-close-choice-modal');
    if (btnCloseChoice && modalChoice) {
        btnCloseChoice.addEventListener('click', () => modalChoice.classList.remove('open'));
    }

    const btnChoiceScan = document.getElementById('btn-choice-scan');
    if (btnChoiceScan && modalChoice) {
        btnChoiceScan.addEventListener('click', () => {
            modalChoice.classList.remove('open');
            document.getElementById('modal-barcode-scanner').classList.add('open');
            startCameraScanner();
        });
    }

    const btnChoiceManual = document.getElementById('btn-choice-manual');
    if (btnChoiceManual && modalChoice) {
        btnChoiceManual.addEventListener('click', () => {
            modalChoice.classList.remove('open');
            const modalStock = document.getElementById('modal-stock');
            if (modalStock) {
                modalStock.classList.add('open');
                document.getElementById('modal-last-updated').value = toLocalISO(new Date());
            }
        });
    }

    // Simple Mode Toggle
    const btnToggleMode = document.getElementById('btn-toggle-mode');
    if (btnToggleMode) {
        btnToggleMode.addEventListener('click', () => {
            isSimpleModeActive = !isSimpleModeActive;
            const panel = document.getElementById('simple-mode-view');
            const lbl = document.getElementById('lbl-mode');

            if (panel) panel.style.display = isSimpleModeActive ? 'block' : 'none';
            if (lbl) lbl.textContent = isSimpleModeActive ? t('simple_mode_on') : t('simple_mode_off');

            showToast(isSimpleModeActive ? 'Switched to Guided Simple Operating Mode.' : 'Switched to Detailed Operational Dashboard.', 'info');
        });
    }

    // Phase 1 bug fix: Wizard Submit Handler reconciles batches & daily consumption
    const btnWizardSubmit = document.getElementById('btn-wizard-submit');
    if (btnWizardSubmit) {
        btnWizardSubmit.addEventListener('click', () => {
            const centreId = document.getElementById('wizard-centre').value;
            const medicineName = document.getElementById('wizard-medicine').value;
            const currentStock = parseInt(document.getElementById('wizard-qty').value, 10) || 0;
            const expiryDate = document.getElementById('wizard-expiry').value || getFutureDateString(180);
            const lastUpdated = toLocalISO(new Date());

            // Determine known daily consumption
            let dailyCons = 0;
            const existingItem = inventoryState.find(i => i.centreId === centreId && i.medicineName.toLowerCase().trim() === medicineName.toLowerCase().trim());
            if (existingItem && existingItem.dailyConsumption > 0) {
                dailyCons = existingItem.dailyConsumption;
            } else {
                const catMatch = Object.values(barcodeCatalogue).find(c => c.medicineName.toLowerCase().trim() === medicineName.toLowerCase().trim());
                if (catMatch && catMatch.defaultDailyUse) {
                    dailyCons = catMatch.defaultDailyUse;
                } else {
                    const elWizardCons = document.getElementById('wizard-daily-cons');
                    dailyCons = elWizardCons ? (parseFloat(elWizardCons.value) || 5) : 5;
                }
            }

            const existingIdx = inventoryState.findIndex(i =>
                i.centreId === centreId &&
                i.medicineName.toLowerCase().trim() === medicineName.toLowerCase().trim()
            );

            if (existingIdx >= 0) {
                inventoryState[existingIdx].currentStock = currentStock;
                inventoryState[existingIdx].lastUpdated = lastUpdated;
                if (dailyCons > 0) inventoryState[existingIdx].dailyConsumption = dailyCons;
            } else {
                inventoryState.push({
                    id: `INV-${Date.now()}`,
                    centreId,
                    medicineName,
                    currentStock,
                    dailyConsumption: dailyCons || 5,
                    targetCoverageDays: 30,
                    lastUpdated,
                    lastTransferAt: null
                });
            }

            // Batch Reconciliation: replace non-expired batches for this item with single reconciled batch
            batchState = batchState.filter(b => !(b.centreId === centreId && b.medicineName.toLowerCase().trim() === medicineName.toLowerCase().trim() && getDaysUntilExpiry(b.expiryDate) >= 0));
            batchState.push({
                id: `BAT-${Date.now()}`,
                batchNumber: `WIZ-BATCH-${Math.floor(Math.random() * 1000)}`,
                centreId,
                medicineName,
                quantity: currentStock,
                expiryDate
            });

            OutboxQueue.enqueue('STOCK_UPSERT', { centreId, medicineName, currentStock, dailyConsumption: dailyCons });

            saveStateToStorage();
            populateDropdowns();
            renderDashboard();

            const wizardModal = document.getElementById('modal-wizard');
            if (wizardModal) wizardModal.classList.remove('open');

            showToast(`Stock record saved for ${medicineName} at ${centreId}.`, 'success');
        });
    }

    // Filter Listeners
    ['filter-search', 'filter-centre', 'filter-medicine', 'filter-urgency'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', renderDashboard);
            el.addEventListener('change', renderDashboard);
        }
    });

    const elLeadTime = document.getElementById('input-lead-time');
    if (elLeadTime) {
        elLeadTime.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val) && val >= 1 && val <= 90) {
                leadTimeDays = val;
                renderDashboard();
            }
        });
    }

    // Confirmation Modal Listeners
    const btnActionConfirm = document.getElementById('btn-action-confirm');
    if (btnActionConfirm) {
        btnActionConfirm.addEventListener('click', () => {
            if (pendingConfirmAction) pendingConfirmAction();
            closeConfirmModal();
        });
    }
    const btnCancelConfirm = document.getElementById('btn-cancel-confirm');
    if (btnCancelConfirm) btnCancelConfirm.addEventListener('click', closeConfirmModal);

    const btnCloseConfirm = document.getElementById('btn-close-confirm');
    if (btnCloseConfirm) btnCloseConfirm.addEventListener('click', closeConfirmModal);

    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    const brandTitle = document.querySelector('.brand-title');
    if (brandTitle) {
        brandTitle.style.cursor = 'pointer';
        brandTitle.addEventListener('click', () => switchTab('tab-overview'));
    }

    // Request Transfer Modal Handlers
    const btnCloseReq = document.getElementById('btn-close-req-modal');
    if (btnCloseReq) btnCloseReq.addEventListener('click', closeRequestTransferModal);

    const btnCancelReq = document.getElementById('btn-cancel-req');
    if (btnCancelReq) btnCancelReq.addEventListener('click', closeRequestTransferModal);

    const btnSubmitReq = document.getElementById('btn-submit-req');
    if (btnSubmitReq) {
        btnSubmitReq.addEventListener('click', () => {
            if (!activeRequestData) return;
            const { donor, recipient, medicine, qty, impact } = activeRequestData;

            const isDuplicate = pendingRequestsState.some(r =>
                r.status === 'PENDING' &&
                r.donor === donor &&
                r.recipient === recipient &&
                r.medicine === medicine
            );

            if (isDuplicate) {
                showToast("A request for this transfer is already pending approval.", 'info');
                closeRequestTransferModal();
                return;
            }

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
            OutboxQueue.enqueue('TRANSFER_REQUEST', newReq);
            saveStateToStorage();
            closeRequestTransferModal();
            renderDashboard();
            showToast(t('toast_transfer_requested'), 'info');
        });
    }

    // Approval Modal Handlers
    const btnCloseApprove = document.getElementById('btn-close-approve-modal');
    if (btnCloseApprove) btnCloseApprove.addEventListener('click', closeApproveModal);

    const btnCancelApprove = document.getElementById('btn-cancel-approve');
    if (btnCancelApprove) btnCancelApprove.addEventListener('click', closeApproveModal);

    const formApprove = document.getElementById('form-approve-transfer');
    if (formApprove) {
        formApprove.addEventListener('submit', (e) => {
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
            const donorItem = inventoryState.find(i => i.centreId === req.donor && i.medicineName === req.medicine);
            const donorProcessed = donorItem ? processForecastItem(donorItem) : null;
            const { validBatchQty } = getItemBatchAnalysis(req.donor, req.medicine);

            if (!donorProcessed || donorProcessed.isOutdated || donorProcessed.donorSurplus < req.qty || validBatchQty < req.qty) {
                req.status = 'INVALID';
                logAuditAction('Invalid', officerName, `${req.donor} → ${req.recipient}`, req.medicine, req.qty, 'Approval failed re-validation.');
                saveStateToStorage();
                closeApproveModal();
                renderDashboard();
                showToast('Approval failed: Donor safe surplus or valid batch stock is insufficient.', 'error');
                return;
            }

            const success = executeApprovedTransfer(req.donor, req.recipient, req.medicine, req.qty);
            if (success) {
                req.status = 'APPROVED';
                logAuditAction('Approved', officerName, `${req.donor} → ${req.recipient}`, req.medicine, req.qty, note || 'Transfer approved by Medical Officer');
                saveStateToStorage();
                closeApproveModal();
                renderDashboard();
                showToast(t('toast_transfer_approved'), 'success');
            }
        });
    }

    // Rejection Modal Handlers
    const btnCloseReject = document.getElementById('btn-close-reject-modal');
    if (btnCloseReject) btnCloseReject.addEventListener('click', closeRejectModal);

    const btnCancelReject = document.getElementById('btn-cancel-reject');
    if (btnCancelReject) btnCancelReject.addEventListener('click', closeRejectModal);

    const formReject = document.getElementById('form-reject-transfer');
    if (formReject) {
        formReject.addEventListener('submit', (e) => {
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
            OutboxQueue.enqueue('TRANSFER_REJECT', { reqId: req.id, reason });

            saveStateToStorage();
            closeRejectModal();
            renderDashboard();
            showToast(t('toast_transfer_rejected'), 'info');
        });
    }

    // Barcode Lookup Controls
    const btnStopCam = document.getElementById('btn-stop-camera');
    if (btnStopCam) btnStopCam.addEventListener('click', stopCameraScanner);

    const btnCloseBarModal = document.getElementById('btn-close-barcode-modal');
    if (btnCloseBarModal) {
        btnCloseBarModal.addEventListener('click', () => {
            stopCameraScanner();
            document.getElementById('modal-barcode-scanner').classList.remove('open');
        });
    }

    const btnLookupBar = document.getElementById('btn-lookup-manual-barcode');
    if (btnLookupBar) {
        btnLookupBar.addEventListener('click', () => {
            const code = document.getElementById('input-manual-barcode').value.trim();
            handleBarcodeDetected(code);
        });
    }

    // Inventory Form Submit Handler
    const formStock = document.getElementById('form-stock');
    if (formStock) {
        formStock.addEventListener('submit', (e) => {
            e.preventDefault();

            const centreId = document.getElementById('modal-centre').value;
            const medicineName = document.getElementById('modal-medicine').value.trim();
            const currentStock = parseFloat(document.getElementById('modal-stock-qty').value);
            const dailyConsumption = parseFloat(document.getElementById('modal-daily-cons').value);
            const targetCoverageDays = parseInt(document.getElementById('modal-target-days').value, 10);
            const lastUpdated = document.getElementById('modal-last-updated').value;

            if (!medicineName || isNaN(currentStock) || currentStock < 0 || isNaN(dailyConsumption) || dailyConsumption < 0 || isNaN(targetCoverageDays) || targetCoverageDays <= 0 || !lastUpdated) {
                showToast('Validation Error: Please enter valid non-negative numbers.', 'error');
                return;
            }

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

            OutboxQueue.enqueue('STOCK_UPSERT', { centreId, medicineName, currentStock, dailyConsumption, targetCoverageDays, lastUpdated });

            saveStateToStorage();
            populateDropdowns();
            renderDashboard();

            const modalStock = document.getElementById('modal-stock');
            if (modalStock) modalStock.classList.remove('open');
            formStock.reset();
        });
    }

    // Add Stock Modal Open Button
    const btnOpenStockModal = document.getElementById('btn-add-modal');
    if (btnOpenStockModal) {
        btnOpenStockModal.addEventListener('click', () => {
            const choiceModal = document.getElementById('modal-add-stock-choice');
            if (choiceModal) {
                choiceModal.classList.add('open');
            } else {
                const modalStock = document.getElementById('modal-stock');
                if (modalStock) {
                    modalStock.classList.add('open');
                    document.getElementById('modal-last-updated').value = toLocalISO(new Date());
                }
            }
        });
    }

    // Batch Form Submit Handler
    const formBatch = document.getElementById('form-batch');
    if (formBatch) {
        formBatch.addEventListener('submit', (e) => {
            e.preventDefault();

            const centreId = document.getElementById('modal-batch-centre').value;
            const medicineName = document.getElementById('modal-batch-medicine').value;
            const batchNumber = document.getElementById('modal-batch-num').value.trim();
            const quantity = parseInt(document.getElementById('modal-batch-qty').value, 10);
            const expiryDate = document.getElementById('modal-batch-expiry').value;

            if (!batchNumber || isNaN(quantity) || quantity <= 0 || !expiryDate) {
                showToast('Validation Error: Please provide a valid batch number and quantity.', 'error');
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

            OutboxQueue.enqueue('BATCH_ADD', { batchNumber, centreId, medicineName, quantity, expiryDate });

            saveStateToStorage();
            renderDashboard();

            const modalBatch = document.getElementById('modal-batch');
            if (modalBatch) modalBatch.classList.remove('open');
            formBatch.reset();

            showToast(`Registered batch ${batchNumber} (${quantity} units) for ${medicineName}.`, 'success');
        });
    }
});
