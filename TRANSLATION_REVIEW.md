# MEDI-CARE — Tamil Translation Review Document (TRANSLATION_REVIEW.md)

This document contains key Tamil terminology, alert sentences, status labels, and PIN authorization text used throughout MEDI-CARE. They are prepared for native speaker review and validation.

---

## 1. Alert Sentences (`explainAlert`)

### Critical Alert with Transfer & District Remainder
- **English**: "Paracetamol Syrup at Centre A will run out in 6 days. Ask Centre C (9 km away) for 140 bottles, then request the other 100 from the district."
- **Tamil**: "மையம் A-இல் பாராசிட்டமால் சிரப் 6 நாட்களில் தீர்ந்துவிடும். மையம் C-இடமிருந்து (9 கிமீ) 140 பாட்டில்கள் கேளுங்கள்; மீதமுள்ள 100-ஐ மாவட்டத்திடம் கோருங்கள்."
- **Review Notes**: Check clarity of "மையம்" for PHC and "மாவட்டத்திடம் கோருங்கள்" for district request.

### Out of Stock Alert
- **English**: "Paracetamol Syrup is finished at Centre A. Ask Centre C for 140 bottles today."
- **Tamil**: "மையம் A-இல் பாராசிட்டமால் சிரப் தீர்ந்துவிட்டது. இன்றே மையம் C-இடம் 140 பாட்டில்கள் கேளுங்கள்."
- **Review Notes**: Verify "தீர்ந்துவிட்டது" for out-of-stock.

### Outdated Stock Record
- **English**: "The Amoxicillin count at Centre A is 18 days old. Please count the stock and update it."
- **Tamil**: "மையம் A-இல் அமாக்சிசிலின் எண்ணிக்கை 18 நாட்களுக்கு முந்தையது. இருப்பை எண்ணி புதுப்பிக்கவும்."
- **Review Notes**: Verify "இருப்பை எண்ணி புதுப்பிக்கவும்" for physical audit action.

---

## 2. Status Words Mapping

| Internal Status | English Display | Tamil Display | Reviewer Notes |
| :--- | :--- | :--- | :--- |
| `CRITICAL` | Critical Shortage | அவசரம் (Critical) | High urgency stockout risk |
| `WARNING` | Reorder Warning | எச்சரிக்கை (Warning) | Low stock warning |
| `SAFE` | Safe Stock | பாதுகாப்பு (Safe) | Adequate coverage |
| `OUTDATED` | Outdated Record | பழைய பதிவு (Outdated) | >14 days without physical count |
| `TOP-UP` | Target Top-Up | இருப்பு ஈடுசெய்தல் (Top-up) | Inter-PHC transfer below target |

---

## 3. Key UI & PIN Verification Strings

| Context | English | Tamil | Reviewer Notes |
| :--- | :--- | :--- | :--- |
| PIN Modal Title | Authorise Stock Transfer | மருந்து மாற்றத்திற்கு ஒப்புதல் அளிக்கவும் | MO Authorization modal |
| Operational Policy | Inter-PHC stock redistribution requires Medical Officer PIN verification. | PHC இடையே மருந்து மாற்றம் செய்ய மருத்துவ அலுவலரின் PIN சரிபார்ப்பு தேவை. | Header banner notice |
| Outbox Status | Saved on device, not yet synced | சாதனத்தில் சேமிக்கப்பட்டது, இன்னும் இணையவில்லை | Offline queue status tag |
| Simple Mode Button | Guided Simple Mode | எளிய வழிகாட்டல் முறைமை | Beginner mode switch |
| Sync Pill Online | Online (Synced) | ஆன்லைன் (இணைக்கப்பட்டது) | Network indicator |
| Sync Pill Offline | Offline Mode (Local Storage) | ஆஃப்லைன் முறைமை (உள்ளூர் சேமிப்பு) | Network indicator |

---

## 4. Medicine Unit Nouns (அலகுகள்)

- **Bottles**: பாட்டில்கள் (Bottles)
- **Tablets**: மாத்திரைகள் (Tablets)
- **Capsules**: கேப்சூல்கள் (Capsules)
- **Packets**: பாக்கெட்டுகள் (Packets)
- **Vials**: வயல்கள் / ஊசி மருந்துகள் (Vials)
