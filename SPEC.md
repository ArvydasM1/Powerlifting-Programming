# 5/3/1 Forever Training Log — Application Specification

Status: Draft v0.11 (2026-09-22)
Source: `531 Forever.xlsx` (12 sheets) reverse-engineered in full, plus research on each template (Appendix D).

Decisions taken so far:

1. Platform is a **Capacitor Android app with a web UI inside** (§10). The same bundle is also served as a PWA for desktop use, but the Android app is the primary target and the only one that carries the native plugins. (v0.1–v0.7 said plain PWA; changed in v0.8.)
2. Each template's Training Max (TM) progression was researched and is fixed in §6.2 and Appendix A.
3. 7th Week: a **deload** follows the leader phases, a **TM test** follows the whole programme. Both are optional (§6.3).
4. **Assistance is optional** everywhere (§6.9).
5. **Krypteia uses the book layout** (Part 1 four days with Press, Parts 2 and 3 three days without Press), not the workbook's (A1).
6. **Cycle increases are a setup value** per lift; the app does not push the book's numbers (§5.1).
7. **Rest breaks are logged without any input.** A timer shows the time since the last set was logged; when the next set is logged that elapsed time is stored as its rest. No buttons, no editing (§6.10, F10).
8. **Health Connect sync is Phase 2.** The Android packaging it needs is now part of v1, so Phase 2 adds only the plugin and permissions (§12).
9. **Wearable data comes in two ways.** Heart rate, sleep and recovery are read back from Health Connect in Phase 2 (§12.9), and live heart rate from the Fitbit Air is captured over Bluetooth by a native plugin in v1.1 (§13). Devices: Fitbit Air and OnePlus Watch.
10. **Sharing and AI analysis are added.** Sharing (§14) is v1.1 and uses the phone's share sheet. AI analysis (§15) is Phase 3: opt-in per run, produces proposals the lifter accepts or rejects, never diagnoses.
11. **AI analysis defaults to zero-cost routes.** Subscriptions to Claude or Gemini do not cover API calls from a third-party app, so the default provider is share-and-paste into the Claude or Gemini app, the Gemini free tier is the automated zero-cost option, a Claude Code command covers the laptop, and the paid Claude API is opt-in with the model as a setting (§15.2).
12. **A programme can be started part-way through, and past sessions can be backfilled.** F2 gains a "Start at" position; F11 adds one-tap, workbook and CSV backfill. Backfilled sets are flagged and excluded from rest, recovery and Health Connect (§6.11).
13. **The repository is public.** No secrets, no training or health data, no signing material may be committed. Rules and the enforcing `.gitignore`, hooks and CI checks are in §16.

---

## 1. Purpose

Replace the `531 Forever.xlsx` workbook with an app that:

1. Holds the lifter's Training Maxes and progression parameters.
2. Generates sessions from a 5/3/1 Forever **template** (7 exist in the workbook) with all weights pre-calculated.
3. Lets the lifter log what was actually done, set by set, on a phone in the gym.
4. Tracks rep PRs and estimated 1RM per lift over time.
5. Handles the 7th Week Protocol and cycle-to-cycle TM increases without manual copying.

The app must reproduce every calculation the spreadsheet currently performs, and fix the structural problems listed in §3.

---

## 2. What the spreadsheet does today

| Sheet | Role |
|---|---|
| `Parameters` | TM per lift (Squat 145, Bench 95, Press 57.5, Deadlift 162.5 kg), rounding step (2.5), per-lift cycle increase (2.5 / 2.5 / 2.5 / 5). Named ranges `TRMSquat`, `IncreaseSquat`, `Rounding`, etc. drive every formula. |
| `Krypteia`, `Five and Dime`, `Coffinworm`, `FBBBB`, `Leviathan`, `God is a Beast`, `Pervertor` | One sheet per template. Each is a grid of **Lift / Weight / Reps / Reps Done** rows grouped into weeks and phases (Leader 1, Leader 2, 7th Week, Anchor). `Weight` is a formula `MROUND(TM × % [+ n × Increase], Rounding)` or a reference to an earlier set (FSL). `Reps` is the target, `Reps Done` is typed in. |
| `Assistance` | Catalogue of assistance exercises (Push / Pull / Single-Leg-Core) and per-day assistance blocks (5 sets of 10 with weight and reps done, summed against a 50-rep target). |
| `Progress` | Per lift: a numbered list of `Weight × Reps` PR attempts and the estimated 1RM `MROUND(Weight / (1.0278 − 0.0278 × Reps), Rounding)`, with 4 line charts. |
| `7th Week Deload` | Per lift: 70%×5, 80%×3-5, 90%×1, 100%×1. Plus a warm-up calculator. |
| `Training Max Test` | Per lift: 40%×5, 50%×5, 70%×5, 80%×5, 90%×5, 100%×5. |

Every template sheet also has a **Warm-up Calc** block: enter a top set, get 40%×5, 50%×5, 60%×3, 70%×2, 80%×1, 90%×1.

---

## 3. Problems the app must fix

1. **History is not frozen.** Weights are live formulas on the current TM. Changing the TM rewrites every previously logged session's prescribed weight. Historical sessions must store the weight that was actually prescribed and lifted.
2. **Rep targets are corrupted.** Values typed as `3-5`, `1-3`, `5/3` were auto-converted by Excel to dates (`2024-03-05`, `2019-03-05`, `2020-01-03`). The app needs a proper rep-target type (§6.4).
3. **No dates.** Sessions have no date, so progress can't be plotted over time and "where am I in the program" is manual.
4. **Cycle increments are inconsistent.** Templates hard-code `+ Increase`, `+ 2×Increase` etc. Several blocks are wrong (Appendix B). The app derives TM per phase from one rule per template (§6.2).
5. **Manual copying.** Starting a new cycle means copying a sheet. The app generates a program instance from a template and the current TMs.
6. **Assistance is disconnected** from the sessions it belongs to.
7. **PRs are manually transcribed** into `Progress`. The app detects PRs from logged sets.

---

## 4. Scope

**In scope (v1)**

- Single lifter, single device, offline-first Android app (web UI in a Capacitor shell). No accounts, no sync. The same web bundle is also hosted as a PWA for desktop viewing; features that need a native plugin hide themselves there.
- The four main lifts: Squat, Bench, Press, Deadlift. kg only, rounding step configurable.
- All 7 templates from the workbook, defined as data (not code), plus the two 7th-week protocols.
- Session logging (main lift, supplemental, optional assistance), PR tracking, e1RM chart, warm-up calculator.
- One-time import of existing `Progress` PR history and `Parameters` from the workbook.

**Out of scope (v1)**

- Multi-user, cloud sync, coaching/sharing.
- Visual template editor (templates are JSON files under `templates/`, edited in git).
- Conditioning, mobility, body-weight tracking.
- lb units (the model uses a rounding step, so lb support is a settings change later).
- Health Connect sync and read-back (Phase 2, §12). v1 must not make choices that block it: session and set timestamps, rep counts and exercise identity are stored as specified in §5, and every session and set has a stable ID.
- Live heart rate over Bluetooth (§13) is v1.1. The native Bluetooth plugin is the only new piece; the packaging it runs in ships with v1.
- Sharing (§14) is v1.1. AI analysis (§15) is Phase 3. v1 must keep every record exportable as JSON with stable IDs so the analysis bundle can be built without a migration.

---

## 5. Domain model

```
Lifter (settings)
 ├─ TrainingMax[]            one row per lift, with effective-from date (history kept)
 ├─ Exercise[]               main lifts + assistance catalogue
 ├─ Template[]               seeded from files; immutable once a Program references it
 └─ Program[]                an instance of a Template started on a date with frozen TMs
     └─ Session[]            one gym visit; belongs to a phase / week / day of the program
         └─ SetGroup[]       "Squat main", "Bench FSL 5x5", "DB Row" – ordered blocks
             └─ Set[]        prescribed weight/reps + actual weight/reps + flags
 └─ PRRecord[]               weight × reps → e1RM, derived from Sets, per lift
```

### 5.1 Settings / Lifter

| Field | Type | Notes |
|---|---|---|
| roundingStep | decimal | default 2.5 |
| unit | enum {kg} | lb reserved |
| cycleIncrease | map lift → decimal | setup value per lift; imported from the workbook as Squat 2.5, Bench 2.5, Press 2.5, Deadlift 5 |
| includeDeloadAfterLeaders | bool | default true |
| includeTmTestAtEnd | bool | default true |
| includeAssistance | bool | default true; per-program override |
| e1rmFormula | enum | default `wendler` (§6.5) |
| defaultRestSec | map blockType → int | main 180, supplemental 90, assistance 60, superset 45; template blocks may override. Used only as the reference shown on the timer. |
| restAlert | enum {vibrate, sound, both, none} | default vibrate; fires once when the reference time is reached |

Note on `cycleIncrease`: this is a plain setup parameter the lifter owns. The book's general guidance (+5 lb upper / +10 lb lower per cycle) is shown as help text next to the field only; the app never changes or flags the value.

### 5.2 TrainingMax

| Field | Type | Notes |
|---|---|---|
| lift | enum {Squat, Bench, Press, Deadlift} | |
| value | decimal | |
| effectiveFrom | date | full history kept; TM at date D = latest row with effectiveFrom ≤ D |
| source | enum {manual, tmTest, cycleIncrease, programEnd} | |

### 5.3 Exercise

| Field | Type | Notes |
|---|---|---|
| id, name | | |
| kind | enum {main, assistance} | |
| category | enum {push, pull, singleLegCore} | assistance only; from `Assistance!G:H` |
| loadType | enum {barbell, dumbbell, bodyweight, band} | drives default weight entry |

Seed assistance catalogue (from the workbook): Push — Dips, Push-ups, Dumbbell Press, Triceps Extension, Full Range Plate Raise. Pull — Chin-ups/Pull-ups, Inverted Rows, Rows, Curls, Band Pull-aparts, Face Pulls, Rear Laterals, Upright Row, Shrugs. Single Leg/Core — Back Raises, Glute Ham Raise, SLDL/Good Morning, Abs, Single Leg Movements, Farmer Walk, DB Squat, Neck. Also used in Krypteia: DB Row, DB Goblet Squat, DB Incline Press, DB SLDL; and Ab Wheel, Hanging Leg Raises, Lunges from the day blocks.

### 5.4 Template (data, not code)

A template is a JSON document:

```jsonc
{
  "id": "krypteia",
  "name": "Krypteia",
  "phases": [
    {
      "name": "Leader 1",
      "kind": "leader",            // prep | leader | anchor | seventhWeek
      "tmOffset": 0,               // number of cycleIncrease steps added to base TM
      "weeks": [
        {
          "label": "Week 1",
          "sessions": [
            {
              "label": "Squat day",
              "blocks": [
                { "type": "main", "lift": "Squat",
                  "sets": [ {"pct":0.65,"reps":"5"}, {"pct":0.75,"reps":"5"}, {"pct":0.85,"reps":"5"} ] },
                { "type": "supplemental", "lift": "Squat", "scheme": "FSL", "sets": 5, "reps": "5" },
                { "type": "assistance", "exercise": "DB Row", "sets": 7, "reps": "10",
                  "superset": true, "optional": true }
              ]
            }
          ]
        }
      ]
    },
    { "name": "7th Week", "kind": "seventhWeek", "protocol": "deload", "optional": true }
  ]
}
```

Block `type` values and how weight is resolved:

| type | weight source |
|---|---|
| `main` | `pct × TM(lift, phase)` rounded |
| `supplemental` with `scheme: FSL` | weight of the **first** main set of the same lift in this session |
| `supplemental` with `scheme: SSL` | weight of the **second** main set |
| `supplemental` with `pct` | explicit `pct × TM` (BBB 5×10 @ 50 %, Leviathan 5×5 @ 80 %) |
| `assistance` | last weight used for that exercise (editable); always `optional` |

Set-level fields: `pct`, `reps` (rep-target string, §6.4), `optional` (bool), `note` (e.g. "Joker").

Block-level optional field `restSec` overrides the settings default for every set in the block (for example Krypteia supersets carry `restSec: 45` because the book wants 30–60 s between sets and the whole session under 45 minutes; Coffinworm and Leviathan top singles carry `restSec: 240`).

`tmOffset` is an integer count of cycle-increase steps, resolved at program start against the frozen base TM. This replaces the `+ IncreaseSquat`, `+ 2*IncreaseSquat` formulas. Values per template are in §6.2.

### 5.5 Program

| Field | Notes |
|---|---|
| templateId, startDate | |
| baseTM | map lift → decimal, **frozen at start** |
| options | includeDeload, includeTmTest, includeAssistance (copied from settings, editable at start) |
| status | planned / active / completed / abandoned |
| currentPointer | phase / week / session index |
| startAt | phase / week / session index the lifter is starting from; `0/0/0` for a fresh start (§6.11) |
| sessionsPerWeek, trainingDays | used to back-date sessions before `startAt` and to propose dates after it; from the template, editable |

On creation the app expands every session of the template into `Session` rows with prescribed weights already resolved. Optional phases and optional blocks the lifter switched off are not generated. Sessions before `startAt` are generated with status `beforeStart` (§5.6).

### 5.6 Session

| Field | Notes |
|---|---|
| programId, phaseIndex, weekIndex, sessionIndex | |
| plannedLabel | e.g. "Leader 1 · Week 2 · Bench day" |
| date | null until started; for backfilled sessions the schedule date or the date the lifter typed |
| dateApproximate | bool; true when the date came from the back-dated schedule rather than a real start (§6.11) |
| startedAt, finishedAt | timestamps; duration is derived; null for backfilled sessions |
| status | planned / inProgress / done / skipped / beforeStart / backfilled |
| notes | free text |
| warmupTopSet | optional decimal for the warm-up calc |

`beforeStart` sessions are the ones generated before the program's `startAt`; they are not planned, not skipped and not counted as missed. Backfilling one (F11) turns it into `backfilled`.

### 5.7 SetGroup and Set

| Set field | Notes |
|---|---|
| order | |
| exercise | |
| prescribedWeight | decimal, resolved at program creation |
| prescribedReps | rep-target string |
| actualWeight | decimal, defaults to prescribed |
| actualReps | int |
| optional | bool |
| isPR | derived, §6.6 |
| plannedRestSec | int, reference rest shown on the timer; resolved at program creation from block `restSec` or the settings default |
| actualRestSec | int, derived: seconds between the previous logged set and this one (§6.10); null for the first set of a session and for every backfilled set. Never entered or edited. |
| completedAt | timestamp set by the "done" tap; the only input rest logging needs; null for backfilled sets |
| backfilled | bool; set by F11, never by normal logging (§6.11) |
| source | enum {logged, backfillPrescribed, backfillWorkbook, backfillCsv} |

### 5.8 PRRecord

Derived view over Sets on main lifts plus imported history: `lift, date, weight, reps, e1rm`. Imported rows from `Progress` have `source = import`.

---

## 6. Calculation rules

### 6.1 Weight

`weight = round_to_step(TM_for_phase × pct)` where `round_to_step(x) = round(x / step) × step` (Excel `MROUND` semantics, half away from zero).

### 6.2 TM for a phase (researched per template)

`TM_for_phase(lift) = program.baseTM[lift] + phase.tmOffset × settings.cycleIncrease[lift]`

The book's general rule: the TM goes up by one increment after **every completed cycle** (Leader 1 → Leader 2 → Anchor), and the 7th Week itself adds nothing. The only template with its own rule is Krypteia, whose first part is run twice at the same TM.

| Template | Phase sequence and `tmOffset` | Source of rule |
|---|---|---|
| Five and Dime | Leader 1 = 0 · Leader 2 = 1 · [Deload] · Anchor = 2 · [TM test] | general rule |
| Coffinworm | Leader 1 = 0 · Leader 2 = 1 · [Deload] · Anchor = 2 · [TM test] | general rule; Boostcamp: "run as a leader for 2 cycles" |
| FBBBB | Leader 1 = 0 · Leader 2 = 1 · [Deload] · Anchor = 2 · [TM test] | general rule; BBB is always a leader |
| Leviathan | Leader 1 = 0 · Leader 2 = 1 · [Deload] · Anchor = 2 · [TM test] | Boostcamp: "increase TMs" after each 3-week leader |
| God is a Beast | Leader 1 (6 wk) = 0 · Leader 2 (6 wk) = 1 · [Deload] · Anchor = 2 · [TM test] | Boostcamp: "increase your TM only after completing the 6 weeks" |
| Pervertor | Leader 1 = 0 · Leader 2 = 1 · [Deload] · Anchor = 2 · [TM test] | PricePlow log: "+5 lb upper / +10 lb lower between cycles" |
| Krypteia | Part 1 cycle 1 = 0 · Part 1 cycle 2 = **0** · Part 2 cycle 1 = 0 · Part 2 cycle 2 = 1 · [Deload] · Part 3 (anchor) = 2 · [TM test] | Book example quoted on Boostcamp: bench 300 / 300 → 300 / 305 → 310; squat 300 / 300 → 300 / 310 → 320. Press has no Part 2/3 sessions, so its TM is only exercised in Part 1 and the TM test. |

Where the workbook differs from these (Appendix B) the app follows this table.

### 6.3 7th Week Protocol and TM update at the end of a program

Sequence for every template: **Leaders → 7th Week Deload (optional) → Anchor → 7th Week TM Test (optional)**.

- **Deload** (after the last leader): `70%×5, 80%×3-5, 90%×1, 100%×1` per lift at the last leader's TM. No TM change. Can be skipped when starting the program (`includeDeload = false`) or skipped on the day (session marked skipped).
- **TM Test** (after the anchor, at the anchor's TM + one increment, i.e. the TM proposed for the next program): `40%×5, 50%×5, 70%×5, 80%×5, 90%×5, 100%×5`. The last set is the test.
- **Proposed TM for the next program**, shown in a review dialog the lifter can override:

| Outcome | Proposal |
|---|---|
| TM test skipped or not included | anchor TM + one increment (the general rule) |
| ≥ 5 reps at 100 % | anchor TM + one increment (test confirms it) |
| 3–4 reps at 100 % | hold at anchor TM + one increment but flag "borderline" (book: 3–5 good reps = pass) |
| < 3 reps | `round_to_step(e1rm_of_test_set × 0.85)` |

Any accepted change writes a `TrainingMax` row with `effectiveFrom = today, source = tmTest | programEnd`.

### 6.4 Rep-target grammar

Rep targets seen in the workbook: `5`, `10`, `20`, `10+`, `1+`, `3+`, `3-5`, `1-3`, `1-3+`, `PR`. Grammar:

```
target := number | number "+" | number "-" number | number "-" number "+" | "PR"
```

- `n` — exactly n reps expected; fewer is a miss.
- `n+` — AMRAP with minimum n.
- `a-b` — range; success if actualReps in [a, b]. `a-b+` — range, AMRAP encouraged.
- `PR` — AMRAP, no minimum; flag as PR attempt.

Store as string, parse on use. Never store as a number or date.

### 6.5 Estimated 1RM

`e1rm = round_to_step(weight / (1.0278 − 0.0278 × reps))` for `1 ≤ reps ≤ 12`. Above 12 reps show e1RM greyed out. Matches `Progress!J`.

### 6.6 PR detection

A logged main-lift set is a rep PR if `actualReps > best actualReps ever at ≥ that weight` for the lift. It is an e1RM PR if its e1rm exceeds the lift's previous best. Only sets with a `+`, range, or `PR` target, or where actualReps > prescribed, are considered. Backfilled sets take part on the same terms; a PR whose session has `dateApproximate = true` is shown with that flag in the Progress table.

### 6.7 Warm-up calculator

Given a top set weight W: 40%×5, 50%×5, 60%×3, 70%×2, 80%×1, 90%×1 of W, each rounded. Default W = heaviest prescribed main set of the session.

### 6.8 Joker sets

Where a template marks `note: "Joker"` the app offers optional extra singles/triples at +5 % steps above the top set, matching the top set's reps. Never generated automatically; added by the lifter on the day.

### 6.9 Assistance (optional)

- Every assistance block is `optional: true`. A program-level switch hides assistance entirely; a session-level toggle hides it for one day.
- Templates that specify assistance (Krypteia supersets) carry it as suggested blocks. Templates that don't carry the book's guideline as a note only: **Push / Pull / Single-Leg-Core, 25–50 reps each in leaders, 50–100 in anchors**. The lifter picks exercises from the catalogue; the app remembers the last choice and weight per template day.
- Assistance sets never affect PRs, TM, or session completion status.
- For an assistance block, show `sum(actualReps)` against `sets × reps` target (the workbook compares against 50).

### 6.10 Rest between sets (passive)

- Rest logging needs no input beyond the "done" tap the lifter already makes. `actualRestSec` of a set = `completedAt(this set) − completedAt(previous logged set in the session)`. It is computed and stored at the moment the set is logged.
- The set's own execution time is inside that number, since the phone only knows when the lifter tapped "done". The History screen labels the column "since last set" so it is read correctly.
- The first logged set of a session has `actualRestSec = null` (warm-up time before it is not rest).
- The "previous logged set" is the previous set of **any** exercise in the session, in the order they were logged. This is what makes supersets right: Squat → DB Row → Squat logs the second Squat's rest as the gap since the row.
- Sets logged out of order, or optional sets skipped, do not matter: the calculation only looks at the last `completedAt` in the session.
- The timer on screen counts **up** from the last "done" tap. `plannedRestSec` is drawn as a reference mark on it and triggers the one-off alert; it is never enforced and never changes what is logged.
- There is no edit of `actualRestSec`. If a tap was forgotten, the logged rest is simply long; the lifter can add a session note.
- Session duration = `finishedAt − startedAt`; average rest per block type is derived for the History and Progress screens.

### 6.11 Starting part-way through, and backfilled data

- **Base TM from the current TM.** When a program starts at a phase with `tmOffset = k`, the lifter enters the TM they are lifting with now, and the app sets `baseTM = currentTM − k × cycleIncrease` per lift, shows the arithmetic, and lets it be overridden. All phases are then generated from that base exactly as for a fresh start, so the weights of the sessions already done match what was lifted.
- **Dates.** The lifter gives either the programme's original start date or the date of the next session. Sessions are placed on `trainingDays` from that anchor, forwards for planned sessions and backwards for `beforeStart` ones. Any date produced this way has `dateApproximate = true` until the lifter edits it.
- **What backfilled sets do not have:** `completedAt`, `actualRestSec`, vitals. They therefore never enter rest averages, recovery values, session duration, or Health Connect sync.
- **What they do have:** prescribed and actual weight and reps, so they count for PRs (§6.6), the e1RM chart, adherence and volume, and the AI bundle (§15.4), where they are marked `backfilled` so the model can weigh them.
- **Origin is kept.** `Set.source` records whether a value was logged live, taken as prescribed, read from the workbook, or read from a CSV, so a later cleanup can find them.

---

## 7. Features and acceptance criteria

### F1 Setup
- Enter TM per lift, rounding step, per-lift cycle increase, default toggles for deload / TM test / assistance.
- AC: values persist; changing rounding re-renders only **unstarted** sessions.

### F2 Start a program
- Pick a template; toggle deload, TM test, assistance.
- **Start at.** Default is the beginning. Otherwise pick phase, week and session from the template's grid. The TM entry then asks for the TM in use *now* and derives the base TM (§6.11); for a fresh start it asks for the base TM directly, pre-filled from the current TM.
- **Dates.** Enter the programme's original start date or the date of the next session; confirm sessions per week and training days.
- App expands the template into sessions with resolved weights using §6.2; sessions before the start point get status `beforeStart`.
- After creation the app offers to backfill the `beforeStart` sessions (F11) or leave them.
- AC: with the workbook TMs, generated weights match the spreadsheet for every block listed in Appendix A2–A8 except the cells flagged in Appendix B (those are the regression fixtures). Krypteia (A1) is verified against the book layout table instead.
- AC: starting Five and Dime at Anchor week 2 with a current Squat TM of 150 and a 2.5 increase gives a base TM of 145, and the generated Leader 1 weights equal a fresh start at 145.
- Only one program may be `active` at a time.

### F3 Today
- Shows the next planned session: phase, week, blocks, prescribed weight × reps, warm-up sets, TM in use for this phase.
- "Start session" stamps the date and switches to logging.

### F4 Log a session
- Each set has a large tap target: tapping marks it done with prescribed weight/reps; edit to change actual weight/reps.
- Optional sets (jokers, "?" secondary blocks, assistance) are collapsed by default and expand with one tap.
- Assistance sets: weight remembered from last time; reps entered per set; running total vs target.
- Session can be finished with unfinished sets (they remain `planned`, counted as skipped).
- AC: PR flags appear immediately when an AMRAP set beats history.

### F5 7th Week
- Deload and TM-test sessions render from §6.3 when included. Each can be skipped from the session screen.
- Finishing the TM test (or finishing the anchor when the test is excluded) opens the TM-review dialog with the proposal from §6.3. Accepting writes the TM history row and marks the program `completed`.

### F6 Progress
- Per lift: table of PR attempts (date, weight, reps, e1RM) and a line chart of e1RM over time with TM history overlaid.
- AC: imported `Progress` rows without dates are plotted by their original ordinal.

### F7 History
- List of completed sessions with date, duration and average rest, filter by program/lift, open any session read-only (or unlock to edit).

### F8 Import from workbook
- One-time importer for `Parameters` (TM, rounding, increases) and `Progress` (PR lists).
- The same importer reads the `Reps Done` cells of a template sheet when asked to by F11.

### F9 Export / backup
- Export all data as JSON; import restores it. CSV export of sets, including planned and actual rest.

### F10 Rest timer and rest logging (no input)
- The Session screen has a sticky bar showing a count-up timer since the last set was logged, with the next set's weight and reps under it. It starts by itself on every "done" tap. It has no buttons.
- The reference rest for the next set is drawn as a mark on the bar; when the timer passes it the phone gives the configured alert once. The timer keeps counting.
- Logging the next set stores the elapsed time as that set's rest and restarts the timer. That is the whole interaction.
- The timer is recomputed from timestamps whenever the screen is drawn, never from a running interval, so screen lock, backgrounding and app restart cannot stall it.
- Each logged set row shows the rest that was stored for it (e.g. "2:45"). Read-only.
- Session header shows elapsed time since `startedAt`.
- AC: with two sets marked done 100 s apart, the second set's `actualRestSec` is 100 and no other action was needed. Backgrounding the app for 5 minutes mid-rest and returning shows the timer at 5 minutes or more, not stalled. Squat → DB Row → Squat logs the rest before the second Squat as the gap since DB Row. There is no UI path that changes a stored rest value.

### F11 Backfill past sessions
Applies to `beforeStart` sessions of the active program, and to `skipped` sessions the lifter did do but forgot to log. Three ways, usable per session or for a whole block:

- **Done as prescribed.** One tap marks every main and supplemental set done at the prescribed weight and reps (`source = backfillPrescribed`). Assistance is left empty. The session becomes `backfilled` with the schedule date. The lifter then edits only the sets that differed, usually the AMRAP top sets.
- **From the workbook.** For the six templates whose sheet matches the app layout (A2–A7), the importer maps each sheet block to a session and writes `actualReps` from the `Reps Done` column (`source = backfillWorkbook`). Weights are the app's own calculation, not the sheet's. Blank cells leave the set unlogged. The sheet has no dates, so all these sessions get schedule dates with `dateApproximate = true`. Krypteia is seeded from the book layout and does not match its sheet; it falls back to "done as prescribed".
- **From CSV.** Columns `date, exercise, weight, reps[, order]`. Rows are matched to that date's planned sets in order (`source = backfillCsv`); rows with no planned set on that date are stored as extra sets on a new `backfilled` session for that date. Exercise names are matched to the catalogue case-insensitively; unknown names are listed for the lifter to map or skip before anything is written.
- All three are previewed as a table before commit and written in one transaction per session. Undo is a per-session "clear backfill" that returns it to `beforeStart`.
- AC: backfilling a 3-week block as prescribed takes at most one tap per session plus the top-set edits, and the e1RM chart shows a continuous line across the block. A workbook import of Five and Dime Leader 1 reproduces the `Reps Done` cells set for set. A CSV row for a date with no session creates one flagged session and no error.

---

## 8. Screens

1. **Today** — next session card, start button, TM summary strip.
2. **Session** — sticky count-up rest bar (F10, no controls) with next set preview; elapsed session time; vertical list of blocks; sticky block header with lift and warm-up button; set rows showing prescribed, actual, and rest since last set; finish button; assistance section collapsed.
3. **Program** — phase/week grid, tap a cell to jump to a session; progress indicator; TM per phase.
4. **Progress** — lift tabs, chart, PR table.
5. **Templates** — list of seeded templates with a read-only preview of each week and the TM progression table.
6. **Settings** — TM editor with history, rounding, increases, default toggles, backup/restore, import; Health Connect (Phase 2); AI analysis provider, keys and model (Phase 3).
7. **Analysis** (Phase 3, §15) — run button with cost estimate, latest report, list of past reports, proposals with accept / dismiss.

---

## 9. Non-functional requirements

- Works with no network; all state stored locally; survives app restart.
- Logging a set must take one tap in the common case. That tap is also the only input the rest log needs.
- Rest timing is timestamp-based so it survives screen lock, backgrounding and app restart. The alert at the reference rest is delivered by the native rest-alert plugin (§10.3), which schedules a one-shot alarm and fires vibration or sound with the screen off. In the PWA build the alert falls back to the Vibration API while the page is visible and to the count-up display on return.
- While a session is open the screen stays on (native keep-awake flag; Screen Wake Lock in the PWA build).
- Every `Set` write (done, weight/reps edit) is a single transaction so a crash mid-session loses at most one tap.
- Data model versioned; migrations on schema change.
- Templates are files under `templates/` so they can be diffed and reviewed in git.
- Unit tests for §6 rules with fixtures derived from the workbook (Appendix A).

---

## 10. Platform (decided: Capacitor Android app, web UI inside)

### 10.1 Why not a plain PWA

The v0.1 decision was a plain PWA. Three later requirements changed it: rest alerts must fire with the screen off (§6.10, F10), which a web page cannot do; live Bluetooth heart rate (§13) drops when a web page is backgrounded; and Health Connect (§12) has no web API at all. All three need native code, and wrapping once in v1 is cheaper than adding a wrapper in Phase 2 and re-packaging what already shipped. App-private storage also removes the risk of the browser evicting IndexedDB under storage pressure. A native Kotlin app would give the same benefits but throws away the single codebase and desktop use.

### 10.2 Stack

- **Web layer (all the app logic and UI):** TypeScript. UI: React or Svelte (implementer's choice). Storage: IndexedDB via Dexie, running inside the Android WebView with the app's private storage. Chart: Recharts or Chart.js. Build/test: Vite + Vitest. Template JSON validated against a schema at build time.
- **Shell:** Capacitor, Android target only. Minimum SDK 26. Signed APK built locally; installed by sideloading or through a Play internal-testing track. No Play Store listing is planned.
- **Plugins:** Capacitor community plugins where they exist (Share, Keep Awake, Filesystem for exports, Local Notifications). In-house Kotlin plugins for rest alert, Bluetooth heart rate and Health Connect (§10.3). Each in-house plugin is a single Kotlin file plus a TypeScript interface, kept in `native/` in this repo.
- **Feature detection:** every native capability is behind `Capacitor.isPluginAvailable(name)`. The same bundle runs in a browser as a PWA with those features hidden; nothing else is conditional on platform.
- **No backend.** Backup is the JSON export (F9), kept outside this repository (§16).
- **Updates:** rebuild and reinstall the APK. The PWA build updates on reload.

### 10.3 In-house native plugins

| Plugin | Ships in | Does |
|---|---|---|
| `RestAlert` | v1 | `schedule(atEpochMs, kind)` sets a one-shot exact alarm and fires vibration and/or a short sound at that time even with the screen off; `cancel()`. No notification is shown unless the app is not in the foreground, in which case a silent notification carries the vibration. |
| `HeartRateBle` | v1.1 | Scans for the standard Heart Rate Service, connects, keeps the connection in a foreground service while a session is open, emits `sample {bpm, ts}` events at 1 Hz, reconnects on drop. |
| `HealthConnect` | Phase 2 | Write exercise sessions and segments; read the record types in §12.9. |

### 10.4 What stays the same

Everything in §5 to §9. The web code has no Android-specific branches beyond the feature detection above, so the unit tests and the template fixtures run in Node exactly as before.

---

## 11. Remaining open questions

1. Does the OnePlus Watch (or a Wear OS app on it) broadcast the standard Bluetooth heart rate profile? If yes, §13 covers it too; if not, it is Phase 2b only. Check on the device.
2. Does the Google Health app write HRV to Health Connect for the Fitbit Air? Google's list confirms heart rate, resting heart rate and sleep; HRV is unconfirmed. Check in the Health Connect app's data sources after a night's wear.

---

## 12. Phase 2 — Health Connect sync (Android)

### 12.1 Why it is a separate phase

Health Connect has no web API, so it needs the `HealthConnect` plugin from §10.3. The Android packaging is already in v1; Phase 2 is only the plugin, its permissions, the privacy-policy activity and the sync module. It is kept separate because it is the one part that touches Google's health-data rules and needs a real device to test.

### 12.2 Packaging

- **Plugin.** A small in-house Kotlin plugin (roughly 100 lines) calling the Jetpack Health Connect client. Rationale: the paid Capawesome plugin writes whole sessions only, and the free community plugins are mostly read-only. Writing our own gives per-set segments.
- **Feature flag.** As §10.2: the web layer checks `Capacitor.isPluginAvailable("HealthConnect")`. In the PWA build the Health Connect settings and sync code are hidden and inert.
- **Android requirements.** Health Connect is built into Android 14+; Android 9–13 needs the Health Connect app from Play; minimum SDK 26. The manifest declares only `android.permission.health.WRITE_EXERCISE` (plus `READ_WEIGHT` if 12.6 is built), the Health Connect package query, and a privacy-policy activity that Health Connect opens from its permission screen. Publishing on Google Play requires the Health apps declaration and approval of the data types; for personal use the APK is sideloaded or installed through an internal testing track, which avoids that review.

### 12.3 What is written

One record per completed session, written when the session is finished:

| Health Connect object | Source in our model |
|---|---|
| `ExerciseSessionRecord`, type strength training | `Session.startedAt` → `Session.finishedAt`; title = `plannedLabel`; notes = `Session.notes` |
| one `ExerciseSegment` per logged set | `Set.completedAt − (actualRestSec or a fixed 30 s for the first set)` → `Set.completedAt`; `repetitions = actualReps`; `segmentType` from the exercise map below |
| client record ID | `Session.id`, so later edits and deletes update or remove the same record |

Segment type map: Squat → squat, Bench → bench press, Deadlift → deadlift, Press → barbell shoulder press. Assistance exercises map to the nearest Health Connect segment type where one exists (dips, pull-ups, lunges, etc.), otherwise to the generic weightlifting/other strength type. The map is a data file next to the exercise catalogue.

Health Connect segments carry **no weight or load field**, so kilos stay in our app only. This reflects the API as understood at spec time and must be re-checked against the current androidx release before implementation; if a load field has been added, write `actualWeight` to it.

### 12.4 Sync behaviour

- Trigger: "Finish session" enqueues a sync job for that session. Jobs run immediately when the plugin is present and permission is granted; otherwise they stay queued and retry on next app launch.
- Idempotent: writes use the session ID as the client record ID, so re-running a job upserts rather than duplicates.
- Edits to a completed session re-enqueue it. Deleting a session enqueues a delete by client record ID.
- Only sessions with at least one logged main-lift set are synced. Skipped 7th-week sessions, assistance-only sessions and `backfilled` sessions (no real timestamps, §6.11) are not.
- Nothing is read from Health Connect for the core features; the app remains the source of truth.

### 12.5 Settings and UI

- Settings gains a "Health Connect" section, visible only when the plugin is present: connection status, a button that opens the Health Connect permission screen, a toggle to enable sync, a "sync all unsynced" action and a count of queued jobs.
- Each session in History shows a small synced / queued / failed marker.
- First enable shows a one-screen explanation of what is written (12.3) before requesting permission.

### 12.6 Body weight read-back

Body weight from Health Connect (`WeightRecord`, `READ_WEIGHT`) overlaid on the Progress chart. Folded into the read module in 12.9; same permissions handling.

### 12.7 Acceptance criteria

- Finishing a session with the plugin present and permission granted creates one exercise session in Health Connect with the correct start and end times and one segment per logged set with the right rep count.
- Finishing a session with permission denied leaves the job queued; granting permission and reopening the app drains the queue.
- Editing a set's reps in a synced session and saving updates the segment; deleting the session removes the record.
- Running the PWA build in a browser shows no Health Connect UI and no errors.

### 12.8 Later platforms

iOS would need the equivalent HealthKit plugin behind the same feature flag. Not planned.

### 12.9 Phase 2b — reading wearable data from Health Connect

Same wrapper and plugin as 12.2; only read permissions and a read module are added.

**Devices and how their data reaches Health Connect**

| Device | Companion app | Writes to Health Connect | Lag |
|---|---|---|---|
| Fitbit Air (screenless band, launched May 2026) | Google Health app (the renamed Fitbit app) | steps, heart rate, resting heart rate, sleep sessions and stages, exercise; HRV and skin temperature are recorded in Google Health but not confirmed as written to Health Connect | minutes after the band syncs to the phone |
| OnePlus Watch | OHealth | steps, heart rate, sleep | 5–15 minutes after the watch syncs |

Both companion apps must have their Health Connect sync switched on. When both devices wear at once, Health Connect holds two heart rate streams; the app reads both and lets the lifter pick a preferred source in Settings, defaulting to the one with more samples in the session window.

**Data types read**

| Type | Health Connect record | Permission | Used for |
|---|---|---|---|
| Heart rate samples | `HeartRateRecord` (series) | `READ_HEART_RATE` | per-session trace, per-set recovery |
| Resting heart rate | `RestingHeartRateRecord` | `READ_RESTING_HEART_RATE` | readiness overlay |
| HRV | `HeartRateVariabilityRmssdRecord` | `READ_HEART_RATE_VARIABILITY` | readiness overlay, if present |
| Sleep | `SleepSessionRecord` | `READ_SLEEP` | readiness overlay (duration, stages) |
| Body weight | `WeightRecord` | `READ_WEIGHT` | Progress chart overlay (12.6) |

Not requested: history beyond 30 days (`READ_HEALTH_DATA_HISTORY`) and background reads (`READ_HEALTH_DATA_IN_BACKGROUND`). Reads happen in the foreground for sessions logged after permission was granted, which is all the app needs.

**When reads happen**

- Never at "finish session": the data is not there yet. A read job for the session window (`startedAt − 5 min` to `finishedAt + 5 min`) is queued at finish and runs on the next app launch or when the session is opened from History, whichever comes first, and again until at least one heart rate sample is found or 48 hours have passed.
- Readiness values (resting HR, HRV, sleep) for a session date are read the same way for the window from the previous evening to the session start.
- Results are cached per session in a `SessionVitals` record. Health Connect stays the source; a "refresh" action on the session re-reads.

**Derived per session** (stored in `SessionVitals`)

| Field | Definition |
|---|---|
| hrAvg, hrMax | over the session window |
| hrSource | package name of the app that wrote the samples |
| perSet[] | for each logged set: `hrAtDone` = nearest sample to `completedAt`; `hrMinBeforeNext` = lowest sample between this set's `completedAt` and the next set's; `recoveryBpm = hrAtDone − hrMinBeforeNext` |
| restingHr, hrvRmssd, sleepMinutes, sleepStages | for the session date |

**UI**

- Session detail: a heart rate trace across the session with set markers at each `completedAt`; per-set row shows `hrAtDone → hrMinBeforeNext`.
- Progress: toggleable overlays for resting HR, HRV and sleep on the e1RM chart, and body weight.
- Settings, Health Connect section: per-type read toggles (each maps to one permission), preferred heart rate source, last read time.

**Acceptance criteria**

- A session logged while wearing either device shows a heart rate trace on the next app launch after the companion app has synced, with an average, a maximum and per-set values.
- A session with no samples in the window shows "no heart rate data" and retries on later launches for 48 hours, then stops.
- Denying one read permission disables only that overlay; the rest keep working.
- Two heart rate sources in the same window produce one trace from the preferred source and a note naming the other.

---

## 13. v1.1 — Live heart rate over Bluetooth

### 13.1 Basis

The Fitbit Air can broadcast heart rate using the standard Bluetooth LE Heart Rate Service (GATT 0x180D, characteristic 0x2A37) when "Share heart rate" is enabled in Google Health, and the "Always visible" toggle keeps it advertising between sessions. The `HeartRateBle` plugin (§10.3) connects to that service from a foreground service, so the connection survives screen lock and backgrounding for the whole session. The band connects to one app at a time.

The OnePlus Watch is not known to broadcast the standard profile; it is Phase 2b only. Whether it can is left as an open check (§11).

### 13.2 Behaviour

- Session screen gains a heart icon. Tapping it starts a scan for the heart rate service and shows the devices found; the choice is remembered for one-tap reconnect next time.
- While connected, the sticky bar shows the live BPM next to the rest timer. Samples arrive as plugin events at 1 Hz, are recorded into a per-session buffer and written to the same `SessionVitals` record as 12.9, tagged `hrSource = "ble:<device name>"`.
- Per-set fields in 12.9 are computed from the live buffer at the moment the next set is logged, so recovery numbers appear during the session, not the next day.
- Disconnects are shown but never block logging. The plugin reconnects on its own while the session is open, and drops the connection and its foreground service when the session is finished.
- Nothing is written to the band. No OS-level pairing is required; the plugin uses the runtime Bluetooth permissions (`BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`) requested on first use.

### 13.3 Constraints

- Android app only. In the PWA build the feature falls back to Web Bluetooth in Chrome when `navigator.bluetooth` exists (foreground use only, connection drops when the page is hidden) and hides itself otherwise.
- The band cannot broadcast to Google Health and the app at the same time; Google Health keeps its own 24/7 record regardless, so the Phase 2b read-back still works for the same session.
- Battery on the band drops faster with "Always visible" on; note this in the Settings help text.
- The foreground service shows Android's persistent notification while connected; its text is the current BPM.

### 13.4 Acceptance criteria

- On the Android app with a Fitbit Air broadcasting, tapping the heart icon, choosing the band, locking the phone, and logging three sets over ten minutes produces an unbroken live BPM trace and per-set recovery values without any Health Connect involvement.
- In the PWA build without Web Bluetooth the icon is not rendered and no console errors appear.
- Losing the band mid-session leaves logged sets and rest untouched; the trace has a gap.
- If Phase 2b later reads Health Connect samples for the same session, the live buffer is kept as the primary trace and the Health Connect trace is stored alongside, not merged.

---

## 14. v1.1 — Sharing

### 14.1 Principle

Nothing leaves the phone unless the lifter taps Share. There is no public link, no server, no automatic upload. Sharing hands a file or text to the phone's share sheet through the Capacitor Share plugin (files written to the app cache with the Filesystem plugin first), and the lifter picks the destination app. In the PWA build the Web Share API is used where `navigator.canShare({files})` is true, and the content is offered as a download otherwise.

### 14.2 What can be shared

| From | Content | Format |
|---|---|---|
| Session detail | One session: date, template position, every set with prescribed and actual weight and reps, rest, PR flags, session duration, heart rate summary if present | Text summary (for chat apps) and a PNG card rendered from the session view |
| Progress | e1RM chart per lift with TM history overlay | PNG of the chart; CSV of the PR table |
| Program | The whole program: phases, weeks, sessions, sets, completion status | JSON (the app's own export shape) and CSV of sets |
| History | Date range: all sessions in range | CSV of sets; JSON |
| Settings → Backup | Everything (F9) | JSON |
| Analysis (Phase 3) | The report and its proposals | Markdown text; the analysis bundle as JSON (§15.4) so any external assistant can read it |

The text summary uses a fixed compact form so it is readable in a chat message, for example one line per set: `Squat 122.5×5 (5) · 2:45`.

### 14.3 Rules

- The share sheet is opened only from an explicit tap; never from a timer, a finish action or a background job.
- Shared files are named `<template>-<date>-<kind>.<ext>` so they sort in the receiving app.
- Vitals (heart rate, sleep, HRV) are included in session and analysis shares only if the "include health data" checkbox on the share dialog is ticked; it is unticked by default and its last state is not remembered.
- The JSON export shape is versioned (`schemaVersion`) and is the same shape the analysis bundle and the backup use, so there is one exporter.

### 14.4 Acceptance criteria

- On Android Chrome, Share on a session opens the system share sheet with a text and a PNG; choosing a messaging app delivers both.
- On a browser without `navigator.canShare({files})` the same tap downloads the PNG and shows the text in a copyable box.
- A share with the health checkbox unticked contains no heart rate, HRV or sleep values anywhere in the payload.

---

## 15. Phase 3 — AI analysis (bring your own key)

### 15.1 Purpose and limits

An optional analysis layer that reads the lifter's history and returns, in one run: a performance review, a list of things worth attention, and proposals for assistance exercises and for the next programme. It advises; the lifter decides. It does not diagnose, and the app enforces that in the prompt, in the output schema and in the UI wording.

Hard limits:

- Runs only when the lifter taps Analyse, after a consent screen that lists what will be sent.
- Requires an API key the lifter supplies. The app has no key of its own and no backend.
- Every proposal is a suggestion object the lifter accepts or dismisses; nothing is written to TMs, programs or settings by the model.
- Health flags are worded as observations with a fixed suffix telling the lifter to consult a medical professional; the model is instructed never to name a condition, and a client-side filter drops any flag whose text matches a diagnosis pattern list before display.

### 15.2 Provider architecture

**Why four providers.** A Claude Pro/Max or Gemini Advanced subscription covers only that vendor's own apps. Anthropic's consumer terms (enforced from April 2026) bar subscription logins from third-party apps, and Google's work the same way, so any call this app makes to an API is billed separately. The providers below are ordered by cost to the lifter; the first two cost nothing.

An `AnalysisProvider` interface, `(bundle, schema, promptKind) → validated report`, with four implementations in scope:

| # | Provider | How it works | Cost | Default |
|---|---|---|---|---|
| 1 | `share` (share-and-paste) | The app builds the bundle and prompt as one file and hands it to the share sheet (§14). The lifter opens it in the Claude or Gemini app, which their subscription covers, and sends it. The reply is JSON; the lifter taps "Paste report" and the app reads the clipboard and validates it. Setup once: save the system prompt (§15.6) as a Claude Project or a Gemini Gem so each run is "attach, send". | none | **yes** |
| 2 | `gemini-free` | Calls the Gemini API with a free Google AI Studio key. Flash-class model only (Pro models are billed). Structured output via the API's JSON schema mode against the same report schema. Daily request caps are far above one run a week. | none, but Google may use free-tier inputs and outputs to improve its models, so the "include health data" box is forced off and shown as unavailable for this provider | automated zero-cost option |
| 3 | `claude-code` | A command in this repo (`analysis/`) takes an exported bundle file, runs the same prompt through the official Claude Code CLI on the lifter's own machine, and writes `report.json`. The app imports that file (F8 importer, report kind). Running Anthropic's own CLI on a machine you control is ordinary subscription use. | none beyond the subscription | laptop route |
| 4 | `anthropic-api` | Calls the Claude API directly from the WebView with the Anthropic TypeScript SDK, `dangerouslyAllowBrowser: true`. Model is a setting: `claude-opus-5` (default when this provider is chosen), `claude-sonnet-5`, `claude-haiku-4-5`. Adaptive thinking, `output_config.effort: "high"`, streaming with `finalMessage()`, structured output via `messages.parse` and `zodOutputFormat` on the report schema, server-side refusal fallbacks on (`fallbacks: "default"`). | metered, see §15.8 | opt-in |

Rules that apply to all four:

- Same bundle, same system prompt, same report schema, same guardrails (§15.1, §15.5, §15.7). The provider only decides who runs the model.
- The Settings screen shows the four with a one-line cost note each, and the consent screen names the provider and the estimated cost (zero for 1–3) before every run.
- Providers 2 and 4 store their key with the Capacitor Secure Storage plugin (Android Keystore-backed). In the PWA build the key is stored in IndexedDB encrypted with WebCrypto under a passphrase entered once per launch. Keys are never in plain text and never in the export or backup.
- The direct call from the WebView in provider 4 is acceptable because the app is single-user and the key belongs to the same person who installed it; the SDK's warning about exposing keys targets multi-user sites.
- Provider 1 and 3 replies are treated as untrusted input like any other: schema-validated, diagnosis-filtered, proposals gated behind Accept.

Not in scope: subscription OAuth for any vendor (prohibited), on-device models such as Gemini Nano (context far too small for the bundle), and any other hosted API. The interface makes adding one a single file.

### 15.3 Data minimisation

- The bundle contains no name, email, device ID or free-text session notes unless the lifter ticks "include notes" on the consent screen.
- Dates are sent as ISO dates; they are needed for trend analysis.
- Vitals are included only if the "include health data" box is ticked, unticked by default.
- The consent screen shows the bundle size in tokens (via `messages.countTokens` for provider 4, the Gemini count endpoint for provider 2, a local estimate for 1 and 3) and the estimated cost at the model's list price before the run starts.
- For provider 2 the vitals section is never built, whatever the box says, and the consent screen states why.

### 15.4 Analysis bundle (input)

Built from the same versioned export as §14, then reduced:

| Section | Contents | Reduction |
|---|---|---|
| settings | rounding, cycle increases, unit | none |
| trainingMax | full TM history per lift | none |
| programs | every program: template, start/end, options, status | none |
| sessions | last 26 weeks in full: every set with prescribed and actual weight and reps, rest, PR flags, duration, `backfilled` and `dateApproximate` flags | older than 26 weeks: per-session aggregates only (date, lift, top set, total volume, e1RM of best set) |
| prs | every PR record | none |
| vitals | per-session hrAvg, hrMax, per-set recovery, restingHr, hrvRmssd, sleepMinutes | only if health box ticked; only summary fields, never raw samples |
| templates | the seven template IDs with a one-paragraph description each and their TM offsets | fixed text |
| assistance catalogue | exercise IDs and categories | fixed |

Target size: under 60k tokens for two years of training. The system prompt and the template descriptions are byte-stable and placed first so they are prompt-cached across runs; the bundle follows as a single document block.

### 15.5 Report schema (output)

Returned as JSON validated by Zod; anything that fails validation is shown as a raw text failure and not acted on.

```
report
 ├─ performance
 │   ├─ perLift[]: {lift, trend: up|flat|down, e1rmChange12w, bestRecent, notes}
 │   ├─ adherence: {sessionsPlanned, sessionsDone, skippedSets, avgRestByBlockType}
 │   └─ summary: markdown, ≤ 300 words
 ├─ attention[]                       // "things worth attention", not diagnoses
 │   └─ {kind: performance|recovery|consistency|load, severity: info|watch|discuss,
 │       evidence: [{metric, values, dates}], text}
 ├─ exerciseProposals[]
 │   └─ {exerciseId (from catalogue) | newName, category, reason, suggestedSetsReps, forDays[]}
 └─ programProposal
     ├─ templateId (one of the seven)
     ├─ reason
     ├─ tmProposal: {lift → value}      // must be within ±10 % of current TM or it is rejected client-side
     ├─ options: {includeDeload, includeTmTest, includeAssistance}
     └─ startDate
```

`severity: discuss` is the strongest allowed; the fixed UI suffix for it is "Consider discussing this with a medical professional." The model is told the allowed kinds and that `attention.text` must describe the data, not the person.

### 15.6 Prompt design

- System prompt (frozen, cached): role, the 5/3/1 Forever rules the app already encodes (§6), the seven templates and when each is appropriate, the output contract, and the non-diagnosis rule.
- User turn: the bundle document, then the question, which is one of three fixed prompts: full analysis, "what next programme", or "review last block". Fixed prompts keep the cache warm and the output comparable across runs.
- Effort `high`; adaptive thinking left on; `max_tokens` 16000; streaming so the run is not cut by a request timeout.
- Rule-based checks run **before** the model and are passed in as facts, so the model does not have to find them: e1RM regression over 6 weeks, three or more missed sessions in a row, resting heart rate 10 % above its 8-week median for 5 days, HRV 20 % below median, rest averages doubling. These same checks are shown in the Analysis screen even when no model run happens.

### 15.7 Acting on proposals

- An exercise proposal has Accept, which adds the exercise to the catalogue (if new) and pins it as the default assistance for the named days, and Dismiss.
- The programme proposal has "Start this programme", which opens F2 pre-filled with the template, TMs and options; the lifter still confirms there. TM values outside ±10 % of the current TM are shown struck through with the current TM used instead.
- Attention items have Dismiss and "Add note", which writes the text into a dated lifter note; nothing else.
- Every run is stored as an `AnalysisRun` record: date, provider, model, prompt kind, token counts, cost, the bundle hash, the raw report and which proposals were accepted. Runs are exportable and shareable (§14).

### 15.8 Cost and rate

Per full run with a 40k-token bundle and a 4k-token report, at list price, before prompt caching:

| Provider / model | Per run | Weekly runs, per month |
|---|---|---|
| share, gemini-free, claude-code | $0 | $0 |
| anthropic-api, `claude-opus-5` | about $0.30 | about $1.30 |
| anthropic-api, `claude-sonnet-5` | about $0.12 | about $0.50 |
| anthropic-api, `claude-haiku-4-5` | about $0.06 | about $0.25 |

- Prompt caching of the system prompt and template text lowers repeat runs on provider 4. The consent screen shows the estimate each time.
- No automatic or scheduled runs. The Analyse button is disabled while a run is in progress.
- Provider 2 daily caps are enforced by Google; the app shows the API's rate-limit error as "try again tomorrow" and stores nothing.

### 15.9 Acceptance criteria

- On a fresh install the `share` provider is selected and Analyse works with no key: it opens the share sheet with one file, and "Paste report" with a valid JSON reply on the clipboard renders all four sections. Pasting invalid JSON shows the validation error and stores nothing.
- With a Gemini free-tier key, Analyse shows the consent screen with the health-data box disabled and explained, then produces a report that validates against the schema.
- Running the repo's Claude Code command on an exported bundle writes a `report.json` that the app imports and renders identically to a live run.
- With an Anthropic key and provider 4, the consent screen shows token count and cost for the selected model, then produces a report that validates against the schema and renders all four sections.
- A report whose `programProposal.tmProposal` exceeds ±10 % for a lift shows that value struck through and the current TM in its place; accepting starts F2 with the current TM.
- No `attention` item ever renders text containing a term from the diagnosis filter list; a run whose report contains one shows the item as "withheld" with the reason. This holds for all four providers.
- Unticking "include health data" produces a bundle with no vitals section; the consent screen reflects the reduced token count.
- Nothing in TMs, programs, settings or the exercise catalogue changes without an explicit Accept.

---

## 16. Repository safety (public repo)

The repository at `github.com/ArvydasM1/Powerlifting-Programming` is public. Anything committed is visible to everyone, and GitHub history is effectively permanent even after a force-push. These rules apply to every commit, branch and pull request.

### 16.1 What may never be committed

| Category | Examples | Where it lives instead |
|---|---|---|
| Secrets | Anthropic and Gemini API keys, any `.env`, OAuth client secrets, tokens in curl scripts or test fixtures | The app's secure storage on the phone (§15.2); developer keys in the OS keychain or an untracked `.env.local` |
| Android signing | `*.jks`, `*.keystore`, `key.properties`, `keystore.properties`, `signing.gradle` with passwords, `google-services.json`, `local.properties` | Outside the repo; the CI signing key, if ever used, as a GitHub Actions secret |
| Training and health data | JSON backups and exports (F9), CSV exports, analysis bundles and reports (§15), `SessionVitals`, anything under `exports/`, `backups/`, `analysis/out/` | The phone, and a private backup location of the lifter's choosing |
| The source workbook | `531 Forever.xlsx` and any other spreadsheet with personal numbers | Local only; the templates derived from it are what is committed |
| Device and debug output | `adb logcat` dumps, Health Connect debug JSON, Capacitor `android/app/build/`, crash logs | Ignored build directories |
| Identity | Phone numbers, home address, medical details, other people's data | Nowhere in the repo |

Personal training numbers (TMs, PRs) are lower risk than the rest but are still personal. The spec keeps a handful as worked examples in Appendix C and in acceptance tests; that is an accepted exception and must not grow into full history.

### 16.2 What is committed

- Source code, template JSON, the report and bundle schemas, the diagnosis filter list, unit tests with **synthetic** fixtures.
- Fixtures for vitals, notes and analysis reports are generated, never captured from a real session. A fixture generator in `test/fixtures/` produces them deterministically from a seed.
- The privacy-policy page required by Health Connect (§12.2). It is public by nature.
- This spec and other documentation.

### 16.3 Enforcement

- `.gitignore` at the repo root lists every pattern from §16.1. It is committed first, before any source.
- A pre-commit hook runs `gitleaks protect --staged` and blocks the commit on any finding; the hook is installed by the repo's setup script and documented in the README. Developers may not bypass it with `--no-verify` for a finding they have not read.
- GitHub secret scanning and push protection are switched on for the repository (free for public repos). A blocked push is fixed by removing the secret, not by allow-listing it.
- CI runs `gitleaks detect` over the full history on every push and fails the build on a finding.
- The app's export code writes only to the platform's app-private or Downloads directory, never into the project tree, so a developer running the app on a workstation cannot accidentally drop a backup next to the source.
- The Claude Code analysis command (§15.2, provider 3) reads its bundle from and writes its report to a path outside the repo by default, and refuses paths inside the repo unless they are git-ignored.

### 16.4 If something leaks anyway

1. Revoke or rotate the secret first (API key in the vendor console, new signing key), before touching git.
2. Remove it from history with `git filter-repo`, force-push, and ask GitHub support to clear cached views; treat the value as compromised regardless.
3. For training or health data, removal from history is still done, but assume copies exist.
4. Record the incident and the fix in the repo's `SECURITY.md`.

### 16.5 Acceptance criteria

- A fresh clone plus the setup script installs the pre-commit hook; staging a file containing `sk-ant-` or `AIza` followed by key-shaped text blocks the commit with the gitleaks finding.
- `git ls-files` never lists a file matching `*.xlsx`, `*.jks`, `*.keystore`, `*.env*`, `backup*.json`, or anything under `exports/`, `backups/` or `analysis/out/`.
- Every test fixture under `test/fixtures/` that contains vitals or notes is produced by the generator and carries a `"synthetic": true` marker.
- CI fails when a commit contains a string matching the gitleaks default rules.

---

## Appendix A — Template catalogue (workbook layout, book TM progression)

Notation: `65/75/85×5` = three sets at 65 %, 75 %, 85 % of TM for 5 reps. `FSL 5×5` = 5 sets of 5 at the first main-set weight. `SSL` = second-set weight. `+k` = tmOffset. Week A/B/C waves = `65/75/85`, `70/80/90`, `75/85/95` (5s PRO).

### A1. Krypteia (book layout; 15 weeks + optional 7th weeks)

Seeded from the book structure, not the workbook sheet. The workbook's Krypteia sheet is used only to confirm the 5s PRO percentages and the superset idea.

| Part | Weeks | Days/week | Lifts per week | Main lift | Supplemental | tmOffset |
|---|---|---|---|---|---|---|
| Part 1, cycle 1 | 1–3 | 4 | Press, Squat, Bench, Deadlift | 5s PRO (A/B/C waves) | FSL 5×5 | 0 |
| Part 1, cycle 2 | 4–6 | 4 | Press, Squat, Bench, Deadlift | 5s PRO | FSL 5×5 | **0** |
| Part 2, cycle 1 | 7–9 | 3 | Squat, Bench, Deadlift | 5s PRO | FSL 5×10 | 0 |
| Part 2, cycle 2 | 10–12 | 3 | Squat, Bench, Deadlift | 5s PRO | FSL 5×10 | 1 |
| 7th Week Deload (optional) | 13 | | all four lifts | §A8 | | 1 |
| Part 3 (anchor) | 14–16 | 3 | Squat, Bench, Deadlift | 5/3/1 with PR sets: wk1 `65×5, 75×5, 85×5+`; wk2 `70×3, 80×3, 90×3+`; wk3 `75×5, 85×3, 95×1+` | FSL 5×5 | 2 |
| 7th Week TM Test (optional) | 17 | | all four lifts | §A8 | | 3 (the proposed next TM) |

- The Press is trained only in Part 1. Its TM still follows the offsets so the TM test and the next program start from the right number.
- Assistance (optional, §6.9) is supersetted between **every** set, warm-ups and supplemental included, alternating two exercises: Press and Bench days — DB squat / DB straight-leg deadlift; Squat and Deadlift days — weighted dips / weighted pull-ups (or chin-ups). Deadlift sessions add barbell shrugs after each deadlift set. Every session finishes with face pulls, 100–200 total reps. Target per assistance exercise per session: about 40–60 reps (Boostcamp lists 40), starting light and adding weight each week.
- Book guidance: start Part 1 at a TM of 85 %; aim to finish each session in under 45 minutes.
- The workbook's own Krypteia variant (4 days throughout, 5×5 FSL throughout, DB Row / DB Incline Press / DB Goblet Squat / DB SLDL supersets, offsets +0/+1/+2/+3) is **not** seeded. Its last-used assistance weights were DB Row 25, DB Goblet Squat 25, DB Incline Press 20→40, DB SLDL 40; keep them in the exercise catalogue as last weights.

### A2. Five and Dime (3 sessions/week, 2 lifts per session)
Each session = one lift "Dime" (three-set wave, top set `10+`) + one lift "Five" (5×5 at a fixed %). Leader 1 (+0), Leader 2 (+1), Deload, Anchor (+2), TM test. Matches the Boostcamp week-1 layout (Squat 5×5@85 + Bench 65/75/85×(5,5,10); Deadlift dime + Press 5×5@85; Squat dime + Bench 5×5@85).

| Week | Session 1 | Session 2 | Session 3 |
|---|---|---|---|
| 1 | Squat 5×5@85 · Bench 65/75/85×(5,5,10+) | Deadlift 65/75/85×(5,5,10+) · Press 5×5@85 | Squat 65/75/85×(5,5,10+) · Bench 5×5@85 |
| 2 | Deadlift 5×5@85 · Press 70/80/90×(5,5,10+) | Squat 5×5@90 · Bench 70/80/90×(5,5,10+) | Deadlift 70/80/90×(5,5,10+) · Press 5×5@90 |
| 3 | Squat 70/80/90×(5,5,10+) · Bench 5×5@90 | Deadlift 5×5@90 · Press 70/80/90×(5,5,10+) | Squat 5×5@95 · Bench 75/85/95×(5,5,10+) |
| 4 | Deadlift 70/80/90×(5,5,10+) · Press 5×5@95 | Squat 75/85/95×(5,5,10+) · Bench 5×5@95 | Deadlift 5×5@95 · Press 75/85/95×(5,5,10+) |

Anchor uses the same layout but every "Five" block is 5×5@85.

### A3. Coffinworm (4 sessions/week; Leaders 3 weeks ×2, Anchor 3 weeks)
- Each session: main lift + optional secondary lift ("Bench?" etc.) 5×5@70. Order: Squat(+Bench?), Press(+Deadlift?), Bench(+Squat?), Deadlift(+Press?). Matches Boostcamp.
- Leader weeks 1–2 main: `70×5, 80×5, 90×5, 80×5, 90×3-5, 100×1-3`. Week 3 (semi-deload): `65×5, 75×5, 85×5, 85×5, 85×5, 85×3-5`.
- Anchor weeks 1–2: `70×5, 80×5, 90×5, 80×5, 90×3-5, 100×PR`, then optional Jokers. Week 3: `65×5, 75×5, 85×PR`.
- Offsets: Leader 1 +0, Leader 2 +1, Anchor +2 (workbook had none).

### A4. FBBBB — Full Body Boring But Big (4 blocks/week; Leaders 3 weeks ×2, Anchor 3 weeks)
- Leader block layout: (Deadlift 5s PRO + Bench 5×10@50), (Squat 5×10@50 + Press 5s PRO), (Squat 5s PRO + Press 5×10@50), (Deadlift 5×10@50 + Bench 5s PRO). Weeks use A/B/C waves. Book/KeyLifts version is 3 days with every day = main lift 5s PRO + BBB 5×10@50; the workbook's 4-block split is kept.
- Anchor: (Squat 5s PRO + Bench 5s PRO), (Deadlift 5s PRO + Press 5s PRO), then (Squat FSL 5×5 + Bench FSL 5×5), (Deadlift FSL 5×5 + Press FSL 5×5).
- Offsets: Leader 1 +0, Leader 2 +1, Anchor +2 (workbook had none).

### A5. Leviathan (3 sessions/week, lifts rotate; Leaders 4 weeks ×2, Anchor 3 weeks)
- Main scheme every session: `70×3, 80×3, 90×3, 100×1` (work up to a TM single; matches Boostcamp/T-Nation).
- Supplemental per lift: Press 5×5 @ 80 % (SSL), Squat 1×20 @ 70 % (widowmaker), Bench 5×10 @ 70 %, Deadlift 10×5 @ 70 %.
- Leader week rotation: wk1 Press/Deadlift/Bench, wk2 Squat/Press/Deadlift, wk3 Bench/Squat/Press, wk4 Deadlift/Bench/Squat.
- Anchor: 4 lifts per week, main `70×3, 80×3, 90×3, 100×1` then one PR set `1+` at 85 % (wk1), 90 % (wk2), 95 % (wk3); no supplemental (T-Nation consensus).
- Offsets: Leader 1 +0, Leader 2 +1, Anchor +2.

### A6. God is a Beast (4 lift blocks/week; Leaders 6 weeks ×2, Anchor 3 weeks)
- Leader odd weeks: two 5-rep waves per lift — wk1 `70/80/90, 75/85/95 ×5`; wk3 `65/75/85, 70/80/90 ×5`; wk5 `70/80/90, 80/90/100×1-3`.
- Leader even weeks: volume — 9×5 at 65 % (wk2), 70 % (wk4), 75 % (wk6). Boostcamp shows **10×5**; the workbook has 9 rows (Appendix B). Seed 10×5.
- Within a week each lift alternates: two lifts do the wave while the other two do the volume sets, then swap.
- Anchor (+2), 3 weeks, two halves per week. First half: Squat and Press do a 3-rep double wave (wk1 `70/80/90+, 75/85/95+ ×3`; wk2 `65/75/85, 70/80/90+ ×3`; wk3 `70/80/90+, 80/90/100×1-3+`) while Bench and Deadlift do 5×5 (65 % wk1, 70 % wk2, 75 % wk3). Second half swaps.
- Offsets: Leader 1 +0, Leader 2 +1 (after the full 6 weeks), Anchor +2.

### A7. Pervertor (3 sessions/week, lifts rotate; Leaders 4 weeks ×2, Anchor 4 weeks)
- Main wave decides the supplemental: A-wave `65/75/85×5` → BBS 10×5 @ FSL; B-wave `70/80/90×5` → BBB 5×10 @ FSL; C-wave `75/85/95×5` → 5×5 @ SSL. This matches the book description (BBS at FSL, BBB at FSL, 5×5 SSL). The workbook uses FSL for the C-wave 5×5; **seed SSL** per the book.
- Week rotation (each lift walks A→B→C, staggered): wk1 Squat A / Bench A / Deadlift A; wk2 Press A / Squat B / Bench B; wk3 Deadlift B / Press B / Squat C; wk4 Bench C / Deadlift C / Press C.
- Anchor (+2), 4 weeks: each lift alternates a **heavy** session `85×3, 75×5, 95×1, 100×1, 105×1` (optional Jokers above) followed by either a 1×20 widowmaker (Squat @ 85 %, others @ 75 %) or 5×5 @ 75–85 %, and a **light** session `65/75/85×5` + SSL 5×5.
- Offsets: Leader 1 +0, Leader 2 +1, Anchor +2.

### A8. 7th Week protocols
- Deload: `70×5, 80×3-5, 90×1, 100×1` per lift.
- TM Test: `40×5, 50×5, 70×5, 80×5, 90×5, 100×5` per lift.

---

## Appendix B — Anomalies found in the workbook

The app follows §6.2 and Appendix A; these are recorded so the regression fixtures can exclude them.

| Sheet / cell | Issue |
|---|---|
| `Krypteia` (whole sheet) | Deviates from the book: 4 days and 5×5 FSL in every part, Press kept in Parts 2–3, custom DB supersets, offsets +0/+1/+2/+3 then base TM from Week 12, and "7th Week" blocks that are copies of Week 1. Superseded by the book layout in A1; not used as a fixture. |
| `FBBBB` Leader 2 and Anchor | No TM increase in any formula. |
| `Coffinworm` Leader 2 and Anchor | No TM increase in any formula. |
| `God is a Beast` volume weeks | 9 sets of 5; template is 10 sets of 5. |
| `Pervertor` C-wave supplemental | 5×5 at FSL; book says SSL. |
| `Pervertor!Q62` | `TRMDeadlift*0.85++IncreaseDeadlift` (double plus; evaluates correctly by luck). |
| `Pervertor!Q71:Q73` | Press sets add `IncreaseBench` instead of `IncreasePress`. |
| Rep cells `C8`, `C21`, `M29` etc. in `Coffinworm`, `7th Week Deload!C3`, `God is a Beast!W9` | Rep ranges auto-converted to dates (`3-5` → 2024-03-05, `1-3` → 2024-01-03). |
| `Parameters!E18` | `SUM(A18,B18,D18)` on an empty 1RM row; Press not included. |
| `Assistance!E9`, `E63` | Stray numbers (2, 1) with no header. |

---

## Appendix C — Seed data to import

**Parameters:** TM Squat 145, Bench 95, Press 57.5, Deadlift 162.5; rounding 2.5; increases 2.5 / 2.5 / 2.5 / 5.

**Progress (PR history, ordinal order):**

| Lift | Weight × Reps |
|---|---|
| Squat | 180×1, 130×5, 122.5×7, 135×5, 145×1, 135×3, 135×4, 150×1, 142.5×3, 142.5×5 |
| Deadlift | 180×2, 160×5, 160×6, 130×10 |
| Bench | 107.5×5, 85×5, 82.5×8, 90×6, 100×3, 95×1, 92.5×5 |
| Press | 67.5×5, 52.5×5, 55×5, 57.5×5, 55×4, 60×3, 55×4, 47.5×8 |

**Assistance day blocks (5×10 each, optional):** Squat day — Dips (BW), DB Curls 24, Ab Wheel. Bench day — Triceps Ext 17.5, Pull-ups (BW), SLDL 20. Deadlift day — DB Press 44→48, Upright Rows 40, Lunges 35. Press day — Push-ups, Shrugs 77.5, Hanging Leg Raises.

---

## Appendix D — Research sources

Sharing and AI analysis (§14, §15):

- https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share (Web Share API with files)
- https://github.com/anthropics/anthropic-sdk-typescript (browser use via `dangerouslyAllowBrowser`, `messages.parse`, `zodOutputFormat`)
- https://support.anthropic.com/en/articles/9767949-api-key-best-practices-keeping-your-keys-safe-and-secure
- https://ai.google.dev/gemini-api/docs/rate-limits (Gemini free tier caps)
- https://pecollective.com/tools/gemini-free-tier-guide/ (free tier scope: Flash only, data-use caveat)
- https://winbuzzer.com/2026/02/19/anthropic-bans-claude-subscription-oauth-in-third-party-apps-xcxwbn/ (subscription OAuth not usable in third-party apps)
- https://claudefa.st/blog/guide/development/claude-code-subscription (official Claude Code CLI on your own machine is ordinary subscription use)

Health Connect (Phase 2, §12), devices and Bluetooth (§12.9, §13):

- https://developer.android.com/health-and-fitness/health-connect/data-types
- https://developer.android.com/health-and-fitness/health-connect/read-data
- https://www.androidauthority.com/health-connect-historical-background-reads-3443726/
- https://support.google.com/googlehealth/answer/14506680 (Google Health app and Health Connect)
- https://support.google.com/googlehealth/answer/14236705 (share real-time heart rate)
- https://support.google.com/googlehealth/answer/17033101 (Fitbit Air)
- https://zonepoints.app/articles/fitbit-air-live-heart-rate/ (Fitbit Air uses standard GATT 0x180D)
- https://sahha.ai/integrations/ohealth/ (OHealth writes steps, heart rate, sleep to Health Connect)
- https://developer.chrome.com/docs/capabilities/bluetooth (Web Bluetooth, PWA fallback only)
- https://capacitorjs.com/docs/android (Capacitor Android)
- https://capacitorjs.com/docs/plugins/creating-plugins (in-house plugins)
- https://developer.android.com/develop/connectivity/bluetooth/ble/connect-gatt-server (native BLE GATT)
- https://developer.android.com/develop/background-work/services/foreground-services (foreground services)
- https://developer.android.com/develop/background-work/services/alarms/schedule (exact alarms for the rest alert)
- https://developer.android.com/health-and-fitness/health-connect/get-started
- https://developer.android.com/reference/androidx/health/connect/client/records/ExerciseSessionRecord
- https://capawesome.io/docs/sdks/capacitor/health/
- https://github.com/Cap-go/capacitor-health
- https://github.com/Flomentum-Solutions/capacitor-health-extended

General rules (leader/anchor, +5 lb upper / +10 lb lower per cycle, 7th week options, 3–5 reps at TM = pass):

- https://liftvault.com/resources/531-glossary/
- https://liftvault.com/resources/leader-anchor-cycles/
- https://www.liftproof.app/programs/531-forever/
- https://t-nation.com/t/increasing-tm-after-anchor-deload/235856
- https://t-nation.com/t/training-max-test-7th-week-protocol/272846
- https://t-nation.com/t/531-forever-why-do-a-test-week/268265

Per template:

- Krypteia: https://liftvault.com/resources/krypteia/ · https://www.boostcamp.app/users/FvgG8F-531-krypteia-part-1 · https://www.boostcamp.app/users/xDnLp9-531-krypteia-part-1 · https://www.boostcamp.app/users/moH9Oq-531-krypteia-part-2 · https://www.boostcamp.app/users/pI6mZ5-531-anchor-5s-pro-jokers-and-fsl-1 (Part 3) · https://www.jimwendler.com/blogs/jimwendler-com/krypteia-review
- Five and Dime: https://www.boostcamp.app/users/X3ayEh-531-five-and-dime
- Coffinworm: https://www.boostcamp.app/users/9jIxrJ-531-coffinworm · https://www.boostcamp.app/users/bkbs4l-531-coffinworm-1
- Full Body BBB: https://keylifts.com/templates/531/full-body-boring-but-big-3-day
- Leviathan: https://www.boostcamp.app/users/FnBVlT-531-leviathan · https://t-nation.com/t/leviathan-anchor/246076 · https://t-nation.com/t/5-3-1-leviathan-adjustments/236771
- God is a Beast: https://www.boostcamp.app/users/ptzQdN-531-god-is-a-beast · https://www.boostcamp.app/users/3UfMYW-wendler-531-god-is-a-beast-leader · https://t-nation.com/t/god-is-a-beast-template-review/275113
- Pervertor: https://www.boostcamp.app/users/KoxUs0-531-pervertor · https://forum.priceplow.com/t/daslayas-5-3-1-pervertor/4951

Full week-by-week detail for most templates sits behind app paywalls or in the book, so Appendix A uses the workbook's layout as the primary source and the sites above to confirm structure and TM progression.
