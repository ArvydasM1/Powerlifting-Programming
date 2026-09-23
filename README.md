# 5/3/1 Forever Log

Training log for Jim Wendler's 5/3/1 Forever templates. Replaces the `531 Forever.xlsx` workbook.
Specification: [SPEC.md](SPEC.md).

The app is a web UI (TypeScript, React, Dexie/IndexedDB) packaged as an Android app with Capacitor.
The same bundle also runs as a PWA in a browser with the native features hidden.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest: calculation rules, template fixtures, repository
npm run typecheck
npm run build      # dist/ (PWA)
```

## Android

Requires Android Studio (SDK 34+) and JDK 17 or later.

```bash
npm run build
npx cap add android      # first time only; creates android/
npx cap sync android
npx cap open android     # build and run from Android Studio, or:
cd android && ./gradlew assembleDebug
```

The in-house plugins (rest alert now; Bluetooth heart rate and Health Connect later) live in
`android/app/src/main/java/com/arvydas/fivethreeone/` and are registered in `MainActivity`. The
`android/` project is committed; `cap sync` refreshes its web assets and plugin list. See SPEC.md §10.3.
The Android build has not yet been run on a machine with the SDK; the first build is the check.

Never commit signing keys, `local.properties`, backups or exports. `.gitignore` covers them; the
pre-commit hook below and CI both run gitleaks (SPEC.md §16).

## Safety hooks

```bash
npm run setup-hooks   # installs the gitleaks pre-commit hook (needs gitleaks on PATH)
```

## Status

| Area (SPEC.md) | State |
|---|---|
| §5–6 domain model and calculation rules | done, unit-tested |
| Appendix A templates (all seven) and 7th-week protocols | done, fixtures from the workbook |
| F1 Setup, F2 Start programme (incl. start-at), F3 Today | done |
| F4 Log session, F10 passive rest timer | done (web alert while visible; native alert via RestAlert plugin) |
| F5 7th week and TM review | done |
| F6 Progress, F7 History, Templates | done |
| F8 workbook import (Parameters, Progress), F9 backup/CSV | done |
| F11 backfill (as prescribed, from workbook sheet, from CSV) | done, tested against the local workbook |
| §10 Capacitor Android shell, RestAlert plugin | written; not yet built (no SDK on the dev machine) |
| §12 Health Connect write/read (Kotlin plugin, sync queue, settings, markers) | written; plugin not yet compiled; library versions to confirm at first build |
| §13 Bluetooth heart rate (bluetooth-le plugin + keep-alive service, Web Bluetooth fallback) | written; native path not yet run on a device |
| §14 sharing (session text/PNG, chart PNG, CSV/JSON, health checkbox) | done |
| §15 AI analysis (four providers, guards, checks, bundle, screen) | done on the web side; live providers not yet exercised against real APIs |

Things that need a device or an API key before they count as verified: RestAlert with the screen off, BLE on the Fitbit Air, Health Connect permissions and records, and a live Gemini or Claude run.

## Data

- Your training data lives only on the device (IndexedDB / app storage). Settings → Backup exports it as JSON.
- The workbook stays local; it is git-ignored. Settings → Import reads its Parameters and Progress sheets.
