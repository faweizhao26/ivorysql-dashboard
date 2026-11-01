# Sidebar and Dual Theme Plan

**Goal:** Apply the approved light and charcoal palettes and left navigation, without changing any page content or data behavior.

**Scope:** Shared shell, navigation, theme persistence, global appearance, and chart colors only. No page modules, APIs, database changes, metric rules, avatar assets, or reading import scripts. Existing saved appearance remains respected; new visitors start in light mode.

**Architecture:** AppShell wraps existing page children. Desktop sidebar and a native mobile dialog share permission-filtered navigation. Theme tokens adapt existing utility classes and charts so page components remain untouched. A small bootstrap restores appearance before hydration.

## Tasks
- [x] Add and run focused tests for persisted appearance and active/admin navigation.
- [x] Implement shell, native mobile navigation, and persistent light/dark controls.
- [x] Replace decorative gradients with neutral surfaces and theme-aware chart colors; preserve all page data and structure.
- [x] Run tests, lint, build, and desktop/mobile browser checks. Verify the changed-file list contains no page modules, APIs, or data scripts. Do not push without a request.

## Verification
- 424 tests pass. Production build and ESLint pass; build and lint repeated after the final border/focus polish.
- All eight top-level pages checked in both appearances on desktop; all eight also checked at 390px without document overflow, with mobile light/dark screenshots of content. Main content text is identical across theme switches once asynchronous loading completes. The 320px header and 1024px sidebar also fit.
- Native mobile navigation opens, closes on Escape, returns focus to its opener and closes on navigation. Saved dark appearance survives reload/navigation. Theme switching works when storage writes throw. Viewer navigation omits admin; the preview session was restored to admin afterward.
- Contribution editor retains the existing history pane and a readable limit warning; no draft data was saved.
- Page modules, API routes, database code and the unrelated untracked reading import script are unchanged. No database changes, commit, push or deployment were performed.
- Local preview: http://localhost:3032/.

## Review Focus
- The admin link remains hidden for viewers and unauthenticated sessions.
- Nested event routes highlight only the events link.
- Theme survives refresh and navigation, including when localStorage is unavailable.
- Mobile menu supports Escape, focus return, and closing after navigation.
- Existing tables, forms, avatars, chart data, time filters and contribution drawers remain usable in both themes.
