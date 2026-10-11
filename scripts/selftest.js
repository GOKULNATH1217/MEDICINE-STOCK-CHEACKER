/**
 * MEDI-CARE Benchmark Self-Test Suite
 * Pitch: "Count the days, then look sideways before you look up."
 *
 * Verifies:
 * 1. Reference demo scenario loading.
 * 2. Centre A: stock 60, cons 10/day -> 6.0 days left, shortfall 240.
 * 3. Centre C: stock 200, cons 2/day -> target 60, safe surplus 140.
 * 4. Transfer recommendation: exactly 140 units C -> A.
 * 5. Impact on Centre A (recipient): stock 60 -> 200, days 6.0 -> 20.0, shortfall 240 -> 100.
 * 6. Impact on Centre C (donor): stock 200 -> 60, days 100.0 -> 30.0, surplus 140 -> 0.
 * 7. District remainder for Centre A: 100 units.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function runSelfTest() {
    const scriptPath = path.join(__dirname, '..', 'script.js');
    const code = fs.readFileSync(scriptPath, 'utf8');

    // Create a mock DOM / Browser Environment for VM execution
    const mockStorage = {};
    const mockElement = () => ({
        value: '',
        textContent: '',
        innerHTML: '',
        className: '',
        style: {},
        classList: { add: () => {}, remove: () => {}, toggle: () => {} },
        setAttribute: () => {},
        getAttribute: () => '',
        addEventListener: () => {},
        appendChild: () => {}
    });

    const context = {
        console,
        Math,
        Date,
        isNaN,
        isFinite,
        parseInt,
        parseFloat,
        String,
        Array,
        Object,
        JSON,
        RegExp,
        Set,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        navigator: { onLine: true, userAgent: 'NodeSelfTest' },
        window: {
            matchMedia: () => ({ matches: false })
        },
        document: {
            documentElement: mockElement(),
            getElementById: () => mockElement(),
            querySelector: () => mockElement(),
            querySelectorAll: () => [],
            createElement: () => mockElement(),
            addEventListener: () => {}
        },
        localStorage: {
            getItem: key => mockStorage[key] || null,
            setItem: (key, val) => { mockStorage[key] = String(val); },
            removeItem: key => { delete mockStorage[key]; },
            clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
        }
    };

    context.window.localStorage = context.localStorage;
    context.window.document = context.document;

    vm.createContext(context);
    vm.runInContext(code, context);

    // Trigger demo scenario loading
    vm.runInContext('loadDemoScenario();', context);

    const inventoryState = vm.runInContext('inventoryState', context);
    const leadTimeDays = vm.runInContext('leadTimeDays', context) || 10;
    const processForecastItem = vm.runInContext('processForecastItem', context);
    const computeRedistribution = vm.runInContext('computeRedistribution', context);

    console.log('=== MEDI-CARE SELF-TEST RUNNER ===');

    // Assertion 1: Check Centre A Paracetamol
    const centreA = inventoryState.find(i => i.centreId === 'Centre A' && i.medicineName.includes('Paracetamol'));
    if (!centreA) throw new Error('FAIL: Centre A Paracetamol record not found.');
    const processedA = processForecastItem(centreA);
    console.log(`[PASS] Centre A Stock: ${processedA.usableStock}, Cons: ${processedA.dailyConsumption}/day, Days Left: ${processedA.daysRemaining.toFixed(1)}, Shortfall: ${processedA.shortfall}`);

    if (processedA.usableStock !== 60) throw new Error(`FAIL: Centre A stock expected 60, got ${processedA.usableStock}`);
    if (Math.abs(processedA.daysRemaining - 6.0) > 0.01) throw new Error(`FAIL: Centre A days left expected 6.0, got ${processedA.daysRemaining}`);
    if (processedA.shortfall !== 240) throw new Error(`FAIL: Centre A shortfall expected 240, got ${processedA.shortfall}`);

    // Assertion 2: Check Centre C Paracetamol
    const centreC = inventoryState.find(i => i.centreId === 'Centre C' && i.medicineName.includes('Paracetamol'));
    if (!centreC) throw new Error('FAIL: Centre C Paracetamol record not found.');
    const processedC = processForecastItem(centreC);
    console.log(`[PASS] Centre C Stock: ${processedC.usableStock}, Cons: ${processedC.dailyConsumption}/day, Target: ${processedC.targetStock}, Safe Surplus: ${processedC.donorSurplus}`);

    if (processedC.usableStock !== 200) throw new Error(`FAIL: Centre C stock expected 200, got ${processedC.usableStock}`);
    if (processedC.donorSurplus !== 140) throw new Error(`FAIL: Centre C surplus expected 140, got ${processedC.donorSurplus}`);

    // Assertion 3: Check Redistribution Output
    const processedList = inventoryState.map(processForecastItem);
    const { suggestedTransfers, districtRequirements } = computeRedistribution(processedList);

    console.log(`[PASS] Suggested Transfers count: ${suggestedTransfers.length}`);
    if (suggestedTransfers.length !== 1) throw new Error(`FAIL: Expected 1 transfer suggestion, got ${suggestedTransfers.length}`);

    const transfer = suggestedTransfers[0];
    console.log(`[PASS] Recommended Transfer: ${transfer.transferQty} units from ${transfer.donorCentre} -> ${transfer.recipientCentre}`);

    if (transfer.donorCentre !== 'Centre C') throw new Error(`FAIL: Expected donor Centre C, got ${transfer.donorCentre}`);
    if (transfer.recipientCentre !== 'Centre A') throw new Error(`FAIL: Expected recipient Centre A, got ${transfer.recipientCentre}`);
    if (transfer.transferQty !== 140) throw new Error(`FAIL: Expected transfer qty 140, got ${transfer.transferQty}`);

    // Assertion 4: Check Transfer Impact
    const impact = transfer.impact;
    if (!impact) throw new Error('FAIL: Transfer impact object missing.');

    console.log(`[PASS] Recipient Impact: ${impact.recipient.stockBefore} -> ${impact.recipient.stockAfter} units (${impact.recipient.daysBefore.toFixed(1)}d -> ${impact.recipient.daysAfter.toFixed(1)}d), Shortfall: ${impact.recipient.shortfallBefore} -> ${impact.recipient.shortfallAfter}`);
    if (impact.recipient.stockBefore !== 60 || impact.recipient.stockAfter !== 200) throw new Error('FAIL: Recipient stock before/after mismatch.');
    if (Math.abs(impact.recipient.daysBefore - 6.0) > 0.01 || Math.abs(impact.recipient.daysAfter - 20.0) > 0.01) throw new Error('FAIL: Recipient days before/after mismatch.');
    if (impact.recipient.shortfallBefore !== 240 || impact.recipient.shortfallAfter !== 100) throw new Error('FAIL: Recipient shortfall before/after mismatch.');

    console.log(`[PASS] Donor Impact: ${impact.donor.stockBefore} -> ${impact.donor.stockAfter} units (${impact.donor.daysBefore.toFixed(1)}d -> ${impact.donor.daysAfter.toFixed(1)}d), Surplus: ${impact.donor.surplusBefore} -> ${impact.donor.surplusAfter}`);
    if (impact.donor.stockBefore !== 200 || impact.donor.stockAfter !== 60) throw new Error('FAIL: Donor stock before/after mismatch.');
    if (Math.abs(impact.donor.daysBefore - 100.0) > 0.01 || Math.abs(impact.donor.daysAfter - 30.0) > 0.01) throw new Error('FAIL: Donor days before/after mismatch.');
    if (impact.donor.surplusBefore !== 140 || impact.donor.surplusAfter !== 0) throw new Error('FAIL: Donor surplus before/after mismatch.');

    // Assertion 5: Check District Procurement Remainder
    console.log(`[PASS] District Requirements count: ${districtRequirements.length}`);
    if (districtRequirements.length !== 1) throw new Error(`FAIL: Expected 1 district requirement, got ${districtRequirements.length}`);

    const districtReq = districtRequirements[0];
    console.log(`[PASS] District Order Required for ${districtReq.centreId}: ${districtReq.remainingDistrictReq} units (Total Shortfall: ${districtReq.totalShortfall}, Covered by Transfers: ${districtReq.coveredBySurplus})`);
    if (districtReq.centreId !== 'Centre A') throw new Error('FAIL: District requirement centre mismatch.');
    if (districtReq.remainingDistrictReq !== 100) throw new Error(`FAIL: Expected district remainder 100, got ${districtReq.remainingDistrictReq}`);

    console.log('\n✅ ALL SELF-TEST ASSERTIONS PASSED 100% SUCCESSFULLY!\n');
}

try {
    runSelfTest();
} catch (err) {
    console.error('\n❌ SELF-TEST ERROR:', err.message);
    process.exit(1);
}
