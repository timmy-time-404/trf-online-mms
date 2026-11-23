import { describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';

describe('api skeleton', () => {
  it('reports health', async () => {
    const res = await createApp().request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('rejects an invalid port at startup', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow();
  });
});
