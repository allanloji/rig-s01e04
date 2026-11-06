import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

const dirs: string[] = [];
function fixture(text: string) {
  const dir = mkdtempSync(join(tmpdir(), 'rig-reader-'));
  dirs.push(dir);
  writeFileSync(join(dir, '2026-10-28.jsonl'), text);
  return dir;
}
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true }); });

describe('night reader', () => {
  it('aggregates the real night without dropping the null owner', () => {
    const digest = readNight('runs', '2026-10-28');
    expect(digest?.badLines).toBe(1);
    expect(digest?.rows.map(row => row.job)).toEqual([
      'digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs',
    ]);
    expect(digest?.rows[0].owner).toBeNull();
    expect(digest?.rows[1]).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: 'upstream 503', firstTime: '2026-10-29T01:30:00+01:00', lastTime: '2026-10-29T01:37:00+01:00' });
    expect(digest?.rows[3]).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
  });

  it('distinguishes empty, missing and malformed nights', () => {
    expect(readNight(fixture(''), '2026-10-28')).toEqual({ rows: [], badLines: 0 });
    expect(readNight(fixture(''), '2026-10-29')).toBeNull();
    expect(readNight(fixture('{}\nnull\ninvalid\n'), '2026-10-28')).toEqual({ rows: [], badLines: 3 });
    expect(readNight('runs', '../2026-10-28')).toBeNull();
  });

  it('uses chronological first and last times while preserving their offsets', () => {
    const values = [
      { at: '2026-10-28T12:00:00+02:00', status: 'ok', owner: 'new' },
      { at: '2026-10-28T08:00:00+00:00', status: 'retry', owner: 'old', error: 'timeout' },
    ].map(value => JSON.stringify({ job: 'job', ...value })).join('\n');
    expect(readNight(fixture(values), '2026-10-28')?.rows[0]).toMatchObject({
      firstTime: '2026-10-28T08:00:00+00:00', lastTime: '2026-10-28T12:00:00+02:00',
      lastStatus: 'ok', owner: 'new', runs: 2, retries: 1,
    });
  });
});
