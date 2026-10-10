/**
 * ============================================================================
 * MEDI-CARE: PHC MEDICINE STOCK-OUT EARLY WARNING & REDISTRIBUTION ENGINE
 * ============================================================================
 * ACCESSIBLE, GUIDED, BARCODE & VOICE ENGINE
 * Pitch: "Count the days, then look sideways before you look up."
 * ============================================================================
 */

// --- Global Date, Security & Connectivity Helpers ---

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
let voiceAssistantEnabled = false;
let isSimpleModeActive = false;
let selectedVoiceLanguage = 'ta-IN';
let activeSpeechRecognition = null;

let currentLanguage = localStorage.getItem('medicare_site_lang') || 'en';
let currentTheme = localStorage.getItem('medicare_theme') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

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
        btn_scan_barcode: "Scan Barcode (பார்கோடு)",
        choice_scan_sub: "Use live camera to scan medicine GTIN barcode",
        btn_enter_manually: "Enter Manually (கைமுறையாக)",
        choice_manual_sub: "Fill out physical stock form or 3-step wizard",
        settings_title: "System Settings & Data Tools",
        settings_desc: "Configure application parameters or load demonstration datasets for evaluation.",
        demo_data_heading: "Demonstration Benchmark Dataset",
        demo_data_desc: "Load the official 24-hour hackathon benchmark dataset featuring Centre A shortage (60 stock, 6 days remaining) and Centre C safe surplus (140 transfer capacity).",
        btn_load_demo_confirm: "Load Demo Scenario Data",
        btn_reset_storage: "Clear Local Storage & Reset",
        btn_cancel: "Cancel",
        btn_confirm: "Confirm",
        voice_help_text: "Speak medicine names or quantities in Tamil or English to fill stock entries hands-free with mandatory confirmation.",
        btn_start_voice: "Start Speaking (பேசுக)",
        btn_stop_voice: "Stop",
        btn_replay_voice: "Repeat Guidance",
        toast_demo_loaded: "Demo scenario data loaded successfully.",
        toast_stock_saved: "Stock entry saved successfully!",
        toast_transfer_requested: "Transfer request submitted for approval.",
        toast_transfer_approved: "Transfer approved and executed successfully!",
        toast_transfer_rejected: "Transfer request rejected.",
        toast_camera_stopped: "Camera stopped."
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
        btn_start_voice: "பேசத் தொடங்கு (பேசுக)",
        btn_stop_voice: "நிறுத்து",
        btn_replay_voice: "மீண்டும் கேள்",
        toast_demo_loaded: "மாதிரி தரவு வெற்றிகரமாக ஏற்றப்பட்டது.",
        toast_stock_saved: "மருந்து இருப்பு வெற்றிகரமாக சேமிக்கப்பட்டது!",
        toast_transfer_requested: "மருந்து மாற்றக் கோரிக்கை சமர்ப்பிக்கப்பட்டது.",
        toast_transfer_approved: "மருந்து மாற்றம் ஒப்புதல் அளிக்கப்பட்டு செயல்படுத்தப்பட்டது!",
        toast_transfer_rejected: "மருந்து மாற்றக் கோரிக்கை நிராகரிக்கப்பட்டது.",
        toast_camera_stopped: "கேமரா நிறுத்தப்பட்டது."
    }
};

function t(key) {
    if (i18n[currentLanguage] && i18n[currentLanguage][key]) {
        return i18n[currentLanguage][key];
    }
    if (i18n['en'] && i18n['en'][key]) {
        return i18n['en'][key];
    }
    return key;
}

function setLanguage(lang) {
    if (lang !== 'en' && lang !== 'ta') lang = 'en';
    currentLanguage = lang;
    localStorage.setItem('medicare_site_lang', lang);

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

    setTheme(currentTheme);
}

function setTheme(theme) {
    if (theme !== 'dark' && theme !== 'light') theme = 'light';
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('medicare_theme', theme);

    const lblTheme = document.getElementById('lbl-theme');
    const btnTheme = document.getElementById('btn-toggle-theme');
    if (lblTheme) {
        lblTheme.textContent = theme === 'dark' 
            ? (currentLanguage === 'ta' ? 'வெளிச்ச முறைமை' : 'Light Mode')
            : (currentLanguage === 'ta' ? 'இருண்ட முறைமை' : 'Dark Mode');
    }
    if (btnTheme && typeof btnTheme.querySelector === 'function') {
        const icon = btnTheme.querySelector('i');
        if (icon) {
            icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        }
    }
}

function toggleTheme() {
    setTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

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

// Verified Medicine Barcode Catalogue Mapping (GTIN / EAN-13 -> Medicine Info)
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
        lastUpdated: getPastDateString(18),
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
        dailyConsumption: 0,
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
        expiryDate: getPastDateString(10)
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

// Persistent State Loaders
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

function loadSavedSyncQueue() {
    const saved = localStorage.getItem('medicare_sync_queue');
    if (saved) {
        try { return JSON.parse(saved); } catch (e) { console.error('Error parsing sync queue', e); }
    }
    return [];
}

// Active Application State
let inventoryState = loadSavedInventory();
let batchState = loadSavedBatches();
let pendingRequestsState = loadSavedPendingRequests();
let auditLogState = loadSavedAuditLog();
let syncQueueState = loadSavedSyncQueue();

function saveStateToStorage() {
    localStorage.setItem('medicare_inventory_state', JSON.stringify(inventoryState));
    localStorage.setItem('medicare_batch_state', JSON.stringify(batchState));
    localStorage.setItem('medicare_pending_requests', JSON.stringify(pendingRequestsState));
    localStorage.setItem('medicare_audit_log', JSON.stringify(auditLogState));
    localStorage.setItem('medicare_sync_queue', JSON.stringify(syncQueueState));
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

function generatePlainLanguageExplanation(item) {
    const daysSinceUpdate = getDaysSince(item.lastUpdated);
    const isOutdated = daysSinceUpdate > 14 || daysSinceUpdate < 0;
    const { expiredQty } = getItemBatchAnalysis(item.centreId, item.medicineName);
    const usableStock = Math.max(0, item.currentStock - expiredQty);

    let daysRemaining;
    if (item.dailyConsumption <= 0) daysRemaining = Infinity;
    else if (usableStock === 0) daysRemaining = 0;
    else daysRemaining = usableStock / item.dailyConsumption;

    if (isOutdated) {
        return `Record for ${item.medicineName} at ${item.centreId} was updated ${daysSinceUpdate} days ago. A physical audit is recommended.`;
    }
    if (usableStock === 0 && item.dailyConsumption > 0) {
        return `${item.medicineName} is out of stock at ${item.centreId}. Replenishment is required immediately.`;
    }
    if (daysRemaining <= leadTimeDays) {
        return `This medicine may run out in ${daysRemaining.toFixed(1)} days at ${item.centreId}, so arrange replenishment.`;
    }
    if (daysRemaining <= leadTimeDays * 1.5) {
        return `Stock for ${item.medicineName} covers ${daysRemaining.toFixed(1)} days. Reorder recommended soon.`;
    }
    if (expiredQty > 0) {
        return `${expiredQty} units of ${item.medicineName} have expired and are excluded from usable stock.`;
    }
    return `Stock for ${item.medicineName} covers ${daysRemaining.toFixed(1)} days safely exceeding ${leadTimeDays} days lead time.`;
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
    let riskReason = generatePlainLanguageExplanation(item);

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

function computeTransferImpact(donorCentre, recipientCentre, medicineName, qty) {
    const processedAll = inventoryState.map(processForecastItem);

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

    if (inventoryState[donorIdx].currentStock < qty) {
        showToast('Error: Donor PHC does not have enough physical stock to complete transfer.', 'error');
        return false;
    }

    const { matchingBatches, validBatchQty } = getItemBatchAnalysis(donorCentre, medicineName);
    if (matchingBatches.length > 0 && validBatchQty < qty) {
        showToast(`Transfer rejected: Donor PHC has only ${validBatchQty} units in valid non-expired batches (requested ${qty} units).`, 'error');
        return false;
    }

    const donorProcessed = processForecastItem(inventoryState[donorIdx]);
    if (donorProcessed.donorSurplus < qty) {
        showToast(`Warning: Re-validation check failed. Donor safe surplus is currently ${donorProcessed.donorSurplus} units.`, 'warning');
        return false;
    }

    const todayIso = toLocalISO(new Date());

    inventoryState[donorIdx].currentStock -= qty;
    inventoryState[donorIdx].lastTransferAt = todayIso;

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

        batchState.push({
            id: `BAT-XFER-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            batchNumber: `${b.batchNumber}-XFER`,
            centreId: recipientCentre,
            medicineName: medicineName,
            quantity: moveQty,
            expiryDate: b.expiryDate
        });
    });

    batchState = batchState.filter(b => b.quantity > 0);
    saveStateToStorage();
    return true;
}

// ============================================================================
// PART B: ROBUST SPEECH SYNTHESIS & RECOGNITION ENGINE (Tamil & English)
// ============================================================================

let lastSpokenText = '';

function speakText(text, lang = selectedVoiceLanguage) {
    if (!('speechSynthesis' in window)) {
        showToast('Speech audio playback not supported on this browser.', 'info');
        return;
    }

    lastSpokenText = text;
    window.speechSynthesis.cancel(); // Cancel any ongoing speech to avoid overlapping

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.95;

    // Check available voices on device
    const voices = window.speechSynthesis.getVoices();
    if (lang.includes('ta')) {
        const tamilVoice = voices.find(v => v.lang.includes('ta') || v.lang.includes('TA') || v.name.toLowerCase().includes('tamil'));
        if (tamilVoice) utterance.voice = tamilVoice;
    } else {
        const engVoice = voices.find(v => v.lang.includes('en') || v.name.toLowerCase().includes('english'));
        if (engVoice) utterance.voice = engVoice;
    }

    window.speechSynthesis.speak(utterance);
}

function stopSpeaking() {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
}

// Parse spoken Tamil & English number words safely into numbers
function parseSpokenNumber(text, lang = selectedVoiceLanguage) {
    if (!text) return null;
    const str = text.trim().toLowerCase();

    // Check if numeric digits exist
    const digitMatch = str.match(/\d+/);
    if (digitMatch) return parseInt(digitMatch[0], 10);

    // Number dictionary
    const numMap = {
        'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
        'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'hundred': 100,
        'ஒன்று': 1, 'இரண்டு': 2, 'மூன்று': 3, 'நான்கு': 4, 'ஐந்து': 5, 'ஆறு': 6, 'ஏழு': 7, 'எட்டு': 8, 'ஒன்பது': 9, 'பத்து': 10,
        'இருபது': 20, 'முப்பது': 30, 'நாற்பது': 40, 'ஐம்பது': 50, 'அறுபது': 60, 'நூறு': 100
    };

    for (const key in numMap) {
        if (str.includes(key)) return numMap[key];
    }
    return null;
}

function setVoiceStateUI(stateText, stateClass = 'badge-pending') {
    const indicator = document.getElementById('voice-status-indicator');
    if (indicator) {
        indicator.textContent = stateText;
        indicator.className = `badge ${stateClass}`;
    }
}

function startVoiceRecognition(onResultCallback) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        setVoiceStateUI('Unsupported', 'badge-rejected');
        showToast('Speech recognition is not supported on this browser. Please type or click manually.', 'warning');
        return;
    }

    if (activeSpeechRecognition) {
        try { activeSpeechRecognition.stop(); } catch (e) {}
    }

    const recognition = new SpeechRecognition();
    activeSpeechRecognition = recognition;

    recognition.lang = selectedVoiceLanguage;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    const btnStart = document.getElementById('btn-start-voice');
    const btnStop = document.getElementById('btn-stop-voice');
    const transcriptBox = document.getElementById('voice-transcript-box');

    if (btnStart) btnStart.style.display = 'none';
    if (btnStop) btnStop.style.display = 'inline-flex';
    if (transcriptBox) transcriptBox.style.display = 'block';

    setVoiceStateUI('Listening...', 'badge-warning');

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setVoiceStateUI('Processing', 'badge-approved');

        if (transcriptBox) {
            transcriptBox.innerHTML = `<i class="fa-solid fa-comment-dots"></i> Spoken Result: <strong>"${esc(transcript)}"</strong>`;
        }

        if (onResultCallback) onResultCallback(transcript);
        stopVoiceRecognition();
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        let errorMsg = `Speech error: ${event.error}`;
        if (event.error === 'not-allowed') errorMsg = 'Microphone permission denied.';
        if (event.error === 'no-speech') errorMsg = 'No speech detected. Please try speaking again.';

        setVoiceStateUI('Error', 'badge-rejected');
        showToast(errorMsg, 'error');
        stopVoiceRecognition();
    };

    recognition.onend = () => {
        stopVoiceRecognition();
    };

    try {
        recognition.start();
    } catch (err) {
        console.error('Recognition start error', err);
        stopVoiceRecognition();
    }
}

function stopVoiceRecognition() {
    if (activeSpeechRecognition) {
        try { activeSpeechRecognition.stop(); } catch (e) {}
        activeSpeechRecognition = null;
    }

    const btnStart = document.getElementById('btn-start-voice');
    const btnStop = document.getElementById('btn-stop-voice');
    if (btnStart) btnStart.style.display = 'inline-flex';
    if (btnStop) btnStop.style.display = 'none';

    const indicator = document.getElementById('voice-status-indicator');
    if (indicator && indicator.textContent === 'Listening...') {
        setVoiceStateUI('Idle', 'badge-pending');
    }
}

// ============================================================================
// PART C: REAL CAMERA BARCODE SCANNER ENGINE (BarcodeDetector + ZXing Fallback)
// ============================================================================

let activeMediaStream = null;
let barcodeScannerInterval = null;
let scannedSessionLock = false;

async function startCameraScanner() {
    const video = document.getElementById('barcode-video');
    const statusBadge = document.getElementById('camera-status-badge');
    const btnStopCam = document.getElementById('btn-stop-camera');
    scannedSessionLock = false;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (statusBadge) {
            statusBadge.textContent = 'Camera Unavailable';
            statusBadge.className = 'badge badge-rejected';
        }
        showToast('Camera API unavailable. Use manual barcode lookup below.', 'warning');
        return;
    }

    try {
        if (statusBadge) {
            statusBadge.textContent = 'Requesting Camera...';
            statusBadge.className = 'badge badge-warning';
        }

        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });

        activeMediaStream = stream;
        video.srcObject = stream;
        await video.play();

        if (statusBadge) {
            statusBadge.textContent = 'Camera Active (Scanning...)';
            statusBadge.className = 'badge badge-approved';
        }
        if (btnStopCam) btnStopCam.style.display = 'inline-flex';

        // Check if native BarcodeDetector is supported
        if ('BarcodeDetector' in window) {
            const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
            barcodeScannerInterval = setInterval(async () => {
                if (scannedSessionLock || video.readyState < 2) return;
                try {
                    const barcodes = await detector.detect(video);
                    if (barcodes.length > 0) {
                        handleBarcodeDetected(barcodes[0].rawValue);
                    }
                } catch (e) { console.error('Native BarcodeDetector error', e); }
            }, 300);
        } else if (typeof ZXing !== 'undefined' && ZXing.BrowserMultiFormatReader) {
            // ZXing JS Fallback
            const codeReader = new ZXing.BrowserMultiFormatReader();
            codeReader.decodeFromVideoDevice(null, 'barcode-video', (result, err) => {
                if (result && !scannedSessionLock) {
                    handleBarcodeDetected(result.getText());
                }
            });
        } else {
            // Simulated Frame Scanner timer for manual barcode testing
            console.log('BarcodeDetector/ZXing fallback active. Manual lookup enabled.');
        }

    } catch (err) {
        console.error('Camera permission/access error:', err);
        if (statusBadge) {
            statusBadge.textContent = 'Permission Denied / Error';
            statusBadge.className = 'badge badge-rejected';
        }
        showToast('Camera access denied or unavailable. Please use manual barcode entry.', 'error');
        stopCameraScanner();
    }
}

function stopCameraScanner() {
    if (barcodeScannerInterval) {
        clearInterval(barcodeScannerInterval);
        barcodeScannerInterval = null;
    }

    if (activeMediaStream) {
        activeMediaStream.getTracks().forEach(track => {
            track.stop();
        });
        activeMediaStream = null;
    }

    const video = document.getElementById('barcode-video');
    if (video) video.srcObject = null;

    const statusBadge = document.getElementById('camera-status-badge');
    const btnStopCam = document.getElementById('btn-stop-camera');

    if (statusBadge) {
        statusBadge.textContent = 'Camera Stopped';
        statusBadge.className = 'badge badge-pending';
    }
    if (btnStopCam) btnStopCam.style.display = 'none';
}

function handleBarcodeDetected(rawValue) {
    if (scannedSessionLock) return;
    scannedSessionLock = true;

    const barcode = String(rawValue).trim();
    const resultBox = document.getElementById('barcode-lookup-result');
    if (resultBox) resultBox.style.display = 'block';

    speakText(`Barcode ${barcode} detected.`);

    if (barcodeCatalogue[barcode]) {
        const item = barcodeCatalogue[barcode];
        if (resultBox) {
            resultBox.innerHTML = `
                <div style="background:var(--color-safe-bg); border:2px solid var(--color-safe-border); padding:0.75rem; border-radius:6px; color:var(--color-text-main);">
                    <i class="fa-solid fa-circle-check" style="color:var(--color-safe); font-size:1.1rem;"></i> <strong>Barcode Verified Match:</strong><br>
                    <strong>${esc(item.medicineName)}</strong> (GTIN: <code>${esc(barcode)}</code>)<br>
                    <small style="color:var(--color-text-muted);">Unit: ${esc(item.unit)} | Standard Usage: ${item.defaultDailyUse}/day</small><br>
                    <div style="margin-top:0.5rem; display:flex; gap:0.5rem;">
                        <button type="button" class="btn btn-success btn-sm" id="btn-apply-barcode-med">
                            <i class="fa-solid fa-check"></i> Use Verified Medicine in Wizard
                        </button>
                    </div>
                </div>
            `;

            const applyBtn = document.getElementById('btn-apply-barcode-med');
            if (applyBtn) {
                applyBtn.addEventListener('click', () => {
                    document.getElementById('wizard-medicine').value = item.medicineName;
                    stopCameraScanner();
                    document.getElementById('modal-barcode-scanner').classList.remove('open');
                    openSimpleWizardModal();
                    showToast(`Barcode applied: ${item.medicineName}`, 'success');
                });
            }
        }
    } else {
        if (resultBox) {
            resultBox.innerHTML = `
                <div style="background:var(--color-critical-bg); border:2px solid var(--color-critical-border); padding:0.75rem; border-radius:6px; color:var(--color-critical);">
                    <i class="fa-solid fa-triangle-exclamation"></i> <strong>Unknown Barcode (${esc(barcode)})</strong><br>
                    This code is not registered in the local catalogue. Please select or register medicine manually.
                </div>
            `;
        }
    }
}

// ============================================================================
// PART D: OFFLINE OPERATIONAL CONNECTIVITY & SYNC QUEUE ENGINE
// ============================================================================

function updateNetworkStatus() {
    const isOnline = (typeof navigator !== 'undefined' && 'onLine' in navigator) ? navigator.onLine : true;
    const pill = document.getElementById('status-offline');
    const lbl = document.getElementById('lbl-network');

    if (!pill || !lbl) return;

    if (isOnline) {
        if (syncQueueState.length > 0) {
            pill.className = 'network-pill syncing';
            lbl.textContent = `Online (Syncing ${syncQueueState.length} items...)`;
            flushSyncQueue();
        } else {
            pill.className = 'network-pill online';
            lbl.textContent = 'Online (Synced)';
        }
    } else {
        pill.className = 'network-pill offline';
        lbl.textContent = `Offline (${syncQueueState.length} Pending Sync)`;
    }
}

function flushSyncQueue() {
    const isOnline = (typeof navigator !== 'undefined' && 'onLine' in navigator) ? navigator.onLine : true;
    if (!isOnline || syncQueueState.length === 0) return;

    let syncedCount = 0;
    while (syncQueueState.length > 0) {
        const item = syncQueueState.shift();
        logAuditAction('Sync', 'Offline Engine', item.route || 'Local Queue', item.medicine || 'Batch Data', item.qty || 0, 'Synchronized pending offline entry');
        syncedCount++;
    }

    saveStateToStorage();
    updateNetworkStatus();
    showToast(`⚡ Synchronized ${syncedCount} pending offline records to district network!`, 'success');
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
 * Render What-If Supply Chain Simulator
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

    const { suggestedTransfers } = computeRedistribution(processedInventory);
    let simInventory = processedInventory.map(i => ({ ...i }));

    if (assumeTransfers && suggestedTransfers.length > 0) {
        suggestedTransfers.forEach(t => {
            const recipient = simInventory.find(i => i.centreId === t.recipientCentre && i.medicineName === t.medicineName);
            const donor = simInventory.find(i => i.centreId === t.donorCentre && i.medicineName === t.medicineName);
            if (recipient) recipient.usableStock += t.transferQty;
            if (donor) donor.usableStock = Math.max(0, donor.usableStock - t.transferQty);
        });
    }

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
            <td><strong style="color: ${simDaysLeft <= effectiveLeadTime ? 'var(--color-critical)' : 'var(--color-text-main)'};">${simDaysText}</strong></td>
            <td>${esc(simStockoutDate)}</td>
            <td><span class="badge ${item.status === 'CRITICAL' ? 'badge-critical' : (item.status === 'WARNING' ? 'badge-warning' : (item.status === 'OUTDATED' ? 'badge-outdated' : 'badge-safe'))}">${esc(item.status)}</span></td>
            <td><span class="badge ${simStatus === 'CRITICAL' ? 'badge-critical' : (simStatus === 'WARNING' ? 'badge-warning' : (simStatus === 'OUTDATED' ? 'badge-outdated' : 'badge-safe'))}">${esc(simStatus)}</span></td>
            <td>${simShortfall > 0 ? `<strong style="color:var(--color-critical);">${simShortfall} units</strong>` : '0'}</td>
        `;
        tbody.appendChild(tr);
    });

    if (demandMult > 1.0 || delayDays > 0 || shockPercent > 0 || assumeTransfers) {
        banner.className = 'sim-status-banner';
        banner.style.backgroundColor = simCriticalCount > 0 ? 'var(--color-critical-bg)' : 'var(--color-safe-bg)';
        banner.style.borderColor = simCriticalCount > 0 ? 'var(--color-critical-border)' : 'var(--color-safe-border)';
        banner.style.color = simCriticalCount > 0 ? 'var(--color-critical)' : 'var(--color-safe)';
        banner.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <strong>Simulation Active:</strong> ${simCriticalCount} critical shortages projected (${assumeTransfers ? 'Transfers assumed pre-executed; ' : ''}+${simTotalReq} units district requirement under stress conditions).`;
    } else {
        banner.className = 'sim-status-banner';
        banner.style.backgroundColor = 'var(--color-recipient-bg)';
        banner.style.borderColor = 'var(--color-recipient-border)';
        banner.style.color = 'var(--color-recipient-text)';
        banner.innerHTML = `<i class="fa-solid fa-circle-check"></i> Baseline mode active. Adjust sliders or toggle transfer assumption above to stress test supply network.`;
    }
}

function renderBatchTable() {
    const tbody = document.getElementById('batch-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (batchState.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--color-text-muted); padding: 2rem;">No registered medicine batches found.</td></tr>`;
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
            <td>${daysLeft < 0 ? `<span style="color:var(--color-critical); font-weight:bold;">${daysLeft} days</span>` : `${daysLeft} days`}</td>
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

function renderPendingApprovalsAndAudit() {
    const pendingTbody = document.getElementById('pending-tbody');
    const auditTbody = document.getElementById('audit-tbody');
    const pendingNavBadge = document.getElementById('pending-nav-badge');

    const pendingList = pendingRequestsState.filter(r => r.status === 'PENDING');
    if (pendingNavBadge) {
        pendingNavBadge.textContent = pendingList.length;
        pendingNavBadge.style.display = pendingList.length > 0 ? 'inline-block' : 'none';
    }

    if (pendingTbody) {
        pendingTbody.innerHTML = '';
        if (pendingList.length === 0) {
            pendingTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--color-safe); padding: 2rem;"><i class="fa-solid fa-circle-check"></i> No pending transfer requests requiring Medical Officer approval.</td></tr>`;
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
                    <td><strong style="color:var(--color-accent); font-size: 0.95rem;">${req.qty} units</strong></td>
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

    if (auditTbody) {
        auditTbody.innerHTML = '';
        if (auditLogState.length === 0) {
            auditTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--color-text-muted); padding: 2rem;">No audit log records recorded yet.</td></tr>`;
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
                    <td><small style="color:var(--color-text-muted);">${esc(log.note)}</small></td>
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
    const processedList = inventoryState.map(processForecastItem);

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

    const { suggestedTransfers, districtRequirements } = computeRedistribution(processedList);

    const uniqueCentres = new Set(processedList.map(i => i.centreId)).size;
    const uniqueMeds = new Set(processedList.map(i => i.medicineName)).size;
    const criticalCount = processedList.filter(i => i.status === 'CRITICAL').length;
    const totalTransferUnits = suggestedTransfers.reduce((acc, t) => acc + t.transferQty, 0);
    const pendingCount = pendingRequestsState.filter(r => r.status === 'PENDING').length;
    const totalDistrictReqUnits = districtRequirements.reduce((acc, d) => acc + d.remainingDistrictReq, 0);

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

    // Render Overview Table
    const tbodyOverview = document.getElementById('overview-tbody');
    tbodyOverview.innerHTML = '';
    const needsAttentionItems = filteredList.filter(i => i.status === 'CRITICAL' || i.status === 'WARNING' || i.status === 'OUTDATED');
    document.getElementById('needs-attention-count').textContent = `Showing ${filteredList.length} items (${needsAttentionItems.length} need action)`;

    if (filteredList.length === 0) {
        tbodyOverview.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--color-safe); padding: 2rem;"><i class="fa-solid fa-circle-check"></i> No matching medicine stock records found.</td></tr>`;
    } else {
        filteredList.forEach(item => {
            const tr = document.createElement('tr');
            if (item.status === 'CRITICAL') tr.className = 'row-critical';
            if (item.status === 'OUTDATED') tr.className = 'row-outdated';

            let badgeClass = item.status === 'CRITICAL' ? 'badge-critical' : (item.status === 'WARNING' ? 'badge-warning' : (item.status === 'OUTDATED' ? 'badge-outdated' : 'badge-safe'));
            let actionText = item.status === 'CRITICAL' ? 'Execute Transfer / Order Stock' : (item.status === 'WARNING' ? 'Prepare Reorder' : (item.status === 'OUTDATED' ? 'Verify Physical Stock' : 'Stock Optimal'));

            tr.innerHTML = `
                <td><span class="badge ${badgeClass}">${esc(item.status)}</span></td>
                <td><strong>${esc(item.centreId)}</strong> <br><small style="color:var(--color-text-muted);">${esc(centreNames[item.centreId] || '')}</small></td>
                <td><strong>${esc(item.medicineName)}</strong></td>
                <td><strong>${item.usableStock}</strong></td>
                <td>${item.dailyConsumption} / day</td>
                <td><strong>${item.daysRemaining === Infinity ? 'Infinite' : item.daysRemaining.toFixed(1) + 'd'}</strong></td>
                <td>${esc(item.stockoutDate)}</td>
                <td><small style="color:var(--color-text-muted);">${esc(item.riskReason)}</small></td>
                <td>
                    <button class="btn btn-outline btn-sm btn-speak-row" data-text="${esc(item.riskReason)}">
                        <i class="fa-solid fa-volume-high"></i> ${esc(actionText)}
                    </button>
                </td>
            `;
            tbodyOverview.appendChild(tr);
        });

        document.querySelectorAll('.btn-speak-row').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const text = e.currentTarget.dataset.text;
                speakText(text);
            });
        });
    }

    // Render Full Inventory Table
    const tbodyInv = document.getElementById('inventory-tbody');
    tbodyInv.innerHTML = '';
    document.getElementById('inventory-count').textContent = `Showing ${filteredList.length} of ${processedList.length} items`;

    if (filteredList.length === 0) {
        tbodyInv.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--color-text-muted); padding: 2rem;">No matching medicine stock records found.</td></tr>`;
    } else {
        filteredList.forEach(item => {
            const tr = document.createElement('tr');
            if (item.status === 'CRITICAL') tr.className = 'row-critical';
            if (item.status === 'OUTDATED') tr.className = 'row-outdated';

            let daysText = (item.daysRemaining === Infinity) ? 'Infinite (0 use)' : `${item.daysRemaining.toFixed(1)} days`;
            let badgeClass = item.status === 'CRITICAL' ? 'badge-critical' : (item.status === 'WARNING' ? 'badge-warning' : (item.status === 'OUTDATED' ? 'badge-outdated' : 'badge-safe'));

            tr.innerHTML = `
                <td><strong>${esc(item.centreId)}</strong> <br><small style="color:var(--color-text-muted);">${esc(centreNames[item.centreId] || '')}</small></td>
                <td><strong>${esc(item.medicineName)}</strong></td>
                <td><strong>${item.usableStock}</strong> <br><small style="color:var(--color-text-muted);">(${item.currentStock} total)</small></td>
                <td>${item.dailyConsumption} / day</td>
                <td><strong>${daysText}</strong></td>
                <td>${esc(item.stockoutDate)}</td>
                <td>${item.targetCoverageDays}d (${item.targetStock} units)</td>
                <td>${item.shortfall > 0 ? `<span style="color:var(--color-critical); font-weight:bold;">${item.shortfall} units</span>` : '<span style="color:var(--color-safe);">None</span>'}</td>
                <td>
                    <span class="badge ${badgeClass}">${esc(item.status)}</span>
                    <br><small style="color:var(--color-text-muted); font-size: 0.725rem;">${esc(item.riskReason)}</small>
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

    // Render Redistribution Table
    const tbodyTrans = document.getElementById('transfer-tbody');
    tbodyTrans.innerHTML = '';

    if (suggestedTransfers.length === 0) {
        tbodyTrans.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--color-text-muted); padding: 2rem;">No surplus transfers required currently. All health centres operate within safe stock levels!</td></tr>`;
    } else {
        suggestedTransfers.forEach((t, idx) => {
            const tr = document.createElement('tr');
            let badgeClass = t.priority.includes('CRITICAL') ? 'badge-critical' : (t.priority.includes('OUTDATED') ? 'badge-outdated' : 'badge-warning');

            const isPending = pendingRequestsState.some(r =>
                r.status === 'PENDING' &&
                r.donor === t.donorCentre &&
                r.recipient === t.recipientCentre &&
                r.medicine === t.medicineName
            );

            const impactObj = t.impact || computeTransferImpact(t.donorCentre, t.recipientCentre, t.medicineName, t.transferQty);

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
                <td><strong style="color:var(--color-accent); font-size: 0.95rem;">${t.transferQty} units</strong></td>
                <td>${impactCompactHtml(impactObj)}</td>
                <td><small style="color:var(--color-text-muted);">${esc(t.reasoning)}</small></td>
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

    // Render District Procurement Requirements Table
    const tbodyDist = document.getElementById('district-tbody');
    tbodyDist.innerHTML = '';

    if (districtRequirements.length === 0) {
        tbodyDist.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--color-safe); padding: 2rem;"><i class="fa-solid fa-circle-check"></i> No additional district procurement required. All shortfalls covered by safe PHC transfers!</td></tr>`;
    } else {
        districtRequirements.forEach(d => {
            const tr = document.createElement('tr');
            let badgeClass = d.status === 'CRITICAL' ? 'badge-critical' : (d.status === 'OUTDATED' ? 'badge-outdated' : 'badge-warning');

            tr.innerHTML = `
                <td><strong>${esc(d.centreId)}</strong></td>
                <td><strong>${esc(d.medicineName)}</strong></td>
                <td>${d.totalShortfall} units</td>
                <td>${d.coveredBySurplus} units</td>
                <td><strong style="color:var(--color-critical); font-size: 1rem;">${d.remainingDistrictReq} units</strong></td>
                <td>
                    <span class="badge ${badgeClass}">${esc(d.status)}</span>
                    ${d.isOutdated ? '<br><small style="color:var(--color-outdated);">(Manual Audit Needed)</small>' : ''}
                </td>
            `;
            tbodyDist.appendChild(tr);
        });
    }

    renderBatchTable();
    renderFacilityRiskMatrix(processedList);
    renderSimulator(processedList);
    renderDistanceMatrix();
    renderPendingApprovalsAndAudit();
    updateNetworkStatus();
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
        document.getElementById('modal-batch-centre'),
        document.getElementById('wizard-centre')
    ];

    const medSelects = [
        document.getElementById('filter-medicine'),
        document.getElementById('modal-batch-medicine'),
        document.getElementById('wizard-medicine')
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
 * Guided 3-Step Simple Stock Entry Wizard Engine
 */
let wizardCurrentStep = 1;
function openSimpleWizardModal() {
    wizardCurrentStep = 1;
    updateWizardStepView();
    document.getElementById('modal-simple-wizard').classList.add('open');
}

function closeSimpleWizardModal() {
    document.getElementById('modal-simple-wizard').classList.remove('open');
}

function updateWizardStepView() {
    [1, 2, 3].forEach(step => {
        const page = document.getElementById(`wizard-step-${step}`);
        const pill = document.getElementById(`step-pill-${step}`);
        if (page) page.style.display = step === wizardCurrentStep ? 'block' : 'none';
        if (pill) pill.classList.toggle('active', step === wizardCurrentStep);
    });

    const btnBack = document.getElementById('btn-wizard-back');
    const btnNext = document.getElementById('btn-wizard-next');
    const btnSubmit = document.getElementById('btn-wizard-submit');

    if (btnBack) btnBack.style.display = wizardCurrentStep > 1 ? 'inline-flex' : 'none';
    if (btnNext) btnNext.style.display = wizardCurrentStep < 3 ? 'inline-flex' : 'none';
    if (btnSubmit) btnSubmit.style.display = wizardCurrentStep === 3 ? 'inline-flex' : 'none';

    if (wizardCurrentStep === 3) {
        renderWizardSummary();
    }
}

function renderWizardSummary() {
    const centreId = document.getElementById('wizard-centre').value;
    const medicineName = document.getElementById('wizard-medicine').value;
    const qty = parseInt(document.getElementById('wizard-qty').value, 10) || 0;
    const expiry = document.getElementById('wizard-expiry').value || getFutureDateString(180);

    const summaryBox = document.getElementById('wizard-summary-box');
    if (!summaryBox) return;

    const daysLeft = getDaysUntilExpiry(expiry);

    summaryBox.innerHTML = `
        <i class="fa-solid fa-circle-check"></i> <strong>Confirmation Summary:</strong><br>
        Adding <strong>${qty} units</strong> of <strong>${esc(medicineName)}</strong> to <strong>${esc(centreId)}</strong>.<br>
        Expiry Date: <strong>${esc(formatDate(expiry))}</strong> (${daysLeft} days remaining).<br>
        <em>Tamil: ${esc(centreId)} க்கு ${qty} அலகுகள் ${esc(medicineName)} சேர்க்கப்படுகிறது.</em>
    `;

    if (voiceAssistantEnabled) {
        speakText(`${qty} units of ${medicineName} at ${centreId}. Expiry in ${daysLeft} days. Please confirm to save.`, selectedVoiceLanguage);
    }
}

/**
 * Open Request Transfer Modal
 */
let activeRequestData = null;
function openRequestTransferModal(donor, recipient, medicine, qty) {
    activeRequestData = { donor, recipient, medicine, qty };
    const impact = computeTransferImpact(donor, recipient, medicine, qty);

    document.getElementById('req-transfer-summary').innerHTML = `
        <div style="font-size:0.9rem; font-weight:700; margin-bottom:0.5rem; color:var(--color-text-main);">
            Requesting Transfer of <span style="color:var(--color-accent);">${qty} units</span> of <strong>${esc(medicine)}</strong> from <strong>${esc(donor)}</strong> to <strong>${esc(recipient)}</strong>
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

function loadDemoData() {
    loadDemoScenario();
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
    syncQueueState = [];

    localStorage.removeItem('medicare_inventory_state');
    localStorage.removeItem('medicare_batch_state');
    localStorage.removeItem('medicare_pending_requests');
    localStorage.removeItem('medicare_audit_log');
    localStorage.removeItem('medicare_sync_queue');
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
    if (!tabId || typeof document === 'undefined') return;

    // 1. Update navigation tab button active state
    if (document.querySelectorAll) {
        document.querySelectorAll('.nav-tab').forEach(btn => {
            const isActive = btn.dataset.tab === tabId;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
    }

    // 2. Control display of top sections (KPI summary & Filters)
    const kpiSummary = document.getElementById ? document.getElementById('kpi-summary') : null;
    if (kpiSummary) {
        kpiSummary.style.display = (tabId === 'tab-overview') ? 'grid' : 'none';
    }

    const filterToolbar = document.querySelector ? document.querySelector('.filter-toolbar') : null;
    if (filterToolbar) {
        filterToolbar.style.display = (tabId === 'tab-overview' || tabId === 'tab-inventory') ? 'flex' : 'none';
    }

    // 3. Toggle active tab content section
    if (document.querySelectorAll) {
        document.querySelectorAll('.tab-content').forEach(content => {
            const isActive = content.id === tabId;
            content.classList.toggle('active', isActive);
        });
    }

    // 4. Smoothly bring selected section to top of content view
    const mainContainer = document.querySelector ? document.querySelector('.dashboard-container') : null;
    if (mainContainer && typeof mainContainer.scrollIntoView === 'function') {
        mainContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

/**
 * Event Initialization & Event Handlers
 */
document.addEventListener('DOMContentLoaded', () => {
    populateDropdowns();
    renderDashboard();
    updateNetworkStatus();

    setLanguage(currentLanguage);
    setTheme(currentTheme);

    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    // Site Language Selector (English / Tamil)
    const selectSiteLang = document.getElementById('select-site-lang');
    if (selectSiteLang) {
        selectSiteLang.value = currentLanguage;
        selectSiteLang.addEventListener('change', (e) => {
            setLanguage(e.target.value);
            showToast(currentLanguage === 'ta' ? 'இணைதள மொழி தமிழுக்கு மாற்றப்பட்டது.' : 'Website language updated to English.', 'info');
        });
    }

    // Theme Toggle Button (Light / Dark)
    const btnToggleTheme = document.getElementById('btn-toggle-theme');
    if (btnToggleTheme) {
        btnToggleTheme.addEventListener('click', () => {
            toggleTheme();
            showToast(currentTheme === 'dark' ? '🌙 Dark Mode Activated.' : '☀️ Light Mode Activated.', 'info');
        });
    }

    // Settings Modal Handlers
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
            showToast(t('toast_demo_loaded'), 'success');
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

    // Legacy Header Demo/Reset Button Listeners (for automated test compatibility)
    const btnDemoHeader = document.getElementById('btn-demo');
    if (btnDemoHeader) {
        btnDemoHeader.addEventListener('click', loadDemoData);
    }
    const btnResetHeader = document.getElementById('btn-reset');
    if (btnResetHeader) {
        btnResetHeader.addEventListener('click', () => {
            showConfirmModal('Reset All Data', 'Are you sure you want to reset all inventory data?', resetAllData);
        });
    }

    // Add Stock Method Choice Modal Handlers
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

    // Voice Language Selector Listener
    const langSelect = document.getElementById('select-voice-lang');
    if (langSelect) {
        langSelect.addEventListener('change', (e) => {
            selectedVoiceLanguage = e.target.value;
            showToast(`Voice Assistant language updated to ${selectedVoiceLanguage === 'ta-IN' ? 'Tamil (தமிழ்)' : 'English'}.`, 'info');
        });
    }

    // Simple Mode Toggle
    document.getElementById('btn-toggle-mode').addEventListener('click', () => {
        isSimpleModeActive = !isSimpleModeActive;
        const panel = document.getElementById('simple-mode-view');
        const lbl = document.getElementById('lbl-mode');

        if (panel) panel.style.display = isSimpleModeActive ? 'block' : 'none';
        if (lbl) lbl.textContent = isSimpleModeActive ? 'Switch to Detailed Dashboard' : 'Switch to Guided Simple Mode';

        showToast(isSimpleModeActive ? '✨ Switched to Guided Simple Operating Mode (எளிய முறை).' : '📊 Switched to Detailed Operational Dashboard.', 'info');
    });

    // Voice Assistant Controls for Unified Voice Card
    let pendingVoiceAction = null;

    function updateVoiceStatus(statusText, badgeClass = 'badge-pending') {
        const badge = document.getElementById('voice-status-indicator');
        if (badge) {
            badge.textContent = statusText;
            badge.className = `badge ${badgeClass}`;
        }
    }

    const btnToggleVoice = document.getElementById('btn-toggle-voice');
    if (btnToggleVoice) {
        btnToggleVoice.addEventListener('click', () => {
            voiceAssistantEnabled = !voiceAssistantEnabled;
            const lbl = document.getElementById('lbl-voice');
            if (lbl) lbl.textContent = voiceAssistantEnabled ? `Voice: ON (${selectedVoiceLanguage === 'ta-IN' ? 'தமிழ்' : 'Eng'})` : 'Voice: OFF';

            if (voiceAssistantEnabled) {
                updateVoiceStatus(selectedVoiceLanguage === 'ta-IN' ? 'தயாராக உள்ளது' : 'Ready', 'badge-safe');
                speakText(selectedVoiceLanguage === 'ta-IN' ? 'வணக்கம். மேடி-கேர் குரல் உதவி இயக்கப்பட்டது.' : 'Hello. Medi-Care voice assistant activated.', selectedVoiceLanguage);
                showToast('🔊 Voice Assistant ON: Spoken guidance active.', 'success');
            } else {
                stopVoiceRecognition();
                stopSpeaking();
                updateVoiceStatus(selectedVoiceLanguage === 'ta-IN' ? 'முடக்கப்பட்டது' : 'Disabled', 'badge-expired');
                const transcriptBox = document.getElementById('voice-transcript-box');
                if (transcriptBox) transcriptBox.style.display = 'none';
                showToast('Voice Assistant OFF.', 'info');
            }
        });
    }

    const btnStartVoice = document.getElementById('btn-start-voice');
    const btnStopVoice = document.getElementById('btn-stop-voice');

    if (btnStartVoice) {
        btnStartVoice.addEventListener('click', () => {
            if (!voiceAssistantEnabled) {
                voiceAssistantEnabled = true;
                const lbl = document.getElementById('lbl-voice');
                if (lbl) lbl.textContent = `Voice: ON (${selectedVoiceLanguage === 'ta-IN' ? 'தமிழ்' : 'Eng'})`;
            }

            updateVoiceStatus(selectedVoiceLanguage === 'ta-IN' ? 'கவனிக்கிறது...' : 'Listening...', 'badge-warning');
            if (btnStopVoice) btnStopVoice.style.display = 'inline-flex';
            btnStartVoice.style.display = 'none';

            startVoiceRecognition((transcript) => {
                if (btnStopVoice) btnStopVoice.style.display = 'none';
                btnStartVoice.style.display = 'inline-flex';
                updateVoiceStatus(selectedVoiceLanguage === 'ta-IN' ? 'செயல்முறை...' : 'Processing...', 'badge-pending');

                const transcriptBox = document.getElementById('voice-transcript-box');
                const transcriptText = document.getElementById('voice-transcript-text');
                if (transcriptBox && transcriptText) {
                    transcriptText.textContent = `"${transcript}"`;
                    transcriptBox.style.display = 'block';
                }

                const num = parseSpokenNumber(transcript, selectedVoiceLanguage);
                if (num !== null) {
                    pendingVoiceAction = { type: 'QTY', value: num, text: transcript };
                    speakText(selectedVoiceLanguage === 'ta-IN' ? `${num} அலகுகள் அடையாளம் காணப்பட்டது. உறுதி செய்யவா?` : `Recognized quantity ${num} units. Click Confirm to apply.`, selectedVoiceLanguage);
                } else {
                    const meds = Array.from(new Set(inventoryState.map(i => i.medicineName)));
                    const matched = meds.find(m => m.toLowerCase().includes(transcript.toLowerCase())) ||
                                    Object.values(barcodeCatalogue).map(b => b.medicineName).find(m => m.toLowerCase().includes(transcript.toLowerCase()));

                    if (matched) {
                        pendingVoiceAction = { type: 'MEDICINE', value: matched, text: transcript };
                        speakText(selectedVoiceLanguage === 'ta-IN' ? `${matched} தேர்வு செய்யப்பட்டது. உறுதி செய்யவா?` : `Recognized medicine ${matched}. Click Confirm to apply.`, selectedVoiceLanguage);
                    } else {
                        pendingVoiceAction = { type: 'TEXT', value: transcript, text: transcript };
                        speakText(selectedVoiceLanguage === 'ta-IN' ? `சொல்: ${transcript}. உறுதி செய்யவா?` : `Recognized: ${transcript}. Click Confirm to apply.`, selectedVoiceLanguage);
                    }
                }
                updateVoiceStatus(selectedVoiceLanguage === 'ta-IN' ? 'தயாராக உள்ளது' : 'Ready', 'badge-safe');
            });
        });
    }

    if (btnStopVoice) {
        btnStopVoice.addEventListener('click', () => {
            stopVoiceRecognition();
            stopSpeaking();
            if (btnStartVoice) btnStartVoice.style.display = 'inline-flex';
            btnStopVoice.style.display = 'none';
            updateVoiceStatus(selectedVoiceLanguage === 'ta-IN' ? 'தயாராக உள்ளது' : 'Ready', 'badge-safe');
            showToast('Voice listening stopped.', 'info');
        });
    }

    const btnVoiceConfirm = document.getElementById('btn-voice-confirm');
    if (btnVoiceConfirm) {
        btnVoiceConfirm.addEventListener('click', () => {
            if (!pendingVoiceAction) {
                showToast('No pending voice input to confirm.', 'info');
                return;
            }

            if (pendingVoiceAction.type === 'QTY') {
                const qtyInput = document.getElementById('wizard-qty') || document.getElementById('modal-stock-qty');
                if (qtyInput) qtyInput.value = pendingVoiceAction.value;
                showToast(`Applied voice quantity: ${pendingVoiceAction.value} units`, 'success');
                speakText(selectedVoiceLanguage === 'ta-IN' ? `${pendingVoiceAction.value} அலகுகள் சேர்க்கப்பட்டது.` : `Applied quantity ${pendingVoiceAction.value} units.`, selectedVoiceLanguage);
            } else if (pendingVoiceAction.type === 'MEDICINE') {
                const medSelect = document.getElementById('wizard-medicine') || document.getElementById('modal-medicine');
                if (medSelect) medSelect.value = pendingVoiceAction.value;
                showToast(`Applied voice medicine: ${pendingVoiceAction.value}`, 'success');
                speakText(selectedVoiceLanguage === 'ta-IN' ? `${pendingVoiceAction.value} தேர்ந்தெடுக்கப்பட்டது.` : `Selected medicine ${pendingVoiceAction.value}.`, selectedVoiceLanguage);
            }

            const transcriptBox = document.getElementById('voice-transcript-box');
            if (transcriptBox) transcriptBox.style.display = 'none';
            pendingVoiceAction = null;
        });
    }

    const btnVoiceCancel = document.getElementById('btn-voice-cancel');
    if (btnVoiceCancel) {
        btnVoiceCancel.addEventListener('click', () => {
            pendingVoiceAction = null;
            const transcriptBox = document.getElementById('voice-transcript-box');
            if (transcriptBox) transcriptBox.style.display = 'none';
            showToast('Voice action cancelled.', 'info');
        });
    }

    const btnReplayVoice = document.getElementById('btn-replay-voice');
    if (btnReplayVoice) {
        btnReplayVoice.addEventListener('click', () => {
            if (lastSpokenText) speakText(lastSpokenText, selectedVoiceLanguage);
            else speakText(selectedVoiceLanguage === 'ta-IN' ? 'மேடி-கேர் குரல் உதவிக்கு நல்வரவு.' : 'Welcome to Medi-Care voice guidance.', selectedVoiceLanguage);
        });
    }

    // Simple Action Cards Handlers
    document.getElementById('btn-simple-wizard').addEventListener('click', openSimpleWizardModal);

    document.getElementById('btn-simple-expiry').addEventListener('click', () => {
        const box = document.getElementById('simple-mode-content');
        const title = document.getElementById('simple-box-title');
        const body = document.getElementById('simple-box-body');

        title.textContent = '⏳ Medicine Expiry & Usability Check';
        let html = '<div style="display:flex; flex-direction:column; gap:0.5rem;">';
        batchState.forEach(b => {
            const daysLeft = getDaysUntilExpiry(b.expiryDate);
            let badgeClass = daysLeft < 0 ? 'badge-expired' : (daysLeft <= 60 ? 'badge-near-expiry' : 'badge-safe');
            let statusText = daysLeft < 0 ? `EXPIRED ${Math.abs(daysLeft)} days ago (EXCLUDED)` : (daysLeft <= 60 ? `Expires in ${daysLeft} days (Use First)` : `USABLE (${daysLeft} days left)`);

            html += `
                <div style="background:var(--color-surface-alt); padding:0.75rem; border:1px solid var(--color-border); border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong>${esc(b.medicineName)}</strong> - <code>${esc(b.batchNumber)}</code> (${esc(b.centreId)})<br>
                        <small style="color:var(--color-text-muted);">Qty: ${b.quantity} units | Expiry: ${esc(formatDate(b.expiryDate))}</small>
                    </div>
                    <span class="badge ${badgeClass}">${statusText}</span>
                </div>
            `;
        });
        html += '</div>';
        body.innerHTML = html;
        box.style.display = 'block';
    });

    document.getElementById('btn-simple-alerts').addEventListener('click', () => {
        const box = document.getElementById('simple-mode-content');
        const title = document.getElementById('simple-box-title');
        const body = document.getElementById('simple-box-body');

        title.textContent = '⚠️ Plain-Language Medicine Alerts';
        const processed = inventoryState.map(processForecastItem);
        const criticals = processed.filter(i => i.status === 'CRITICAL' || i.status === 'WARNING' || i.status === 'OUTDATED');

        let html = '<div style="display:flex; flex-direction:column; gap:0.65rem;">';
        if (criticals.length === 0) {
            html += '<p style="color:var(--color-safe); font-weight:700;"><i class="fa-solid fa-circle-check"></i> All medicine stock levels operate safely!</p>';
        } else {
            criticals.forEach(i => {
                html += `
                    <div style="background:var(--color-critical-bg); border:1px solid var(--color-critical-border); padding:0.85rem; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <strong style="color:var(--color-critical);">${esc(i.centreId)} — ${esc(i.medicineName)}</strong><br>
                            <span style="color:var(--color-text-main);">${esc(i.riskReason)}</span>
                        </div>
                        <button class="btn btn-outline btn-sm btn-speak-alert" data-text="${esc(i.riskReason)}">
                            <i class="fa-solid fa-volume-high"></i> Listen (கேளுங்கள்)
                        </button>
                    </div>
                `;
            });
        }
        html += '</div>';
        body.innerHTML = html;
        box.style.display = 'block';

        document.querySelectorAll('.btn-speak-alert').forEach(btn => {
            btn.addEventListener('click', (e) => {
                speakText(e.currentTarget.dataset.text);
            });
        });
    });

    document.getElementById('btn-simple-transfers').addEventListener('click', () => {
        switchTab('tab-redistribution');
        showToast('Navigated to Inter-PHC Safe Surplus Transfer Recommendations.', 'info');
    });

    document.getElementById('btn-close-simple-box').addEventListener('click', () => {
        document.getElementById('simple-mode-content').style.display = 'none';
    });

    // Guided 3-Step Wizard Navigation Controls
    document.getElementById('btn-wizard-next').addEventListener('click', () => {
        if (wizardCurrentStep < 3) {
            wizardCurrentStep++;
            updateWizardStepView();
        }
    });

    document.getElementById('btn-wizard-back').addEventListener('click', () => {
        if (wizardCurrentStep > 1) {
            wizardCurrentStep--;
            updateWizardStepView();
        }
    });

    document.getElementById('btn-close-wizard-modal').addEventListener('click', closeSimpleWizardModal);

    // Quantity Stepper Buttons
    document.getElementById('btn-qty-minus10').addEventListener('click', () => {
        const el = document.getElementById('wizard-qty');
        el.value = Math.max(0, parseInt(el.value, 10) - 10);
    });
    document.getElementById('btn-qty-minus1').addEventListener('click', () => {
        const el = document.getElementById('wizard-qty');
        el.value = Math.max(0, parseInt(el.value, 10) - 1);
    });
    document.getElementById('btn-qty-plus1').addEventListener('click', () => {
        const el = document.getElementById('wizard-qty');
        el.value = parseInt(el.value, 10) + 1;
    });
    document.getElementById('btn-qty-plus10').addEventListener('click', () => {
        const el = document.getElementById('wizard-qty');
        el.value = parseInt(el.value, 10) + 10;
    });
    document.getElementById('btn-qty-plus50').addEventListener('click', () => {
        const el = document.getElementById('wizard-qty');
        el.value = parseInt(el.value, 10) + 50;
    });

    // Expiry Presets
    document.getElementById('preset-3m').addEventListener('click', () => {
        document.getElementById('wizard-expiry').value = getFutureDateString(90);
    });
    document.getElementById('preset-6m').addEventListener('click', () => {
        document.getElementById('wizard-expiry').value = getFutureDateString(180);
    });
    document.getElementById('preset-1y').addEventListener('click', () => {
        document.getElementById('wizard-expiry').value = getFutureDateString(365);
    });

    // Barcode Scanner Modal Launch & Teardown
    document.getElementById('btn-wizard-scan').addEventListener('click', () => {
        document.getElementById('modal-barcode-scanner').classList.add('open');
        startCameraScanner();
    });

    const btnStopCam = document.getElementById('btn-stop-camera');
    if (btnStopCam) {
        btnStopCam.addEventListener('click', stopCameraScanner);
    }

    document.getElementById('btn-close-barcode-modal').addEventListener('click', () => {
        stopCameraScanner();
        document.getElementById('modal-barcode-scanner').classList.remove('open');
    });

    document.getElementById('btn-lookup-manual-barcode').addEventListener('click', () => {
        const code = document.getElementById('input-manual-barcode').value.trim();
        handleBarcodeDetected(code);
    });

    // Wizard Submit Handler
    document.getElementById('btn-wizard-submit').addEventListener('click', () => {
        const centreId = document.getElementById('wizard-centre').value;
        const medicineName = document.getElementById('wizard-medicine').value;
        const currentStock = parseInt(document.getElementById('wizard-qty').value, 10) || 0;
        const expiryDate = document.getElementById('wizard-expiry').value || getFutureDateString(180);
        const lastUpdated = toLocalISO(new Date());

        const existingIdx = inventoryState.findIndex(i =>
            i.centreId === centreId &&
            i.medicineName.toLowerCase().trim() === medicineName.toLowerCase().trim()
        );

        if (existingIdx >= 0) {
            inventoryState[existingIdx].currentStock = currentStock;
            inventoryState[existingIdx].lastUpdated = lastUpdated;
        } else {
            inventoryState.push({
                id: `INV-${Date.now()}`,
                centreId,
                medicineName,
                currentStock,
                dailyConsumption: 5,
                targetCoverageDays: 30,
                lastUpdated,
                lastTransferAt: null
            });
        }

        batchState.push({
            id: `BAT-${Date.now()}`,
            batchNumber: `WIZ-BATCH-${Math.floor(Math.random() * 1000)}`,
            centreId,
            medicineName,
            quantity: currentStock,
            expiryDate
        });

        const isOnline = (typeof navigator !== 'undefined' && 'onLine' in navigator) ? navigator.onLine : true;
        if (!isOnline) {
            syncQueueState.push({ type: 'STOCK_UPDATE', centreId, medicineName, currentStock, qty: currentStock });
        }

        saveStateToStorage();
        populateDropdowns();
        renderDashboard();
        closeSimpleWizardModal();

        showToast(`⚡ Stock record saved successfully for ${medicineName} at ${centreId}!`, 'success');
    });

    // Existing Controls
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

    const brandTitle = document.querySelector('.brand-title');
    if (brandTitle) {
        brandTitle.style.cursor = 'pointer';
        brandTitle.addEventListener('click', () => switchTab('tab-overview'));
    }

    // Request Transfer Modal Listeners
    document.getElementById('btn-close-req-modal').addEventListener('click', closeRequestTransferModal);
    document.getElementById('btn-cancel-req').addEventListener('click', closeRequestTransferModal);
    document.getElementById('btn-submit-req').addEventListener('click', () => {
        if (!activeRequestData) return;
        const { donor, recipient, medicine, qty } = activeRequestData;

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

    if (btnOpenStockModal) {
        btnOpenStockModal.addEventListener('click', () => {
            const choiceModal = document.getElementById('modal-add-stock-choice');
            if (choiceModal) {
                choiceModal.classList.add('open');
            } else if (modalStock) {
                modalStock.classList.add('open');
                document.getElementById('modal-last-updated').value = toLocalISO(new Date());
            }
        });
    }

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
