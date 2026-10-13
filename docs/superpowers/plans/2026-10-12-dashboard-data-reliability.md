# Dashboard Data Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every dashboard metric disclose its real data date and update time, record every automated sync, repair broken collectors, and keep large article histories out of initial page responses.

**Architecture:** Extend the existing PostgreSQL initialization and data-access module with freshness metadata and `sync_runs`, then wrap each collector in one tracked execution helper. Replace implicit historical fallbacks with explicit response metadata and split content summary, paged detail, and export APIs so the UI loads only what it displays.

**Tech Stack:** Next.js 16 App Router and Route Handlers, React 19, TypeScript 5, PostgreSQL via `pg`, Node test runner via `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-10-12-dashboard-data-reliability-design.md`

## Global Constraints

- Preserve every existing article, activity, contributor, social, website, download, and reminder record.
- Keep WeChat official account and WeChat Channels manual.
- Keep Juejin history read-only and exclude it from sync and stale reminders.
- Do not auto-classify article categories or sources in this phase.
- Production sample-data cleanup must be audit-first; no row is deleted by default.
- Target the homepage API at less than 100 KB and less than 2 seconds under normal production conditions.
- Follow Next.js 16 local documentation under `node_modules/next/dist/docs/` for all App Router APIs.

## Review Focus

- A requested date with no exact row must report `has_exact_data: false` and the real fallback date, never label a fallback as the requested date.
- A collector that throws after writing some rows must leave one failed `sync_runs` record with counts and a useful error.
- An invalid `page`, `pageSize`, date, or platform query must return `400` and never trigger an unbounded query.
- A Juejin row must remain queryable while Juejin is absent from stale reminders and scheduled sync status.
- The sample audit must remain read-only unless the explicit quarantine command and confirmation flag are both supplied.

---

### Task 1: Freshness And Sync Run Persistence

**Files:**
- Modify: `src/lib/db.ts`
- Create: `src/lib/sync-runs.ts`
- Test: `tests/sync-runs.test.ts`

**Interfaces:**
- Produces: `SyncRun`, `SyncPlatformStatus`, `startSyncRun(platform, trigger)`, `finishSyncRun(id, result)`, and `getLatestSyncStatus()`.
- Produces: `updated_at` on metric rows and `getDashboardUpdatedAt()`.

- [x] **Step 1: Write failing persistence tests** for allowed statuses/triggers, a success result, a partial failed result, and page-level maximum `updated_at`.
- [x] **Step 2: Run `npm test -- tests/sync-runs.test.ts`** and verify the new exports or table behavior fails.
- [x] **Step 3: Extend `initializeDb()`** with `updated_at` columns using `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, create `sync_runs`, and add platform/start indexes.
- [x] **Step 4: Implement `src/lib/sync-runs.ts`** so finalization always sets `finished_at`, counts, status, and a bounded error message.
- [x] **Step 5: Run `npm test -- tests/sync-runs.test.ts`** and verify all cases pass.
- [x] **Step 6: Commit** with `feat: track data freshness and sync runs`.

### Task 2: Tracked Collector Execution

**Files:**
- Create: `src/lib/tracked-sync.ts`
- Modify: `src/app/api/github/sync/route.ts`
- Modify: `src/app/api/csdn/sync/route.ts`
- Modify: `src/app/api/cnblogs/sync/route.ts`
- Modify: `src/app/api/itpub/sync/route.ts`
- Modify: `src/app/api/modb/sync/route.ts`
- Modify: `src/app/api/sf/sync/route.ts`
- Modify: `src/app/api/browser-content/sync/route.ts`
- Test: `tests/tracked-sync.test.ts`

**Interfaces:**
- Consumes: sync-run functions from Task 1.
- Produces: `runTrackedSync<T>(options, operation): Promise<T>` where the operation reports `recordsSeen` and `recordsWritten`.

- [x] **Step 1: Write failing unit tests** asserting success, thrown failure, partial counts, and trigger propagation for `vercel_cron`, `ego_lite`, and `manual`.
- [x] **Step 2: Run `npm test -- tests/tracked-sync.test.ts`** and verify failure because the wrapper does not exist.
- [x] **Step 3: Implement `runTrackedSync`** with a `try/catch/finally` lifecycle that never hides the original collector error.
- [x] **Step 4: Move each sync route through the wrapper** and return the run id and counts in successful JSON responses.
- [x] **Step 5: Run `npm test -- tests/tracked-sync.test.ts tests/sync.test.ts tests/browser-sync.test.ts`** and verify all pass.
- [x] **Step 6: Commit** with `feat: record all collector runs`.

### Task 3: Retired Platform And Seed Safeguards

**Files:**
- Modify: `src/lib/seed.ts`
- Modify: `src/app/api/reminders/route.ts`
- Modify: `src/app/admin/page.tsx`
- Create: `scripts/audit-sample-data.mjs`
- Create: `scripts/quarantine-sample-data.mjs`
- Test: `tests/data-safeguards.test.ts`

**Interfaces:**
- Produces: `isSampleSeedAllowed(env)` and `isReminderEligible(platform)` pure helpers.
- Produces: audit JSON grouped by table/platform/date and a transaction-only quarantine command requiring `--confirm`.

- [x] **Step 1: Write failing tests** proving production seed is denied without `ALLOW_SAMPLE_DATA=1`, Juejin is reminder-ineligible, and audit mode cannot issue delete statements.
- [x] **Step 2: Run `npm test -- tests/data-safeguards.test.ts`** and verify the safeguards are absent.
- [x] **Step 3: Guard `src/lib/seed.ts`** and remove Juejin from reminder candidates and admin stale-state presentation without deleting history.
- [x] **Step 4: Add audit and quarantine scripts** with per-table backups, one transaction, explicit `--confirm`, and rollback on any error.
- [x] **Step 5: Run the test plus `node scripts/audit-sample-data.mjs --help`** and verify read-only is the default.
- [x] **Step 6: Commit** with `fix: guard sample data and retire juejin sync`.

### Task 4: Repair ITPUB And Modb Collectors

**Files:**
- Modify: `src/lib/itpub-sync.ts`
- Modify: `src/lib/modb-sync.ts`
- Test: `tests/content-sync.test.ts`
- Create: `tests/fixtures/itpub-author-page.html`
- Create: `tests/fixtures/modb-author-state.html`

**Interfaces:**
- Produces: `parseItpubArticles(html)` and `parseModbAuthorState(html)` returning normalized article/profile records.
- Preserves: existing save/update interfaces used by sync routes.

- [x] **Step 1: Capture minimal sanitized fixtures** from the current public page structures and add failing parser tests for valid, empty, and malformed responses.
- [x] **Step 2: Run `npm test -- tests/content-sync.test.ts`** and verify the new cases fail.
- [x] **Step 3: Replace brittle extraction** with parsing of the current embedded state or public endpoint, keeping URL/title/date/count normalization in pure functions.
- [x] **Step 4: Add explicit empty-result errors** that identify which expected payload was missing.
- [x] **Step 5: Run `npm test -- tests/content-sync.test.ts`** and manually invoke both local parsers against fixtures.
- [x] **Step 6: Commit** with `fix: repair itpub and modb collectors`.

### Task 5: Explicit Data-Date API Contracts

**Files:**
- Modify: `src/lib/db.ts`
- Modify: `src/app/api/dashboard/route.ts`
- Modify: `src/app/api/social/route.ts`
- Modify: `src/app/api/website/route.ts`
- Test: `tests/date-range.test.ts`

**Interfaces:**
- Produces: `DataSlice<T> = { requested_date?: string; data_date: string | null; updated_at: string | null; has_exact_data: boolean; data: T }`.
- Produces: exact-date queries and explicit latest-available metadata without silent relabeling.

- [x] **Step 1: Write failing contract tests** for exact hits, historical fallback, empty database, mixed platform freshness, and malformed dates.
- [x] **Step 2: Run `npm test -- tests/date-range.test.ts`** and verify current silent fallback behavior fails the assertions.
- [x] **Step 3: Add bounded DB queries** that return each row's real `date` and `updated_at`.
- [x] **Step 4: Return the `DataSlice` contract** from dashboard, social, and website APIs; reject invalid date ranges with `400`.
- [x] **Step 5: Run `npm test -- tests/date-range.test.ts tests/db-connection.test.ts`** and verify all pass.
- [x] **Step 6: Commit** with `fix: expose real metric dates`.

### Task 6: Content Summary, Pagination, And Export

**Files:**
- Modify: `src/lib/db.ts`
- Modify: `src/app/api/content/route.ts`
- Create: `src/app/api/content/articles/route.ts`
- Create: `src/app/api/content/export/route.ts`
- Modify: `src/app/content/page.tsx`
- Test: `tests/articles.test.ts`

**Interfaces:**
- Produces: `GET /api/content` platform summaries only.
- Produces: `GET /api/content/articles?platform=&page=&pageSize=&search=&category=` with `{ items, page, pageSize, total }`.
- Produces: `GET /api/content/export` as CSV without loading the browser page state.

- [x] **Step 1: Write failing query tests** for page boundaries, maximum `pageSize=100`, escaped search, category filter, unknown platform, and stable date/id ordering.
- [x] **Step 2: Run `npm test -- tests/articles.test.ts`** and verify pagination contracts fail.
- [x] **Step 3: Add summary/count/paged DB methods** using parameterized SQL and one count query per request.
- [x] **Step 4: Split the route handlers** and reject invalid parameters with `400`.
- [x] **Step 5: Update the content page** to fetch summaries initially and fetch article pages only when a platform is opened or filters change.
- [x] **Step 6: Run `npm test -- tests/articles.test.ts` and `npm run build`** and verify the page no longer requests all article rows on first load.
- [x] **Step 7: Commit** with `perf: paginate content metrics`.

### Task 7: Freshness And Sync Status UI

**Files:**
- Modify: `src/components/LastUpdated.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/social/page.tsx`
- Modify: `src/app/website/page.tsx`
- Modify: `src/app/content/page.tsx`
- Create: `src/app/api/sync-status/route.ts`
- Create: `src/components/admin/SyncStatusPanel.tsx`
- Modify: `src/app/admin/page.tsx`
- Test: `tests/sync-status.test.ts`

**Interfaces:**
- Consumes: `DataSlice` from Task 5 and `SyncPlatformStatus` from Task 1.
- Produces: `<LastUpdated value={string | null} />` and an admin-only status panel with retry actions.

- [x] **Step 1: Write failing source/contract tests** for database-derived time, visible fallback labels, failed-run details, and admin-only retry controls.
- [x] **Step 2: Run `npm test -- tests/sync-status.test.ts`** and verify current UI behavior fails.
- [x] **Step 3: Make `LastUpdated` a pure formatter** and pass API freshness values from each page.
- [x] **Step 4: Add platform-level stale/fallback labels** without changing the selected date label.
- [x] **Step 5: Add `/api/sync-status` and the admin panel** using existing authentication and collector routes.
- [x] **Step 6: Run `npm test -- tests/sync-status.test.ts tests/auth.test.ts` and `npm run build`**.
- [x] **Step 7: Commit** with `feat: show data freshness and sync status`.

### Task 8: Documentation And Production Verification

**Files:**
- Modify: `README.md`
- Modify: `vercel.json`
- Test: all tests and production probes

**Interfaces:**
- Consumes: all prior tasks.
- Produces: accurate operator documentation and final cron configuration.

- [x] **Step 1: Update README** for PostgreSQL, real automation coverage, contribution dates, retired Juejin, manual channels, and sample-data safeguards.
- [x] **Step 2: Verify cron schedules** include only supported collectors and use the tracked sync entry points.
- [x] **Step 3: Run `npm test`, `npm run lint`, and `npm run build`** and resolve only failures caused by this work.
- [x] **Step 4: Start the app and measure** dashboard payload, content summary payload, exact-date fallback output, and sync-status authorization.
- [x] **Step 5: Commit** with `docs: document dashboard data operations`.

