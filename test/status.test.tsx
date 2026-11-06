import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
import { countNightEvents } from '../src/status.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('status board', () => {
  it('counts only events that pass the digest reader validation', () => {
    const runsDir = mkdtempSync(join(tmpdir(), 'rig-status-'));
    try {
      writeFileSync(join(runsDir, '2026-10-28.jsonl'), [
        JSON.stringify({ at: '2026-10-28T01:00:00+01:00', job: 'good', status: 'ok', owner: null }),
        JSON.stringify({ at: 'not-a-date', job: 'bad-date', status: 'ok', owner: null }),
        JSON.stringify({ at: '2026-10-28T01:00:00+01:00', job: '  ', status: 'retry', owner: null }),
        JSON.stringify({ at: '2026-10-28T01:00:00+01:00', job: 'bad-error', status: 'fail', owner: null, error: 5 }),
      ].join('\n'));

      expect(countNightEvents(runsDir, '2026-10-28')).toEqual({ ok: 1, retry: 0, fail: 0 });
    } finally {
      rmSync(runsDir, { recursive: true, force: true });
    }
  });

  it('shows the lane banner and the nights on disk', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await createApp(config).request('/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('2026-10-28');
    expect(html).toContain('href="/digest/2026-10-28"');
    expect(html).toContain('10 ok · 4 retry · 1 fail');
  });

  it('health answers with the lane id', async () => {
    const res = await createApp(config).request('/health');
    expect(await res.json()).toEqual({ ok: true, lane: 'lane-07' });
  });
});
