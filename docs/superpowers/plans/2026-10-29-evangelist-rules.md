# Evangelist Rules Update

**Goal:** Apply the approved 2026-10-29 workbook to the existing editor and migrate historical classifications without recalculating scores.

**Spec:** User-approved workbook `布道者积分获取方式_优化确认稿_2026-10-29.xlsx` and the approval in this chat.

**Architecture:** Shared typed rules drive editor options, score suggestions, limits and API validation. Serialize contribution writes on the participant row. Historical rows retain a legacy rule version and their approved points; article groups associate official/personal publishing without relying on publication URLs being identical.

## Constraints
- Do not modify `scripts/import-reading-stats.mjs` or unrelated data.
- New rules: 23 types, article group max 45, promotion sublimits 30/30/21/30 and combined 60 per calendar year, technical answers 10 each/max 100 per year, HOW gift once.
- Preserve historical points, dates, titles, links, notes, participant totals and rankings. Keep retired reprint records as legacy types rather than guessing a new qualification.
- New rows use current rules; unchanged historical scores may be edited without being capped retroactively.

## Tasks
- [x] Add failing tests for rules, legacy mappings, yearly/group caps and historical preservation.
- [x] Implement shared rules and atomic server validation; add legacy/group metadata with backward-compatible defaults.
- [x] Update the existing drawer, automatic score suggestions, rule details, grouping controls and warnings; keep existing member/avatar workflows.
- [x] Preview, back up and transactionally migrate live categories/types; verify every row and participant total.
- [x] Run targeted/full tests, lint/build and browser QA. Report local vs deployed status separately.

## Verification (2026-10-30)
- Full suite: 420 passing; production build and ESLint passed. Rebuilt and linted again after conditional required-field labels were aligned with validation.
- Live migration: 183 contribution classifications mapped; all original scores, dates, titles, URLs, notes and 35 member totals preserved and verified in the migration transaction. A private backup was saved before changes.
- Browser QA: desktop contribution history alongside the editor; technical answer suggestion 10 and annual cap 100; promotion subtype cap 30 and combined cap 60; over-limit warning; historical video score remains 15 although new standard is 20; 390px editor fits and history tab works. No trial contributions were saved to the live database.
- Preview runs at http://localhost:3032/admin; the database classification migration is already applied. Git push and production deployment status are reported separately in the release response.

## Review Focus
- Old self-publishing 15/video 15 scores remain unchanged after type renaming.
- Article links differ between official and personal channels; grouping must be explicit and cannot cross participants.
- Concurrent writes must not bypass caps. Edited rows must be excluded from projected totals.
- Legacy promotion totals above 60 remain intact, but do not grant more new promotion points.
- Unknown/retired historical types and missing historical dates must not be silently reclassified or re-dated.
