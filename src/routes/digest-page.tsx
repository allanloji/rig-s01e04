import type { Hono } from 'hono';
import type { RigConfig } from '../config.js';
import { readNight } from '../digest/reader.js';
import { lane } from '../lane.js';
import { Layout } from '../views/layout.js';
import { DigestPage } from '../views/digest.js';

export function registerDigestPage(app: Hono, config: RigConfig): void {
  app.get('/digest/:night', (c) => {
    const digest = readNight(config.runsDir, c.req.param('night'));
    if (digest === null) return c.notFound();

    return c.html(
      <Layout title={`digest · ${c.req.param('night')}`} lane={lane()}>
        <DigestPage night={c.req.param('night')} digest={digest} />
      </Layout>,
    );
  });
}
