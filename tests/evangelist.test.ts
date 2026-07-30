import assert from 'node:assert/strict';
import test from 'node:test';

test('other contribution category includes an other type', async () => {
  const adminPage = await import('../src/app/admin/page') as typeof import('../src/app/admin/page') & {
    evangelistContributionTypes?: Record<string, string[]>;
  };

  assert.equal(adminPage.evangelistContributionTypes?.['其他']?.at(-1), '其他');
});
