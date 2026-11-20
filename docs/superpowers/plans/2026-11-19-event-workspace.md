# Event Workspace Implementation Plan

**Goal:** One activity record supports calendar, annual plans, preparation tasks, promotion outcomes, materials and a two-sheet Excel export matching the supplied workbook.

**Architecture:** Extend the existing activity_events collected_data with a validated workspace document. Keep legacy records and material relationships unchanged. Server-side access projection separates internal plans from published information. Add a small task-template table. Use date-fns for calendar dates and ExcelJS for native workbook output.

**Constraints:** Do not import the supplied workbook without a separate request. No production example data, automatic historical completion inference or Git push. Preserve existing collected_data keys and existing event/material IDs. Unknown metrics stay blank. Internal plans/tasks must not escape via detail, materials, lists or exports.

## Tasks
- [x] Test and implement workspace validation, privacy projection, filters, progress and deduplicated promotion totals.
- [x] Add transactional workspace persistence, editable task templates and authorized read/write endpoints; retain existing event endpoints for compatibility.
- [x] Implement calendar, monthly/annual plans, unscheduled pool, scoped filters and editing drawer shared with the admin page.
- [x] Add task/template editing, promotion outcomes and existing drive-material editor to the drawer.
- [x] Add Excel export with original sheets/columns, merged headers, typed dates and multiple promotion links.
- [x] Verify unit/regression tests, typecheck, lint, build and local browser flows; start local preview. Do not push without user request.

## Verification
- Full regression suite: 448 tests passed; typecheck, lint and production build passed.
- Desktop calendar, annual plans, admin entry, task progress and 390px editor layout inspected.
- Local API/export validation: 37 existing events retained, both workbook sheets verified, viewer restrictions checked.
- Database create/update tested inside a transaction and rolled back; no example event rows retained.
- Next.js page/route helper exports moved to library modules without changing scoring behavior.
- Preview: http://localhost:3034/events (Webpack development mode).

## Review Focus
- Legacy dates are not proof that an activity was held; use an explicit recorded legacy stage.
- Undated and cross-month activities remain visible without fabricated dates.
- Preserve missing vs zero and approximate coverage values; sum promotion URLs once.
- Optimistic update conflict protects tasks from concurrent editor overwrites.
- Viewer requests cannot read internal records through alternate API paths.
