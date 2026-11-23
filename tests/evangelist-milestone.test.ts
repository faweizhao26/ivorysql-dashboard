import assert from 'node:assert/strict';
import test from 'node:test';
import { firstQualificationDate } from '../src/lib/evangelist-milestone';

const score = (date: string | null, points: number) => ({ date, points });
test('uses earned dates, counts same-day points together and never resets at a new year', () => {
  const history = [score('2026-02-01', 250), score('2026-01-03', 40), score('2025-12-31', 50), score('2026-01-03', 10)];
  assert.equal(firstQualificationDate(history), '2026-01-03');
  assert.equal(firstQualificationDate([...history, score('2025-12-30', 50)]), '2025-12-31');
  assert.equal(firstQualificationDate(history.filter(r => r.points !== 40)), '2026-02-01');
  assert.equal(firstQualificationDate([score('2026-01-03', 99)]), null);
});
test('missing dates never receive a guessed day but harmless missing dates do not mask a certain first crossing', () => {
  const dated = [score('2026-08-10', 98), score('2026-09-10', 15)];
  assert.equal(firstQualificationDate([...dated, score(null, 20)]), null);
  assert.equal(firstQualificationDate([...dated, score('2026-02-30', 20)]), null);
  assert.equal(firstQualificationDate([...dated, score(null, 1)]), '2026-09-10');
  assert.equal(firstQualificationDate([score(null, 100)]), null);
  assert.equal(firstQualificationDate([]), null);
});
