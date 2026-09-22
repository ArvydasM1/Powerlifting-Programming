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

The in-house plugins (rest alert, later Bluetooth heart rate and Health Connect) live under `native/`
and are copied into the Android project by `cap sync`. See SPEC.md §10.3.

Never commit signing keys, `local.properties`, backups or exports. `.gitignore` covers them; the
pre-commit hook below and CI both run gitleaks (SPEC.md §16).

## Safety hooks

```bash
npm run setup-hooks   # installs the gitleaks pre-commit hook (needs gitleaks on PATH)
```

## Data

- Your training data lives only on the device (IndexedDB / app storage). Settings → Backup exports it as JSON.
- The workbook stays local; it is git-ignored. Settings → Import reads its Parameters and Progress sheets.
