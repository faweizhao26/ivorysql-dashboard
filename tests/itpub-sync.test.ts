import assert from 'node:assert/strict';
import test from 'node:test';
import { parseItpubArticles } from '../src/lib/itpub-sync';

function card(metric: string) {
  return `<li class="list-item"><a href="/123/viewspace-456/"><p class="title">Article</p></a>
    ${metric}<time>2026-10-15</time></li>`;
}

for (const metric of [
  '', '<span class="icon-browse">--</span>', '<span>浏览 unknown</span>',
  '<span class="icon-browse">0unknown</span>', '<span>浏览 0unknown</span>',
  '<span class="icon-browse">0.5</span>', '<span class="icon-browse">0,</span>',
]) {
  test(`ITPUB leaves missing or malformed views unknown: ${metric || 'missing'}`, () => {
    assert.equal(parseItpubArticles(card(metric))[0].views, undefined);
  });
}

for (const metric of ['<span class="icon-browse">0</span>', '<span>浏览 0</span>']) {
  test(`ITPUB retains a genuine zero: ${metric}`, () => {
    assert.equal(parseItpubArticles(card(metric))[0].views, 0);
  });
}
