# Event Material Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the activity list into a searchable archive where every activity can open a detail page containing its cloud-drive material links, extraction code, notes, and official source.

**Architecture:** Store activity materials as normalized PostgreSQL rows linked to existing activities, while leaving files in the user's cloud drive. Add paged list and detail APIs, a Next.js 16 dynamic detail route, and an admin editor; an idempotent official-site collector may add public source material without overwriting manually entered cloud-drive links or attendance figures.

**Tech Stack:** Next.js 16 App Router and Route Handlers, React 19, TypeScript 5, PostgreSQL via `pg`, Node test runner via `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-10-12-event-material-library-design.md`

## Global Constraints

- Preserve all existing activity records and attendance values.
- Store cloud-drive URLs, extraction codes, and notes only; do not upload binary files in this phase.
- Keep manually entered materials authoritative and never overwrite them during official-site sync.
- Ordinary viewers must not see create, edit, delete, or sync controls.
- Deduplicate activities by official source URL and materials by event plus URL.
- Follow Next.js 16 local documentation: dynamic `params` are promises and runtime dynamic pages require the documented Suspense/runtime handling.

## Review Focus

- A cloud-drive URL with an extraction code but no thumbnail must remain useful and open in a new tab.
- Two materials may share a title, but the same non-empty URL for one event must not be inserted twice.
- Deleting an activity must cascade to its materials; deleting one material must never delete its activity.
- Official sync must preserve manual materials, participant counts, registrations, online viewers, and manual descriptions.
- Invalid event ids, missing events, invalid material types, and unsafe URL schemes must return deterministic `400` or `404` responses.

---

### Task 1: Activity Material Data Model

**Files:**
- Modify: `src/lib/db.ts`
- Create: `src/lib/activity-materials.ts`
- Test: `tests/event-materials.test.ts`

**Interfaces:**
- Produces: `ActivityMaterialType`, `ActivityMaterial`, `ActivityMaterialInput`, `listActivityMaterials(eventId)`, `saveActivityMaterial(input)`, `updateActivityMaterial(id, input)`, and `deleteActivityMaterial(id)`.
- Produces: `validateMaterialInput(input)` accepting `https:` URLs only and types `photo|poster|ppt|video|article|other`.

- [ ] **Step 1: Write failing tests** for all material types, cloud-drive link plus extraction-code note, duplicate event URL, invalid schemes, and cascade behavior.
- [ ] **Step 2: Run `npm test -- tests/event-materials.test.ts`** and verify missing schema/helpers fail.
- [ ] **Step 3: Create `activity_materials`** in `initializeDb()` with a foreign key using `ON DELETE CASCADE`, timestamps, sort index, and a partial unique event/url index.
- [ ] **Step 4: Implement types, validation, and CRUD helpers** with parameterized queries and stable `sort_order, id` ordering.
- [ ] **Step 5: Run `npm test -- tests/event-materials.test.ts`** and verify all pass.
- [ ] **Step 6: Commit** with `feat: add activity material records`.

### Task 2: Paged Event And Detail APIs

**Files:**
- Modify: `src/lib/db.ts`
- Modify: `src/app/api/events/route.ts`
- Create: `src/app/api/events/[id]/route.ts`
- Create: `src/app/api/events/[id]/materials/route.ts`
- Create: `src/app/api/events/[id]/materials/[materialId]/route.ts`
- Test: `tests/events.test.ts`

**Interfaces:**
- Produces: `GET /api/events?page=&pageSize=&year=&type=&search=` with `{ items, total, page, pageSize, facets, totals }`.
- Produces: `GET /api/events/[id]` with `{ event, materials, material_counts }`.
- Produces: admin-only material `POST`, `PUT`, and `DELETE` endpoints.

- [ ] **Step 1: Write failing route-helper tests** for filter combinations, page bounds, stable ordering, a missing event, invalid ids, invalid material input, and duplicate URLs.
- [ ] **Step 2: Run `npm test -- tests/events.test.ts`** and verify current all-rows API fails the contract.
- [ ] **Step 3: Add paged event/count/facet DB methods** and material-count aggregation without changing existing create/update/delete behavior.
- [ ] **Step 4: Implement the list, detail, and material handlers** using awaited Next.js 16 route params and shared validation.
- [ ] **Step 5: Extend `src/proxy.ts` mutation protection** to nested event material routes and test viewer denial.
- [ ] **Step 6: Run `npm test -- tests/events.test.ts tests/auth.test.ts`** and verify all pass.
- [ ] **Step 7: Commit** with `feat: add event archive APIs`.

### Task 3: Searchable Activity List

**Files:**
- Modify: `src/app/events/page.tsx`
- Create: `src/components/events/EventCard.tsx`
- Create: `src/components/events/EventFilters.tsx`
- Test: `tests/events-ui.test.ts`

**Interfaces:**
- Consumes: paged list contract from Task 2.
- Produces: filters for year/type/search, fixed page size, pagination controls, and card links to `/events/[id]`.

- [ ] **Step 1: Write failing source tests** for filter query parameters, pagination, material count labels, detail links, and hidden mutation controls for viewers.
- [ ] **Step 2: Run `npm test -- tests/events-ui.test.ts`** and verify current render-all page fails.
- [ ] **Step 3: Split focused list components** and fetch only the selected page, resetting to page 1 when a filter changes.
- [ ] **Step 4: Keep aggregate statistics from the API totals** so pagination does not change total activity/attendance cards.
- [ ] **Step 5: Use `useAuth()`** so edit/delete/new controls render only for `accessLevel === 'admin'`.
- [ ] **Step 6: Run `npm test -- tests/events-ui.test.ts` and `npm run build`**.
- [ ] **Step 7: Commit** with `feat: add searchable event archive`.

### Task 4: Activity Detail Page

**Files:**
- Create: `src/app/events/[id]/page.tsx`
- Create: `src/app/events/[id]/loading.tsx`
- Create: `src/components/events/MaterialSection.tsx`
- Create: `src/components/events/MaterialLink.tsx`
- Test: `tests/event-detail.test.ts`

**Interfaces:**
- Consumes: detail contract from Task 2.
- Produces: grouped sections for poster, photo, PPT, video, article, and other materials.
- Produces: cloud-drive links showing title, extraction code/note, source, and optional thumbnail.

- [ ] **Step 1: Write failing rendering/source tests** for grouped materials, no-thumbnail links, extraction code text, empty materials, official source link, and missing-event handling.
- [ ] **Step 2: Run `npm test -- tests/event-detail.test.ts`** and verify the route/components do not exist.
- [ ] **Step 3: Implement the dynamic route** with `await params`, numeric id validation, `notFound()`, and a loading state consistent with Next.js 16 docs.
- [ ] **Step 4: Implement material sections** so links open in a new tab and notes are visible without exposing an unusable download button.
- [ ] **Step 5: Run `npm test -- tests/event-detail.test.ts` and `npm run build`**.
- [ ] **Step 6: Commit** with `feat: add event material detail pages`.

### Task 5: Admin Material Editor

**Files:**
- Create: `src/components/admin/EventManager.tsx`
- Create: `src/components/admin/EventMaterialEditor.tsx`
- Modify: `src/app/admin/page.tsx`
- Test: `tests/event-admin.test.ts`

**Interfaces:**
- Consumes: event and material mutation endpoints from Task 2.
- Produces: an inline editor for type, title, cloud-drive URL, thumbnail URL, extraction code/notes, source URL, and sort order.

- [ ] **Step 1: Write failing source tests** for loading existing materials before editing, add/update/delete flows, extraction-code input, invalid URL feedback, and unsaved-state preservation.
- [ ] **Step 2: Run `npm test -- tests/event-admin.test.ts`** and verify the editor is absent.
- [ ] **Step 3: Extract the current `EventsSection`** into `EventManager` without changing existing activity CRUD behavior.
- [ ] **Step 4: Add `EventMaterialEditor`** beneath the selected activity form and refresh only that activity's materials after a successful mutation.
- [ ] **Step 5: Keep link and note fields independent** so a record may contain a public URL, an extraction code, a note, or any useful combination allowed by validation.
- [ ] **Step 6: Run `npm test -- tests/event-admin.test.ts tests/events.test.ts` and `npm run build`**.
- [ ] **Step 7: Commit** with `feat: manage event cloud links`.

### Task 6: Official Activity Synchronization

**Files:**
- Create: `src/lib/ivorysql-events-sync.ts`
- Create: `src/app/api/events/sync/route.ts`
- Modify: `src/proxy.ts`
- Modify: `vercel.json`
- Test: `tests/events-sync.test.ts`
- Create: `tests/fixtures/ivorysql-events-list.html`
- Create: `tests/fixtures/ivorysql-event-detail.html`

**Interfaces:**
- Produces: `parseOfficialEventList(html)`, `parseOfficialEventDetail(html)`, and `syncOfficialEvents()`.
- Consumes: tracked sync helper from the data reliability plan when present.
- Preserves: manual attendance fields and materials where `source_url` is not the official event page.

- [ ] **Step 1: Add minimal sanitized fixtures and failing tests** for list pagination, source-URL upsert, public image/link extraction, rerun idempotency, malformed pages, and manual-field preservation.
- [ ] **Step 2: Run `npm test -- tests/events-sync.test.ts`** and verify parser/sync cases fail.
- [ ] **Step 3: Add a stable official source URL column/index** to activities and implement pure list/detail parsers.
- [ ] **Step 4: Implement idempotent sync** that adds official materials and never removes or overwrites manual cloud-drive records or attendance values.
- [ ] **Step 5: Add the protected manual/cron route and daily Vercel schedule**; record success/failure through `sync_runs` when available.
- [ ] **Step 6: Run `npm test -- tests/events-sync.test.ts tests/auth.test.ts`** and verify all pass.
- [ ] **Step 7: Commit** with `feat: sync official IvorySQL events`.

### Task 7: End-To-End Verification

**Files:**
- Modify: `README.md`
- Test: all tests and browser verification

**Interfaces:**
- Consumes: all prior tasks.
- Produces: documented material workflow and verified responsive archive.

- [ ] **Step 1: Document** how to add a cloud-drive link, extraction code, and note, and how official sync interacts with manual records.
- [ ] **Step 2: Run `npm test`, `npm run lint`, and `npm run build`** and resolve only failures caused by this work.
- [ ] **Step 3: Start the app and verify** list filters, pagination, detail groups, external links, admin editing, and viewer read-only behavior at desktop and mobile widths.
- [ ] **Step 4: Confirm the existing activity count and attendance values** match the pre-change database snapshot.
- [ ] **Step 5: Commit** with `docs: document event material workflow`.

