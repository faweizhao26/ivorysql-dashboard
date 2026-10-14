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

test('provides distinct stable defaults and honors manually selected avatars', async () => {
  const avatars = await import('../src/lib/evangelist-avatar');
  assert.equal(typeof avatars.getEvangelistAvatar, 'function');
  assert.equal(avatars.EVANGELIST_AVATARS.length, 36);
  const defaults = Array.from({ length: 36 }, (_, index) => avatars.getEvangelistAvatar(index + 1).url);
  assert.equal(new Set(defaults).size, 36);
  assert.equal(avatars.getEvangelistAvatar(7).url, avatars.getEvangelistAvatar(7).url);
  assert.equal(avatars.getEvangelistAvatar(7, avatars.EVANGELIST_AVATARS[20].url).index, 20);
  assert.equal(avatars.getEvangelistAvatar(1).position, '0% 0%');
  assert.equal(new Set(avatars.EVANGELIST_AVATARS.map(avatar => avatar.position)).size, 36);
  for (let start = 0; start < 36; start += 6) {
    const positions = avatars.EVANGELIST_AVATARS.slice(start, start + 6).map(avatar => avatar.position.split(' '));
    assert.equal(new Set(positions.map(position => position[0])).size, 6);
    assert.equal(new Set(positions.map(position => position[1])).size, 6);
  }
});

test('new members prefer an avatar unused by legacy or manually configured members', async () => {
  const avatars = await import('../src/lib/evangelist-avatar');
  assert.equal(typeof avatars.getAvailableEvangelistAvatar, 'function');
  const people = [{ id: 1, avatar_url: null }, { id: 3, avatar_url: null }, { id: 2, avatar_url: avatars.EVANGELIST_AVATARS[8].url }];
  assert.equal(avatars.getAvailableEvangelistAvatar(people), avatars.EVANGELIST_AVATARS[1].url);
  const full = avatars.EVANGELIST_AVATARS.map((avatar, index) => ({ id: index + 1, avatar_url: avatar.url }));
  assert.ok(avatars.getAvailableEvangelistAvatar(full));
});

test('avatar input accepts only the reviewed library, with legacy fallback on display', async () => {
  const avatars = await import('../src/lib/evangelist-avatar');
  assert.equal(typeof avatars.normalizeEvangelistAvatarUrl, 'function');
  assert.equal(avatars.normalizeEvangelistAvatarUrl(null), null);
  assert.equal(avatars.normalizeEvangelistAvatarUrl(avatars.EVANGELIST_AVATARS[1].url), avatars.EVANGELIST_AVATARS[1].url);
  for (const value of ['javascript:alert(1)', 'https://example.com/female.png', '/avatars/ivorysql-line-men.png#99', {}, 1]) {
    assert.throws(() => avatars.normalizeEvangelistAvatarUrl(value), RangeError);
  }
  assert.equal(avatars.getEvangelistAvatar(8, 'https://example.com/old.png').url, avatars.getEvangelistAvatar(8).url);
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
