import { readFileSync, readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightOnDisk[];
};

export type EventCounts = { ok: number; retry: number; fail: number };
export type NightOnDisk = { night: string; counts: EventCounts };

const emptyCounts = (): EventCounts => ({ ok: 0, retry: 0, fail: 0 });

// Count valid log events, rather than each job's final status. Malformed lines
// are ignored here just as they are by the digest reader.
export function countNightEvents(runsDir: string, night: string): EventCounts {
  const counts = emptyCounts();
  const content = readFileSync(`${runsDir}/${night}.jsonl`, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof event !== 'object' || event === null || Array.isArray(event)) continue;
    const record = event as Record<string, unknown>;
    if (
      typeof record.at !== 'string' ||
      !Number.isFinite(Date.parse(record.at)) ||
      typeof record.job !== 'string' ||
      record.job.trim().length === 0 ||
      (record.owner !== null && typeof record.owner !== 'string') ||
      (record.error !== undefined && typeof record.error !== 'string') ||
      (record.status !== 'ok' && record.status !== 'retry' && record.status !== 'fail')
    ) continue;
    counts[record.status] += 1;
  }
  return counts;
}

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((night) => ({
      night,
      counts: countNightEvents(config.runsDir, night),
    })),
  };
}
