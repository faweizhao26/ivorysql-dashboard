import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const adminPageSource = readFileSync(
  new URL('../src/app/admin/page.tsx', import.meta.url),
  'utf8'
);

test('other contribution category includes an other type', async () => {
  const adminPage = await import('../src/app/admin/page') as typeof import('../src/app/admin/page') & {
    evangelistContributionTypes?: Record<string, string[]>;
  };

  assert.equal(adminPage.evangelistContributionTypes?.['其他']?.at(-1), '其他');
});

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
