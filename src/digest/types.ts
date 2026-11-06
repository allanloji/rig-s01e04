export type RunStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  firstTime: string;
  lastTime: string;
};

export type NightDigest = { rows: DigestRow[]; badLines: number };

/** Missing nights return null; empty nights return an empty rows array. */
export type ReadNight = (runsDir: string, night: string) => NightDigest | null;
