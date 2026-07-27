---
name: migrate-v2
description: Autonomously migrate a DevRev AirSync connector from SDK v1 (@devrev/ts-adaas, 1.x) to v2 (@devrev/airsync-sdk, 2.x). First brings the connector to a clean latest-stable v1 baseline, installs the latest v2 beta, then locates the SDK's MIGRATION.md (the single, complete spec of every breaking change) and executes it end-to-end — package rename, emit()→return TaskResult, adapter split, state changes, axios removal, jest-mock rewrites — then verifies with tsc/lint/build/tests. Use whenever the user asks to "migrate to v2", "migrate to airsync-sdk", "upgrade connector to airsync sdk", "migrate ts-adaas to airsync-sdk", or do a "v1 to v2 migration".
---

# Migrate connector to AirSync SDK v2

This skill runs **from a connector repo**. The migration itself is fully
specified in the SDK's `MIGRATION.md` — a self-contained, ordered guide
covering all 16 breaking-change categories with before/after examples, an
execution plan, and a final checklist. Your job: get the connector onto a
known-good starting point, install the newest v2, then locate that document,
read it **in full**, and execute it against this connector.

## 1. Locate the connector root

Find the directory whose `package.json` depends on `@devrev/ts-adaas` —
usually `code/`, sometimes the repo root. If it already depends on
`@devrev/airsync-sdk`, report "already on v2" and stop. Note whether lint
covers tests and what `npm test` runs — you must migrate whatever the gates
check.

## 2. Establish a clean latest-stable v1 baseline first

`MIGRATION.md` describes the delta from the **latest stable v1**
(`@devrev/ts-adaas`). If the connector is on an older 1.x that skipped an
intra-v1 migration, jumping straight to v2 conflates that skipped work with the
v2 work and MIGRATION.md's before/after examples won't match the code. So
normalize the starting point first:

1. Read the installed `@devrev/ts-adaas` version (package.json + lockfile).
2. Consult the releases page — **https://github.com/devrev/adaas-sdk/releases**
   — for (a) the current latest stable 1.x and (b) any release **between** the
   connector's version and that latest whose notes mention a migration /
   breaking change / manual upgrade step.
   - Recent history for reference (verify against the page, don't trust this
     list to stay current): **1.19.0 → 1.20.0** were migration-free maintenance
     releases; the last v1 releases needing migration were **1.18.0** (automatic
     `reports`/`processed_files`), **1.17.0** (external sync units via repos),
     and **1.16.0** (timeout-return model). So **≥ 1.19.0 with no pending notes**
     is a safe baseline.
3. **Already on the latest stable 1.x (or a ≥ 1.19.x release with no pending
   migration notes):** proceed to step 3.
4. **Behind a release that required migration steps:** first
   `npm install @devrev/ts-adaas@latest`, apply that release's documented
   migration steps (from the releases page), and get the gates
   (`tsc`/`lint`/`build`/`test`) green **on v1** — as a separate, clearly-logged
   phase (§5) — *before* starting the v2 migration. Only migrate to v2 from a
   green latest-stable-v1 build.

## 3. Install the latest v2 beta and locate MIGRATION.md

**Always install the newest v2 beta** — never rely on a version already pinned
in the connector:

```bash
npm install @devrev/airsync-sdk@beta   # the `beta` dist-tag = newest published 2.x beta
```

Confirm you actually got the newest beta (`npm view @devrev/airsync-sdk
dist-tags`, or check the releases page). If the DevRev internal mirror lacks it,
retry with `--registry=https://registry.npmjs.org`. Once v2 GA is published,
use `@latest` instead of `@beta`. (This install can run alongside the still-
present `@devrev/ts-adaas`; MIGRATION.md §1 removes the old package as part of
execution.)

Then read `MIGRATION.md`, in order of preference:

1. **From the just-installed v2 package** (version-matched — preferred):
   `node_modules/@devrev/airsync-sdk/MIGRATION.md`.
2. **From GitHub** (only if the installed package predates MIGRATION.md
   shipping): `https://raw.githubusercontent.com/devrev/adaas-sdk/main/MIGRATION.md`,
   and if not there yet (v2 not merged), the `v2` branch:
   `https://raw.githubusercontent.com/devrev/adaas-sdk/v2/MIGRATION.md`.

Read the whole document before editing anything.

## 4. Execute it

Follow MIGRATION.md's **execution plan** and numbered sections in order; its
final **migration checklist** is your completion checklist. (Its §1 install step
is already satisfied by step 3 above — just complete the `@devrev/ts-adaas`
uninstall and specifier rewrite.) Rules of engagement:

- **Fully autonomous, best-effort.** Attempt every section — including the
  hard semantic ones. When a rewrite is ambiguous, pick the option that
  preserves existing runtime behavior with the smallest change, apply it, and
  log it (below). Do not prompt the user. A section with zero hits is a
  verified no-op — don't invent work.
- **Source and tests together.** Test files (fixtures, mocks, assertions) are
  first-class targets per MIGRATION.md §16, not an afterthought.
- **Preserve wire values.** This is a TypeScript-API migration only; never
  change a runtime string value.
- **No migration commentary in code.** Apply edits cleanly — never add a comment
  explaining what changed or how v2 differs from v1, and don't copy the
  `// v1` / `// v2` labels from MIGRATION.md's examples. Add a comment only where
  the resulting logic is genuinely complex and non-self-explanatory, exactly as
  you would in any normal code review.
- **Never leave a compile error.** Clean up every import/local a rewrite
  orphans — lint gates on it.

## 5. Verify

From the connector's package dir, run MIGRATION.md's final verification:
`npm install`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, and the
repo's test command if tests exist. Fix and re-run, up to 4 attempts. If a
check still fails after 4 attempts, record the exact remaining errors in
`MIGRATION_REVIEW.md` under "Unresolved" and report failure — `package.json`
stays on `@devrev/airsync-sdk`.

## 6. Write MIGRATION_REVIEW.md — only what needs a second look

`MIGRATION_REVIEW.md` at the repo root is a **review aid, not a changelog**. It
records only what was **not straightforward**: ambiguous rewrites, open
questions, and anything the developer should re-check. **Do not describe clean,
mechanical, or no-op sections** — a section that applied unambiguously needs no
prose.

Keep it to two parts:

1. **Per-section confidence line.** For each MIGRATION.md section that changed
   code, one line: the section name and a confidence level. **If confidence is
   `high`, that line is the whole entry — no explanation.** If it's `medium` or
   `low`, add a short note (one or two sentences) saying what was ambiguous and
   what to verify. Sections that were verified no-ops don't need a line at all
   (the Verification summary already reports coverage).
2. **Verification summary** at the end (always kept): the final
   tsc/lint/build/test result, and — under an **"Unresolved"** heading — the
   exact remaining errors for any check still failing after 4 attempts (§5).

Flag with a note (medium/low) the rewrites most likely to be wrong: emit→return
conversions bubbled out of helpers/class methods, the incremental-cursor
rename-vs-repoint decision (which branch fired and why), state-interface
changes, onTimeout rewrites, ESU repo rewrites, and any v1 baseline upgrade from
step 2. Straightforward ones just get their `high` line.

```markdown
# v2 Migration Review

Migrated `@devrev/ts-adaas` 1.x → `@devrev/airsync-sdk` 2.x.
Only sections needing a second look are noted; the rest applied cleanly.

## Sections
- §4 emit→return — high
- §8 state split / cursor — low: repointed `lastSuccessfulSyncStarted` to
  `event_context.extract_from`; confirm this connector isn't a rename case.

## Verification
tsc ✓ · lint ✓ · build ✓ · test ✓ (48 passed)
```

## 7. Report

Summarize: the starting `@devrev/ts-adaas` version and any v1 baseline upgrade
done, the installed v2 beta version, which MIGRATION.md sections fired vs were
verified no-ops, the final tsc/lint/build/test result, and the count of
`MIGRATION_REVIEW.md` entries.
