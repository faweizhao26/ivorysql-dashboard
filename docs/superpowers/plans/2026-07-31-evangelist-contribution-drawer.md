# Evangelist Contribution Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the off-screen contribution form in the evangelist admin section with an accessible, responsive right-side drawer for both new and existing contributions.

**Architecture:** Keep the existing `EvangelistSection` state and `/api/evangelist` data flow. Render the contribution form as a fixed overlay only while `editingCont` is set, and derive the active participant name from the already-loaded participant list. Add source-level UI contract tests because this repository does not include a DOM component-test runtime, then verify behavior with Puppeteer against the real page.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Node test runner with `tsx`, Puppeteer.

## Global Constraints

- Do not change `/api/evangelist`, its request payloads, or the database schema.
- Keep the drawer implementation in `src/app/admin/page.tsx`; do not add a single-use component abstraction or dependency.
- Desktop drawer width must not exceed 560px; narrow screens use the full viewport.
- The form body scrolls independently and the action bar remains visible.
- Preserve the existing custom “其他” contribution type and notes field.
- Successful saves close the drawer and refresh both the current contribution list and participant totals.

---

### Task 1: Lock the Drawer UI Contract

**Files:**
- Modify: `tests/evangelist.test.ts`
- Test: `tests/evangelist.test.ts`

**Interfaces:**
- Consumes: `src/app/admin/page.tsx` as UTF-8 source text.
- Produces: regression checks for dialog semantics, fixed viewport placement, participant context, and Escape handling.

- [ ] **Step 1: Write the failing source-level tests**

Add these imports and tests while keeping the existing contribution-type test:

```ts
import { readFile } from 'node:fs/promises';

const adminPageSource = await readFile(
  new URL('../src/app/admin/page.tsx', import.meta.url),
  'utf8'
);

test('contribution editor is rendered as a fixed accessible drawer', () => {
  assert.match(adminPageSource, /role="dialog"/);
  assert.match(adminPageSource, /aria-modal="true"/);
  assert.match(adminPageSource, /fixed inset-0 z-50/);
  assert.match(adminPageSource, /max-w-\[560px\]/);
  assert.match(adminPageSource, /当前成员/);
});

test('contribution drawer supports Escape and background scroll locking', () => {
  assert.match(adminPageSource, /event\.key === 'Escape'/);
  assert.match(adminPageSource, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(adminPageSource, /document\.body\.style\.overflow = previousOverflow/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npx tsx --test tests/evangelist.test.ts`

Expected: the existing “其他” test passes and the two drawer tests fail because the dialog markup and lifecycle behavior do not exist.

- [ ] **Step 3: Commit the failing contract test**

```bash
git add tests/evangelist.test.ts
git commit -m "test: define evangelist contribution drawer contract"
```

### Task 2: Replace the Inline Form with a Responsive Drawer

**Files:**
- Modify: `src/app/admin/page.tsx:1425-1617`
- Test: `tests/evangelist.test.ts`

**Interfaces:**
- Consumes: `editingCont`, `participants`, `saveContribution`, `getCategoryOptions`, and `getTypeOptions` inside `EvangelistSection`.
- Produces: `closeContributionDrawer(): void`, `activeParticipantName: string`, and dialog markup controlled by `editingCont`.

- [ ] **Step 1: Read the bundled Next.js 16 client-component guidance**

Run: `sed -n '1,240p' node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`

Expected: confirm that browser APIs and interactive state remain inside the existing `'use client'` page.

- [ ] **Step 2: Add drawer lifecycle behavior**

After the initial participant-fetch effect, derive the member name and add one effect for Escape and background scroll locking:

```tsx
const activeParticipantName = participants.find(
  participant => participant.id === editingCont?.participant_id
)?.name || '未选择成员';

function closeContributionDrawer() {
  setEditingCont(null);
}

useEffect(() => {
  if (!editingCont) return;
  const previousOverflow = document.body.style.overflow;
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') setEditingCont(null);
  };
  document.body.style.overflow = 'hidden';
  window.addEventListener('keydown', handleKeyDown);
  return () => {
    document.body.style.overflow = previousOverflow;
    window.removeEventListener('keydown', handleKeyDown);
  };
}, [editingCont]);
```

Keep the function local to `EvangelistSection`; no reusable modal abstraction is needed.

- [ ] **Step 3: Simplify the top management layout**

Remove the contribution-form panel and change the containing two-column grid into a single member-management panel. Do not change the member form fields or save behavior.

- [ ] **Step 4: Render the drawer after the contribution list**

Add a fixed overlay as the last child of `EvangelistSection` when `editingCont` is non-null:

```tsx
{editingCont && (
  <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="contribution-drawer-title">
    <button
      type="button"
      aria-label="关闭贡献编辑"
      onClick={closeContributionDrawer}
      className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
    />
    <div className="absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col border-l border-slate-700 bg-slate-900 shadow-2xl">
      <header className="flex shrink-0 items-start justify-between border-b border-slate-700 px-5 py-4 sm:px-6">
        <div>
          <h2 id="contribution-drawer-title" className="text-lg font-semibold text-slate-100">
            {editingCont.id ? '编辑贡献' : '添加贡献'}
          </h2>
          <p className="mt-1 text-sm text-slate-400">当前成员：{activeParticipantName}</p>
        </div>
        <button type="button" aria-label="关闭" onClick={closeContributionDrawer}>×</button>
      </header>
      <form onSubmit={saveContribution} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm text-slate-300">
              <span>贡献类别</span>
              <select required value={editingCont.category || ''} onChange={event => setEditingCont({ ...editingCont, category: event.target.value, type: editingCont.id ? editingCont.type : '' })} className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-slate-200">
                <option value="">选择类别</option>
                {getCategoryOptions().map(category => <option key={category}>{category}</option>)}
              </select>
            </label>
            <label className="space-y-1.5 text-sm text-slate-300">
              <span>贡献类型</span>
              <select required value={editingCont.type || ''} onChange={event => setEditingCont({ ...editingCont, type: event.target.value })} disabled={!editingCont.category} className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-slate-200 disabled:cursor-not-allowed disabled:opacity-50">
                <option value="">选择类型</option>
                {getTypeOptions().map(type => <option key={type}>{type}</option>)}
              </select>
            </label>
          </div>
          <label className="block space-y-1.5 text-sm text-slate-300">
            <span>标题 <span className="text-slate-500">（可选）</span></span>
            <input value={editingCont.title || ''} onChange={event => setEditingCont({ ...editingCont, title: event.target.value })} className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-slate-200" />
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm text-slate-300">
              <span>积分</span>
              <input type="number" value={editingCont.points || ''} onChange={event => setEditingCont({ ...editingCont, points: parseInt(event.target.value) || 0 })} className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-slate-200" />
            </label>
            <label className="space-y-1.5 text-sm text-slate-300">
              <span>日期</span>
              <input type="date" value={editingCont.date || ''} onChange={event => setEditingCont({ ...editingCont, date: event.target.value })} className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-slate-200" />
            </label>
          </div>
          <label className="block space-y-1.5 text-sm text-slate-300">
            <span>链接 <span className="text-slate-500">（可选）</span></span>
            <input type="url" value={editingCont.url || ''} onChange={event => setEditingCont({ ...editingCont, url: event.target.value })} className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-slate-200" />
          </label>
          <label className="block space-y-1.5 text-sm text-slate-300">
            <span>备注 <span className="text-slate-500">（可选）</span></span>
            <textarea rows={4} value={editingCont.notes || ''} onChange={event => setEditingCont({ ...editingCont, notes: event.target.value })} className="w-full resize-y rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-slate-200" />
          </label>
        </div>
        <footer className="flex shrink-0 justify-end gap-3 border-t border-slate-700 bg-slate-900 px-5 py-4 sm:px-6">
          <button type="button" onClick={closeContributionDrawer}>取消</button>
          <button type="submit">{editingCont.id ? '更新贡献' : '添加贡献'}</button>
        </footer>
      </form>
    </div>
  </div>
)}
```

Use explicit `<label>` elements for each control. Form fields use `grid-cols-1 sm:grid-cols-2` so they stack on narrow screens. Use a multiline `<textarea>` for notes while preserving the same `notes` value.

- [ ] **Step 5: Make open and save actions consistent**

Keep both existing open actions setting `editingCont`; the fixed overlay makes the form visible regardless of scroll position. Change successful save to await both refreshes before clearing state:

```tsx
await Promise.all([
  fetchContributions(editingCont.participant_id),
  fetchParticipants(),
]);
closeContributionDrawer();
```

The backdrop and cancel controls only clear `editingCont`; they do not change `selectedId` or the loaded contribution list.

- [ ] **Step 6: Run the focused test and verify it passes**

Run: `npx tsx --test tests/evangelist.test.ts`

Expected: all evangelist tests pass.

- [ ] **Step 7: Run project checks**

Run: `npm test`

Expected: all tests pass with zero failures.

Run: `npm run lint`

Expected: exit 0 with no new lint errors.

Run: `npm run build`

Expected: Next.js production build exits 0.

- [ ] **Step 8: Commit the implementation**

```bash
git add src/app/admin/page.tsx tests/evangelist.test.ts
git commit -m "feat: edit evangelist contributions in a drawer"
```

### Task 3: Verify Real Admin Workflows and Publish

**Files:**
- Verify: `src/app/admin/page.tsx`
- Verify: `tests/evangelist.test.ts`

**Interfaces:**
- Consumes: production-like Next.js server, admin password from local environment, and the existing evangelist API.
- Produces: browser evidence for desktop and mobile drawer behavior without creating or changing production records during verification.

- [ ] **Step 1: Start a local production server on an unused port**

Run `npm run start -- --port 3019` after the successful build. If 3019 is occupied, use the next available port and record it.

- [ ] **Step 2: Verify desktop behavior with Puppeteer**

At a 1440×900 viewport, log in, open `/admin`, activate “布道者计划”, scroll the members table, click one “+贡献” button, and assert:

```js
await page.waitForSelector('[role="dialog"][aria-modal="true"]');
const box = await page.$eval('[role="dialog"] > div:last-child', element => {
  const rect = element.getBoundingClientRect();
  return { top: rect.top, right: rect.right, height: rect.height, width: rect.width };
});
```

Expected: `top === 0`, `right === 1440`, `height === 900`, and `width <= 560`. Confirm the selected member name appears, press Escape, and assert the dialog closes. Open an existing contribution’s “编辑” action and confirm its category, type, points, and notes values are loaded.

- [ ] **Step 3: Verify mobile behavior with Puppeteer**

At a 390×844 viewport, repeat the “+贡献” action. Expected: the drawer occupies the viewport width, fields are single-column, the header and footer are visible, and the form body scrolls without moving the background page. Close with the cancel button.

- [ ] **Step 4: Check browser and server errors**

Expected: no Next.js error overlay, no application console errors, and no failed `/api/evangelist` requests. External favicon failures may be recorded separately and must not be reported as application failures.

- [ ] **Step 5: Push and verify Vercel**

Run: `git push origin main`

Expected: push succeeds using the configured `faweizhao26` GitHub account. Wait for the production deployment, then repeat the read-only page-load and drawer open/close checks at `https://ivorysql-dashboard.vercel.app/admin`. Do not submit a contribution during production verification.

- [ ] **Step 6: Confirm repository state**

Run: `git status --short --branch`

Expected: `main` matches `origin/main` and the worktree is clean.
