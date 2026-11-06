import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { NightDigest } from '../src/digest/types.js';

const dirs: string[] = [];
function appWithNight(text: string) {
  const runsDir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
  dirs.push(runsDir);
  writeFileSync(join(runsDir, '2026-10-28.jsonl'), text);
  return createApp({ adapter: 'test', installed: 'test', beatEverySeconds: 60, runsDir });
}
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true }); });

const normalNight = [
  { at: '2026-10-28T08:00:00+01:00', job: 'zebra', status: 'fail', owner: null, error: 'no disk' },
  ...[0, 1, 2].map(minute => ({ at: `2026-10-28T09:0${minute}:00+01:00`, job: 'alpha', status: 'retry', owner: 'rook' })),
].map(row => JSON.stringify(row)).join('\n');

describe('digest routes', () => {
  it('renders sorted rows with JSON parity and warning states', async () => {
    const app = appWithNight(normalNight);
    const page = await app.request('/digest/2026-10-28');
    const json = await app.request('/api/digest/2026-10-28');
    expect(page.status).toBe(200);
    expect(json.status).toBe(200);
    expect(page.headers.get('content-type')).toContain('text/html');
    expect(json.headers.get('content-type')).toContain('application/json');
    const html = await page.text();
    const data = await json.json() as NightDigest;
    expect(data.badLines).toBe(0);
    expect(data.rows.map(row => row.job)).toEqual(['alpha', 'zebra']);
    expect(html.indexOf('alpha')).toBeLessThan(html.indexOf('zebra'));
    for (const row of data.rows) {
      expect(html).toContain(row.job);
      expect(html).toContain(row.lastStatus);
      expect(html).toContain(row.firstTime);
      expect(html).toContain(row.lastTime);
    }
    expect(html).toContain('—');
    expect(html).toContain('no disk');
    expect(html).toContain('warn');
    expect(html).not.toContain('<script');
  });

  it('returns 404 for a missing night in both representations', async () => {
    const app = appWithNight(normalNight);
    for (const prefix of ['/digest', '/api/digest']) {
      expect((await app.request(`${prefix}/2026-10-29`)).status).toBe(404);
    }
  });

  it('keeps an empty night distinct from a missing night', async () => {
    const app = appWithNight('');
    const page = await app.request('/digest/2026-10-28');
    const json = await app.request('/api/digest/2026-10-28');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    expect(json.status).toBe(200);
    expect(await json.json()).toEqual({ rows: [], badLines: 0 });
  });

  it('renders valid jobs despite a malformed line and reports the count', async () => {
    const app = appWithNight(`${normalNight}\nnot json\n`);
    const page = await app.request('/digest/2026-10-28');
    const json = await app.request('/api/digest/2026-10-28');
    expect(page.status).toBe(200);
    expect(json.status).toBe(200);
    const html = await page.text();
    const data = await json.json() as NightDigest;
    expect(data.badLines).toBe(1);
    expect(data.rows.map(row => row.job)).toEqual(['alpha', 'zebra']);
    expect(html).toContain('alpha');
    expect(html).toContain('zebra');
    expect(html).toMatch(/1[^<]*(?:bad|malformed)|(?:bad|malformed)[^<]*1/i);
  });
});
