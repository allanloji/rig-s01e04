import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, ReadNight, RunStatus } from './types.js';

type Run = { at: string; job: string; status: RunStatus; owner: string | null; error?: string };

function isRun(value: unknown): value is Run {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.at === 'string' && Number.isFinite(Date.parse(row.at)) &&
    typeof row.job === 'string' && row.job.length > 0 &&
    (row.status === 'ok' || row.status === 'retry' || row.status === 'fail') &&
    (row.owner === null || typeof row.owner === 'string') &&
    (row.error === undefined || typeof row.error === 'string');
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
  const jobs = new Map<string, DigestRow>();
  const errorTimes = new Map<string, number>();
  let badLines = 0;
  const lines = text.split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();
  for (const line of lines) {
    let value: unknown;
    try { value = JSON.parse(line); } catch { badLines++; continue; }
    if (!isRun(value)) { badLines++; continue; }
    const previous = jobs.get(value.job);
    if (!previous) {
      if (value.error !== undefined) errorTimes.set(value.job, Date.parse(value.at));
      jobs.set(value.job, {
        job: value.job, owner: value.owner, runs: 1,
        retries: value.status === 'retry' ? 1 : 0,
        lastStatus: value.status, lastError: value.error ?? null,
        firstTime: value.at, lastTime: value.at,
      });
      continue;
    }
    previous.runs++;
    if (value.status === 'retry') previous.retries++;
    if (Date.parse(value.at) < Date.parse(previous.firstTime)) previous.firstTime = value.at;
    if (Date.parse(value.at) >= Date.parse(previous.lastTime)) {
      previous.lastTime = value.at;
      previous.lastStatus = value.status;
      previous.owner = value.owner;
    }
    // Keep the latest reported error even if a later successful run omits it.
    if (value.error !== undefined && Date.parse(value.at) >= (errorTimes.get(value.job) ?? -Infinity)) {
      previous.lastError = value.error;
      errorTimes.set(value.job, Date.parse(value.at));
    }
  }
  return { rows: [...jobs.values()].sort((a, b) => a.job < b.job ? -1 : a.job > b.job ? 1 : 0), badLines };
};
