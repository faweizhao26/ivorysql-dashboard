import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const code = ts.transpileModule(readFileSync(new URL('../src/app/admin/page.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;

interface Element {
  type: string;
  props: {
    children?: Element | Element[];
    value?: string;
    min?: number;
    step?: number;
    onChange: (event: { target: { value: string } }) => void;
    onSubmit: (event: { preventDefault(): void }) => Promise<void>;
  };
}

function elements(node: Element | Element[] | undefined): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== 'object') return [];
  return [node, ...elements(node.props.children)];
}

function manualForm() {
  const states: unknown[] = [];
  const writes: Record<string, unknown>[] = [];
  let cursor = 0;
  const hooks = {
    useState(initial: unknown) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], (value: unknown) => { states[index] = value; }];
    },
    useEffect() {},
    useCallback(callback: unknown) { return callback; },
  };
  const exports: Record<string, () => Element> = {};
  runInNewContext(`${code}\nexports.ManualDataSection = ManualDataSection;`, {
    exports,
    require(name: string) {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return require(name);
      if (name === '@/lib/date') return { getBeijingDate: () => '2026-10-17' };
      if (name === '@/lib/manual-data') return require('../src/lib/manual-data.ts');
      return {};
    },
    async fetch(_url: string, options?: { method?: string; body?: string }) {
      if (options?.method === 'POST') writes.push(JSON.parse(options.body!));
      return { ok: true, json: async () => [] };
    },
    console,
  });
  function render() {
    cursor = 0;
    return elements(exports.ManualDataSection());
  }
  function changeSelect(index: number, value: string) {
    render().filter(element => element.type === 'select')[index].props.onChange({ target: { value } });
  }
  return { render, changeSelect, writes };
}

test('switching category resets platform and metric together before effects or submit', async () => {
  const form = manualForm();
  form.changeSelect(1, 'youtube');
  form.changeSelect(2, 'views');
  for (const [category, platform, metric] of [
    ['article', 'csdn', 'followers'],
    ['activity', 'conference', 'registrations'],
    ['social', 'wechat', 'followers'],
  ]) {
    form.changeSelect(0, category);
    const nodes = form.render();
    assert.deepEqual(nodes.filter(node => node.type === 'select').map(node => node.props.value), [category, platform, metric]);
    const input = nodes.find(node => node.type === 'input' && node.props.value === '')!;
    input.props.onChange({ target: { value: '23' } });
    await form.render().find(node => node.type === 'form')!.props.onSubmit({ preventDefault() {} });
    assert.deepEqual(form.writes.at(-1), { date: '2026-10-17', category, platform, metric, value: 23, notes: '' });
  }
});

test('manual article entry exposes zhihu, cnblogs and legacy wechat with integer input constraints', () => {
  const form = manualForm();
  form.changeSelect(0, 'article');
  const nodes = form.render();
  const platformSelect = nodes.filter(node => node.type === 'select')[1];
  const options = elements(platformSelect.props.children).map(node => node.props.value);
  for (const platform of ['csdn', 'zhihu', 'cnblogs', 'wechat']) assert.ok(options.includes(platform));
  const input = nodes.find(node => node.type === 'input' && node.props.value === '')!;
  assert.equal(input.props.min, 0);
  assert.equal(input.props.step, 1);
});
