import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const adminPageSource = readFileSync(
  new URL('../src/app/admin/page.tsx', import.meta.url),
  'utf8'
);

interface LimitContribution {
  id?: number;
  type?: string;
  points?: number;
  date?: string | null;
}

interface LimitStatus {
  currentPoints: number;
  draftPoints: number;
  projectedPoints: number;
  limit: number;
  exceededBy: number;
}

async function loadLimitCalculator() {
  const adminPage = await import('../src/app/admin/page') as typeof import('../src/app/admin/page') & {
    calculateEvangelistContributionLimit?: (
      contributions: LimitContribution[],
      draft: LimitContribution,
      year?: number
    ) => LimitStatus | null;
  };

  assert.equal(typeof adminPage.calculateEvangelistContributionLimit, 'function');
  return adminPage.calculateEvangelistContributionLimit;
}

test('other contribution category includes an other type', async () => {
  const adminPage = await import('../src/app/admin/page') as typeof import('../src/app/admin/page') & {
    evangelistContributionTypes?: Record<string, string[]>;
  };

  assert.equal(adminPage.evangelistContributionTypes?.['其他']?.at(-1), '其他');
});

test('generates stable local Multiavatar seeds per evangelist', async () => {
  const {
    getEvangelistAvatarSeed,
    getEvangelistAvatarVariant,
  } = await import('../src/lib/evangelist-avatar');

  assert.equal(getEvangelistAvatarSeed(7), getEvangelistAvatarSeed(7));
  assert.notEqual(getEvangelistAvatarSeed(7), getEvangelistAvatarSeed(8));
  assert.match(getEvangelistAvatarSeed(7), /^ivorysql-evangelist-7$/);

  assert.deepEqual(getEvangelistAvatarVariant(7), { part: '04', theme: 'B' });
  assert.deepEqual(getEvangelistAvatarVariant(8), { part: '04', theme: 'C' });
  assert.equal(getEvangelistAvatarVariant(9).part, '04');
});

test('contribution editor is rendered as a fixed accessible drawer', () => {
  assert.match(adminPageSource, /role="dialog"/);
  assert.match(adminPageSource, /aria-modal="true"/);
  assert.match(adminPageSource, /fixed inset-0 z-50/);
  assert.match(adminPageSource, /max-w-\[960px\]/);
  assert.match(adminPageSource, /当前成员/);
  assert.match(adminPageSource, /已有贡献/);
  assert.match(adminPageSource, /新增贡献/);
  assert.match(adminPageSource, /保存后将超出/);
});

test('contribution drawer supports Escape and background scroll locking', () => {
  assert.match(adminPageSource, /event\.key === 'Escape'/);
  assert.match(adminPageSource, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(adminPageSource, /document\.body\.style\.overflow = previousOverflow/);
});

test('warns only when a capped type exceeds its 2026 annual limit', async () => {
  const calculateLimit = await loadLimitCalculator();
  const contributions = [
    { id: 1, type: '宣传社区活动(5/次·上限30)', points: 25, date: '2026-04-01' },
  ];

  assert.deepEqual(
    calculateLimit?.(contributions, {
      type: '宣传社区活动(5/次·上限30)',
      points: 10,
      date: '2026-08-03',
    }),
    { currentPoints: 25, draftPoints: 10, projectedPoints: 35, limit: 30, exceededBy: 5 }
  );
});

test('does not mark a capped type as exceeded when it exactly reaches the limit', async () => {
  const calculateLimit = await loadLimitCalculator();
  const status = calculateLimit?.(
    [{ id: 1, type: '转载官方动态(10/篇·上限30)', points: 20, date: null }],
    { type: '转载官方动态(10/篇·上限30)', points: 10, date: '' }
  );

  assert.equal(status?.exceededBy, 0);
});

test('excludes the edited record from its projected annual total', async () => {
  const calculateLimit = await loadLimitCalculator();
  const status = calculateLimit?.(
    [
      { id: 1, type: '转发官方动态(3/次·上限21)', points: 12, date: '2026-01-01' },
      { id: 2, type: '转发官方动态(3/次·上限21)', points: 6, date: '2026-02-01' },
    ],
    { id: 2, type: '转发官方动态(3/次·上限21)', points: 12, date: '2026-02-01' }
  );

  assert.deepEqual(status, {
    currentPoints: 12,
    draftPoints: 12,
    projectedPoints: 24,
    limit: 21,
    exceededBy: 3,
  });
});

test('ignores other types and years and returns null for uncapped drafts', async () => {
  const calculateLimit = await loadLimitCalculator();
  const contributions = [
    { id: 1, type: '宣传社区活动(5/次·上限30)', points: 30, date: '2025-12-31' },
    { id: 2, type: '内容被公众号转载(10)', points: 30, date: '2026-01-01' },
  ];

  assert.equal(calculateLimit?.(contributions, {
    type: '宣传社区活动(5/次·上限30)',
    points: 5,
    date: '2025-08-03',
  }), null);
  assert.equal(calculateLimit?.(contributions, {
    type: '内容被公众号转载(10)',
    points: 10,
    date: '2026-08-03',
  }), null);
});
