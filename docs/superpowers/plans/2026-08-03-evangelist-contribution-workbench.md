# Evangelist Contribution Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the active member's contribution history beside the contribution form and warn, without blocking save, when a 2026 capped contribution type would exceed its annual points limit.

**Architecture:** Keep the feature inside the existing client-side `EvangelistSection` and continue using `/api/evangelist`. Add one exported pure limit-calculation function for deterministic tests, protect contribution loading with a request sequence ref, and expand the drawer into a desktop two-column workbench with mobile tabs.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Node test runner with `tsx`, Puppeteer.

## Global Constraints

- Do not change the evangelist API or database schema.
- Do not add duplicate detection or block saving when a limit is exceeded.
- Limits apply per member, per exact contribution type, for the 2026 plan year.
- Empty historical dates count as 2026; an explicitly non-2026 draft date does not produce a 2026 warning.
- Editing excludes the current record before adding the draft points.
- Preserve the custom “其他” type, notes field, Escape behavior, backdrop close, and fixed action bar.

---

### Task 1: Define the Annual Limit Contract

**Files:**
- Modify: `tests/evangelist.test.ts`
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Produces: `evangelistContributionLimits: Record<string, number>`.
- Produces: `calculateEvangelistContributionLimit(contributions, draft, year?)` returning `{ currentPoints, draftPoints, projectedPoints, limit, exceededBy } | null`.

- [ ] **Step 1: Add failing tests for limit calculation**

Extend the current dynamic import type and add tests covering:

```ts
const { calculateEvangelistContributionLimit } = await import('../src/app/admin/page');

test('warns only when a capped type exceeds its 2026 annual limit', () => {
  const contributions = [
    { id: 1, type: '宣传社区活动(5/次·上限30)', points: 25, date: '2026-04-01' },
  ];
  assert.deepEqual(
    calculateEvangelistContributionLimit(contributions, {
      type: '宣传社区活动(5/次·上限30)', points: 10, date: '2026-08-03',
    }),
    { currentPoints: 25, draftPoints: 10, projectedPoints: 35, limit: 30, exceededBy: 5 }
  );
});

test('does not mark a capped type as exceeded when it exactly reaches the limit', () => {
  const status = calculateEvangelistContributionLimit(
    [{ id: 1, type: '转载官方动态(10/篇·上限30)', points: 20, date: null }],
    { type: '转载官方动态(10/篇·上限30)', points: 10, date: '' }
  );
  assert.equal(status?.exceededBy, 0);
});

test('excludes the edited record from its projected annual total', () => {
  const status = calculateEvangelistContributionLimit(
    [
      { id: 1, type: '转发官方动态(3/次·上限21)', points: 12, date: '2026-01-01' },
      { id: 2, type: '转发官方动态(3/次·上限21)', points: 6, date: '2026-02-01' },
    ],
    { id: 2, type: '转发官方动态(3/次·上限21)', points: 12, date: '2026-02-01' }
  );
  assert.deepEqual(status, {
    currentPoints: 12, draftPoints: 12, projectedPoints: 24, limit: 21, exceededBy: 3,
  });
});

test('ignores other types and years and returns null for uncapped drafts', () => {
  const contributions = [
    { id: 1, type: '宣传社区活动(5/次·上限30)', points: 30, date: '2025-12-31' },
    { id: 2, type: '内容被公众号转载(10)', points: 30, date: '2026-01-01' },
  ];
  assert.equal(calculateEvangelistContributionLimit(contributions, {
    type: '宣传社区活动(5/次·上限30)', points: 5, date: '2025-08-03',
  }), null);
  assert.equal(calculateEvangelistContributionLimit(contributions, {
    type: '内容被公众号转载(10)', points: 10, date: '2026-08-03',
  }), null);
});
```

- [ ] **Step 2: Update the source contract test**

Change the drawer width assertion from `max-w-[560px]` to `max-w-[960px]` and assert that the source contains `已有贡献`, `新增贡献`, and `保存后将超出`.

- [ ] **Step 3: Run the focused test and verify RED**

Run: `npx tsx --test tests/evangelist.test.ts`

Expected: failures because the limit function, 960px drawer, history view, and warning copy do not exist.

- [ ] **Step 4: Implement the pure limit function**

Add explicit limits beside `evangelistContributionTypes`:

```ts
export const evangelistContributionLimits: Record<string, number> = {
  '宣传社区活动(5/次·上限30)': 30,
  '转载官方动态(10/篇·上限30)': 30,
  '转发官方动态(3/次·上限21)': 21,
};
```

The function must return `null` for uncapped types or a non-2026 draft, filter by exact type and 2026/null date, exclude `draft.id`, coerce points with `Number(...) || 0`, and calculate `exceededBy` with `Math.max(0, projectedPoints - limit)`.

- [ ] **Step 5: Run the focused test**

Run: `npx tsx --test tests/evangelist.test.ts`

Expected: calculation tests pass while layout contract tests remain red.

### Task 2: Build the Contextual Contribution Workbench

**Files:**
- Modify: `src/app/admin/page.tsx:1425-1744`
- Test: `tests/evangelist.test.ts`

**Interfaces:**
- Produces: loading state tied to the current contribution request.
- Produces: desktop history/form panes and mobile `form | history` tabs.
- Consumes: `calculateEvangelistContributionLimit` to render a non-blocking warning.

- [ ] **Step 1: Add safe contribution-loading state**

Import `useRef`, add `loadingContributions`, `drawerTab`, and `contributionRequestRef`. In `fetchContributions(pid)`, increment the request sequence, clear old contributions, set loading, and only apply response/final state when the sequence still matches. Keep `selectedId` synchronized with `pid`.

- [ ] **Step 2: Centralize open actions**

Add `openNewContribution(participantId)` and `openExistingContribution(contribution)` helpers. Both reset the mobile tab to `form`; new contributions start a fresh history request, while edits reuse the already-loaded matching history or fetch it when needed. Replace the existing inline button handlers with these helpers.

- [ ] **Step 3: Add the desktop history pane**

Change the drawer to `max-w-[960px]`. Below the shared header, render a desktop grid with a left history pane and right form pane. The history pane must show loading, empty, and populated states; each record displays date, category, type, title, points, and notes. Apply an indigo highlight when `record.type === editingCont.type` and a stronger current-record marker when `record.id === editingCont.id`.

- [ ] **Step 4: Add mobile tabs**

Render a two-button segmented control below the header on screens below `md`. Show the form pane when `drawerTab === 'form'` and history pane when `drawerTab === 'history'`; at `md` and above both panes remain visible. Include the contribution count in the history tab label.

- [ ] **Step 5: Render the warning without blocking save**

Calculate the current status on every render. When `exceededBy > 0`, place an amber warning below the points/date row:

```tsx
当前已计 {currentPoints} 分，本次 {draftPoints} 分，年度上限 {limit} 分，保存后将超出 {exceededBy} 分。
```

Do not change the submit button's `disabled` state or the API payload.

- [ ] **Step 6: Run focused and full tests**

Run: `npx tsx --test tests/evangelist.test.ts`

Expected: all evangelist tests pass.

Run: `npm test`

Expected: all project tests pass.

- [ ] **Step 7: Run static verification**

Run: `npm run build`

Expected: Next.js production build exits 0.

Run: `npm run lint`

Expected: record the existing lint baseline separately; do not broaden this feature into unrelated lint cleanup.

### Task 3: Browser Verification and Deployment

**Files:**
- Verify: `src/app/admin/page.tsx`
- Verify: `tests/evangelist.test.ts`

**Interfaces:**
- Consumes: local production server and existing admin authentication.
- Produces: read-only browser evidence; production verification must not submit a contribution.

- [ ] **Step 1: Verify desktop layout at 1440×900**

Open a member with contributions and assert the drawer width is at most 960px, history and form panes are simultaneously visible, history belongs to the selected member, both panes scroll independently, and the fixed action bar remains in view.

- [ ] **Step 2: Verify cap warning behavior**

Select `宣传社区活动(5/次·上限30)`, enter points that exceed the remaining amount, and assert the warning shows current, draft, limit, and exceeded points while the submit button remains enabled. Do not submit.

- [ ] **Step 3: Verify mobile layout at 390×844**

Assert the drawer is full width, defaults to `新增贡献`, switches to `已有贡献`, shows the same member's records, and switches back without losing form values.

- [ ] **Step 4: Commit and push**

Commit tests and implementation, push `main` to `git@github.com:faweizhao26/ivorysql-dashboard.git`, and wait for the corresponding Vercel production deployment to reach `READY`.

- [ ] **Step 5: Verify production**

Repeat the read-only desktop history/form, warning, and mobile tab checks at `https://ivorysql-dashboard.vercel.app/admin`. Confirm no `/admin` or `/api/evangelist` runtime errors and finish with a clean `main...origin/main` status.
