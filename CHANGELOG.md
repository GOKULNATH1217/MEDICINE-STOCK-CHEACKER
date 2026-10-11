# MEDI-CARE — Upgrade Changelog

All changes preserve the core hackathon constraints:
1. "Count the days, then look sideways before you look up." (Transfer recommendations & before/after impact on both donor & recipient).
2. Offline-first local persistence + sync queue + 1 plain sentence per alert.
3. Reference demo scenario math: A = 6.0d left, shortfall 240; C = surplus 140; 140 C→A transfer; district remainder 100. Always verified by `scripts/selftest.js`.

---

## Phase 0: Setup & Selftest
- Created `scripts/selftest.js` asserting reference demo scenario:
  - Centre A: 60 stock, 10/day cons $\rightarrow$ 6.0 days left, shortfall 240.
  - Centre C: 200 stock, 2/day cons $\rightarrow$ target 60, safe surplus 140.
  - Transfer: 140 C $\rightarrow$ A.
  - District remainder: 100 units for Centre A.
  - Result: **100% Passed (7/7 assertions)**.
- Created `CHANGELOG.md`.

---

## Phase 1: Fix Known Bugs
- Fixed `resetAllData()` vs `resetData()` naming reference error. Created clean `resetAllData()` function wrapper.
- Removed duplicate click listeners on `#btn-demo` and `#btn-reset`.
- Fixed wizard batch quantity stacking bug by implementing batch reconciliation on stock count updates.
- Fixed wizard default daily consumption by looking up known inventory/catalogue consumption rates before defaulting.
- Fixed transfer priority label for SAFE recipients below 30-day target (changed `'WARNING'` to `'TOP-UP'`).
- Driven dynamic labels (`#lbl-mode`, `#lbl-voice`, `#lbl-network`, `#lbl-theme`) via `i18n`.
- Replaced text emojis with clean inline SVG icon sprite symbols.
- Set Demo PIN hint ("Demo PIN: 1234") to appear only when demo data is loaded (`isDemoDataLoaded`).

---

## Phase 2: Offline-First (Constraint 2)
- Added `sw.js` (Service Worker) with cache-first app-shell strategy for `index.html`, `script.js`, `style.css`, `manifest.webmanifest`, and `ping.txt`.
- Added `manifest.webmanifest` for Android Home Screen PWA installation.
- Removed external CDN dependencies (Google Fonts, Font Awesome, ZXing CDN) for 100% offline self-containment.
- Added inline SVG icon sprite (`<symbol id="icon-...">`) in `index.html`.
- Implemented `connectivity.js` heartbeat checking `ping.txt` every 15s with 3 status pill states (`Online`, `Offline`, `Syncing (N)`).
- Implemented `OutboxQueue` module storing queued mutations (`STOCK_UPSERT`, `BATCH_ADD`, `TRANSFER_REQUEST`, `TRANSFER_APPROVE`, `TRANSFER_REJECT`) in `medicare_sync_queue` with mock server sync adapter (`medicare_mock_server_db`).
- Added "Sync Status" outbox panel in Settings.

---

## Phase 3: One Plain Sentence Per Alert (Constraint 2)
- Created single `explainAlert(item, context)` function returning `{ en: string, ta: string }`.
- Rules enforced: $\le 25$ words, plain words, zero jargon ("surplus", "lead time", "greedy", "algorithm" omitted), naming medicine, centre, days left, and specific next action.
- Added medicine unit nouns (bottles, tablets, capsules, packets, vials) in English & Tamil (`getMedicineUnitNoun`).
- Replaced alerts across Overview cards, inventory tooltips, simple mode, voice speech, and transfer reasoning.

---

## Phase 4: Full Tamil Mode
- Expanded `i18n` dictionary with complete English and Tamil translations.
- Added `data-i18n`, `data-i18n-placeholder`, `data-i18n-title`, `data-i18n-aria` attribute handling.
- Created `centreNamesTa` and `medicineNamesTa` maps for Tamil display names.
- Added `?i18ncheck` URL query dev check logging missing translation keys and Latin script in Tamil mode.
- Created `TRANSLATION_REVIEW.md` listing key Tamil strings for native speaker review.

---

## Phase 5: Professional UI Redesign
- Redesigned with clinical design tokens in `style.css` (neutral slate greys, teal primary `#0f766e` / `#14b8a6`, status-only colours).
- Header: slim, quiet layout with brand logo mark, sync pill, segmented language toggle, primary Add Stock button, and Settings modal.
- Overview Page: 3-step pitch strip (1 Predict $\rightarrow$ 2 Look sideways $\rightarrow$ 3 Then look up), 4 headline KPI cards, alert cards grid with progress bars and stockout dates.
- Transfers Page: Card view for Donor $\rightarrow$ Recipient transfers with distance, before/after impact, plain sentence, and separate District Procurement section below.
- High contrast, WCAG AA compliance, zero inline `style=""` in `index.html`, right-aligned tabular numbers for numbers.
