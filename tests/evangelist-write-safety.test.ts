import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { type TestContext } from 'node:test';
import { runInNewContext } from 'node:vm';
import { Pool } from 'pg';
import ts from 'typescript';
import { DELETE } from '../src/app/api/evangelist/route';

function mockDatabase(t: TestContext, fail = false) {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  t.mock.method(Pool.prototype, 'connect', async () => {
    throw new Error('Live database connections are forbidden in this test');
  });
  t.mock.method(Pool.prototype, 'query', async (sql: string, values?: unknown[]) => {
    calls.push({ sql, values });
    if (fail && /DELETE FROM evangelist_participants/.test(sql)) {
      throw new Error('participant delete failed');
    }
    return { rows: [], rowCount: 1 };
  });
  return calls;
}

test('member deletion emits only one parent DELETE for the atomic FK cascade', async t => {
  const calls = mockDatabase(t);
  const response = await DELETE(new Request('http://localhost/api/evangelist?id=7', { method: 'DELETE' }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  assert.deepEqual(calls, [{ sql: 'DELETE FROM evangelist_participants WHERE id=$1', values: ['7'] }]);
});

test('a failed parent DELETE returns an error without separately deleting scores', async t => {
  const calls = mockDatabase(t, true);
  const response = await DELETE(new Request('http://localhost/api/evangelist?id=7', { method: 'DELETE' }));
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'participant delete failed' });
  assert.deepEqual(calls, [{ sql: 'DELETE FROM evangelist_participants WHERE id=$1', values: ['7'] }]);
});

test('contribution deletion still deletes only the requested contribution', async t => {
  const calls = mockDatabase(t);
  const response = await DELETE(new Request('http://localhost/api/evangelist?id=19&type=contribution', { method: 'DELETE' }));
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{ sql: 'DELETE FROM evangelist_contributions WHERE id=$1', values: ['19'] }]);
});

test('deletion without an ID does not query the database', async t => {
  const calls = mockDatabase(t);
  const response = await DELETE(new Request('http://localhost/api/evangelist', { method: 'DELETE' }));
  assert.equal(response.status, 400);
  assert.deepEqual(calls, []);
});

// Execute the page's actual handlers, isolating only their React state and network boundaries.
// TypeScript is already a direct dev dependency; no browser, server, or extra package is required.
const source = ts.createSourceFile('page.tsx', readFileSync(
  new URL('../src/app/admin/page.tsx', import.meta.url), 'utf8',
), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const section = source.statements.find((node): node is ts.FunctionDeclaration =>
  ts.isFunctionDeclaration(node) && node.name?.text === 'EvangelistSection');
assert.ok(section?.body);
const handlerNames = ['savePerson', 'saveContribution', 'deletePerson'];
const handlerSource = section.body.statements.filter(node =>
  ts.isFunctionDeclaration(node) && handlerNames.includes(node.name?.text || ''),
).map(node => node.getText(source)).join('\n');
const handlerCode = ts.transpileModule(handlerSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function pageHandlers() {
  const writes: Array<{ url: string; method: string; body?: string }> = [];
  const pending: ReturnType<typeof deferred<Response>>[] = [];
  const alerts: string[] = [];
  const person = { name: 'Draft member', avatar_url: '/avatars/ivorysql-line-men.png#12' };
  const contribution = { participant_id: 7, category: '其他', type: '其他', title: 'Draft contribution', points: 5 };
  const state = {
    editingPerson: person as (typeof person & { id?: number }) | null,
    editingCont: contribution as (typeof contribution & { id?: number }) | null,
    selectedId: 7 as number | null,
    contributions: [{ id: 19, points: 5 }],
    savingPerson: false,
    savingContribution: false,
    savingPersonRef: { current: false },
    savingContributionRef: { current: false },
    failRefresh: false,
    refreshes: 0,
    confirm: () => true,
    alert: (message: string) => { alerts.push(message); },
    Error,
    fetch: (url: string, options: { method: string; body?: string }) => {
      writes.push({ url, ...options });
      const request = deferred<Response>();
      pending.push(request);
      return request.promise;
    },
    setSavingPerson: (saving: boolean) => { state.savingPerson = saving; },
    setSavingContribution: (saving: boolean) => { state.savingContribution = saving; },
    setEditingPerson: (value: typeof person | null) => { state.editingPerson = value; },
    closeContributionDrawer: () => { state.editingCont = null; },
    clearContributionSelection: () => { state.selectedId = null; state.contributions = []; },
    fetchParticipants: async () => {
      state.refreshes += 1;
      if (state.failRefresh) throw new Error('refresh offline');
    },
    fetchContributions: async () => {
      state.refreshes += 1;
      if (state.failRefresh) throw new Error('refresh offline');
    },
  };
  const handlers = runInNewContext(`${handlerCode}; ({ ${handlerNames.join(', ')} });`, { ...state }) as {
    savePerson: (event: { preventDefault: () => void }) => Promise<void>;
    saveContribution: (event: { preventDefault: () => void }) => Promise<void>;
    deletePerson: (id: number) => Promise<void>;
  };
  return { state, writes, pending, alerts, ...handlers };
}

const submitEvent = { preventDefault() {} };

for (const kind of ['Person', 'Contribution'] as const) {
  for (const method of ['POST', 'PUT'] as const) {
    for (const failure of ['network', 'http', 'non-json'] as const) {
      test(`${kind} ${method}: in-flight exclusion, ${failure} failure retains draft and permits retry`, async () => {
        const page = pageHandlers();
        const formKey = kind === 'Person' ? 'editingPerson' : 'editingCont';
        const savingKey = kind === 'Person' ? 'savingPerson' : 'savingContribution';
        const lockKey = kind === 'Person' ? 'savingPersonRef' : 'savingContributionRef';
        const save = page[`save${kind}`];
        if (method === 'PUT') page.state[formKey]!.id = 19;
        const draft = structuredClone(page.state[formKey]);
        const first = save(submitEvent);
        const second = save(submitEvent);
        assert.equal(page.writes.length, 1);
        assert.equal(page.writes[0].method, method);
        assert.deepEqual(JSON.parse(page.writes[0].body!), draft);
        assert.equal(page.state[savingKey], true);
        assert.equal(page.state[lockKey].current, true);
        if (failure === 'network') page.pending[0].reject(new TypeError('network offline'));
        else page.pending[0].resolve(failure === 'http'
          ? Response.json({ error: 'write blocked' }, { status: 500 })
          : new Response('Bad gateway', { status: 502 }));
        await Promise.all([first, second]);
        assert.equal(page.state[savingKey], false);
        assert.equal(page.state[lockKey].current, false);
        assert.deepEqual(page.state[formKey], draft);
        assert.match(page.alerts[0], /保存失败/);
        assert.equal(page.state.refreshes, 0);

        const retry = save(submitEvent);
        assert.equal(page.writes.length, 2);
        page.pending[1].resolve(Response.json({ success: true }));
        await retry;
        assert.equal(page.state[formKey], null);
        assert.equal(page.state[savingKey], false);
        assert.equal(page.state[lockKey].current, false);
        assert.equal(page.alerts.length, 1);
      });
    }
  }

  test(`${kind}: successful save closes editor even when refreshing fails`, async () => {
    const page = pageHandlers();
    page.state.failRefresh = true;
    const saving = page[`save${kind}`](submitEvent);
    page.pending[0].resolve(Response.json({ success: true }));
    await saving;
    assert.equal(page.state[kind === 'Person' ? 'editingPerson' : 'editingCont'], null);
    assert.match(page.alerts[0], /保存成功.*刷新失败/);
    assert.equal(page.writes.length, 1);
  });
}

for (const failure of ['network', 'http', 'non-json'] as const) {
  test(`member deletion ${failure} failure preserves selected scores and both drafts`, async () => {
    const page = pageHandlers();
    page.state.editingPerson!.id = 7;
    const before = structuredClone({ person: page.state.editingPerson, contribution: page.state.editingCont, scores: page.state.contributions });
    const deletion = page.deletePerson(7);
    assert.equal(page.state.selectedId, 7);
    assert.equal(page.state.contributions[0].points, 5);
    if (failure === 'network') page.pending[0].reject(new TypeError('network offline'));
    else page.pending[0].resolve(failure === 'http'
      ? Response.json({ error: 'delete blocked' }, { status: 500 })
      : new Response('Bad gateway', { status: 502 }));
    await deletion;
    assert.match(page.alerts[0], /删除失败/);
    assert.equal(page.state.selectedId, 7);
    assert.deepEqual({ person: page.state.editingPerson, contribution: page.state.editingCont, scores: page.state.contributions }, before);
    assert.equal(page.state.refreshes, 0);

    const retry = page.deletePerson(7);
    page.pending[1].resolve(Response.json({ success: true }));
    await retry;
    assert.equal(page.state.selectedId, null);
    assert.equal(page.state.contributions.length, 0);
    assert.equal(page.state.editingPerson, null);
    assert.equal(page.state.editingCont, null);
  });
}

test('deleting a different member leaves the current selection and drafts intact', async () => {
  const page = pageHandlers();
  const deletion = page.deletePerson(8);
  page.pending[0].resolve(Response.json({ success: true }));
  await deletion;
  assert.equal(page.state.selectedId, 7);
  assert.ok(page.state.editingPerson);
  assert.ok(page.state.editingCont);
  assert.equal(page.state.contributions.length, 1);
});
