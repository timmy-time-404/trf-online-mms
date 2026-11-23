import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';

const config = loadConfig();

serve({ fetch: createApp().fetch, port: config.PORT }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});
