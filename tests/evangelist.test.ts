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

test('content creation includes self-published IvorySQL articles', async () => {
  const adminPage = await import('../src/app/admin/page') as typeof import('../src/app/admin/page') & {
    evangelistContributionTypes?: Record<string, string[]>;
  };

  assert.ok(
    adminPage.evangelistContributionTypes?.['内容创作']?.includes(
      '自己渠道首发 IvorySQL 文章（15 分）',
    ),
  );
});

test('generates stable monochrome short-haired Open Peeps options per evangelist', async () => {
  const {
    getEvangelistAvatarOptions,
  } = await import('../src/lib/evangelist-avatar');

  const first = getEvangelistAvatarOptions(7, '测试用户');
  assert.deepEqual(first, getEvangelistAvatarOptions(7, '测试用户'));
  assert.notDeepEqual(first, getEvangelistAvatarOptions(8, '测试用户'));
  assert.equal(first.seed, 'ivorysql-evangelist-7');

  const allowedShortHeads = new Set([
    'flatTop',
    'grayShort',
    'mohawk',
    'noHair1',
    'noHair2',
    'noHair3',
    'pomp',
    'shaved1',
    'shaved2',
    'short1',
    'short2',
    'short3',
    'short4',
    'short5',
  ]);
  const variants = Array.from({ length: 24 }, (_, id) =>
    getEvangelistAvatarOptions(id, `测试用户${id}`),
  );

  assert.ok(new Set(variants.map(({ headVariant }) => headVariant)).size >= 12);
  for (const options of variants) {
    assert.ok(allowedShortHeads.has(options.headVariant));
    assert.equal(options.skinColor, 'ffffff');
    assert.equal(options.clothingColor, 'ffffff');
    assert.equal(options.headContrastColor, '000000');
    assert.equal(options.inkColor, '000000');
    assert.equal(options.backgroundColor, 'ffffff');
    assert.equal(options.accessoriesProbability, 0);
    assert.equal(options.maskProbability, 0);
  }

  assert.equal(getEvangelistAvatarOptions(7, '傅超').facialHairProbability, 0);
  assert.equal(getEvangelistAvatarOptions(7, '付超').facialHairProbability, 0);
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
