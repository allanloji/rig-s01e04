import type { DigestRow, NightDigest } from './types.js';

function shown(value: string | null): string {
  return value ?? '—';
}

function DigestRowView({ row }: { row: DigestRow }) {
  const flagged = row.retries >= 3 || row.lastStatus === 'fail';

  return (
    <tr>
      <td>{row.job}</td>
      <td>{shown(row.owner)}</td>
      <td>{row.runs}</td>
      <td class={row.retries >= 3 ? 'warn' : undefined}>{row.retries}</td>
      <td class={row.lastStatus === 'fail' ? 'warn' : undefined}>
        {flagged ? <strong>{row.lastStatus}</strong> : row.lastStatus}
      </td>
      <td>{shown(row.lastError)}</td>
      <td>{row.firstTime}</td>
      <td>{row.lastTime}</td>
    </tr>
  );
}

export function DigestPage({ night, digest }: { night: string; digest: NightDigest }) {
  return (
    <>
      <h1>digest · {night}</h1>
      {digest.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first time</th>
              <th>last time</th>
            </tr>
          </thead>
          <tbody>{digest.rows.map((row) => <DigestRowView row={row} />)}</tbody>
        </table>
      )}
      {digest.badLines > 0 && <p class="mute">{digest.badLines} unreadable {digest.badLines === 1 ? 'line' : 'lines'}</p>}
    </>
  );
}
