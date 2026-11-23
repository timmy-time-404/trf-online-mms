import { Hono, type MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { requireRole, requireSession, type AuthEnv } from '../../middleware/auth.ts';
import type { openDatabase } from '../../db/connection.ts';
import { createTRFService } from './service.ts';
import { createWorkflowService } from './workflowService.ts';

export function createTRFRoutes(db: ReturnType<typeof openDatabase>, origin: string) {
  const app = new Hono<AuthEnv>();
  const service = createTRFService(db);
  const workflow = createWorkflowService(db);
  app.use('*', requireSession(db));
  app.use('*', async (c, next) => {
    if (!['GET', 'HEAD'].includes(c.req.method) && c.req.header('Origin') !== origin) return c.json({ message: 'Origin tidak diizinkan.' }, 403);
    await next();
  });
  app.use('*', bodyLimit({ maxSize: 256 * 1024, onError: (c) => c.json({ message: 'Data TRF terlalu besar.' }, 413) }));
  const validateId: MiddlewareHandler<AuthEnv> = async (c, next) => {
    const id = c.req.param('id') ?? '';
    const namedRead = c.req.method === 'GET' && ['context', 'queue'].includes(id) && c.req.path.endsWith('/' + id);
    if (!namedRead && !z.uuid().safeParse(id).success) return c.json({ message: 'ID TRF tidak valid.' }, 400);
    await next();
  };
  app.use('/:id/*', validateId);
  app.use('/:id', validateId);
  const body = async (request: { json: () => Promise<unknown> }) => {
    try { return await request.json(); } catch { throw new HTTPException(400, { message: 'JSON tidak valid.' }); }
  };
  app.get('/', async (c) => c.json(await service.list(c.get('actor'))));
  app.get('/context', async (c) => c.json(await service.context(c.get('actor'))));
  app.get('/queue', async (c) => c.json(await workflow.queue(c.get('actor'))));
  app.get('/:id', async (c) => c.json(await service.detail(c.get('actor'), c.req.param('id'))));
  app.post('/', requireRole('EMPLOYEE', 'SUPER_ADMIN'), async (c) => c.json(await service.create(c.get('actor'), await body(c.req)), 201));
  app.put('/:id', requireRole('EMPLOYEE', 'SUPER_ADMIN'), async (c) => c.json(await service.change(c.get('actor'), c.req.param('id'), await body(c.req), false)));
  app.post('/:id/resubmit', requireRole('EMPLOYEE', 'SUPER_ADMIN'), async (c) => c.json(await service.change(c.get('actor'), c.req.param('id'), await body(c.req), true)));
  app.delete('/:id', async (c) => c.json(await service.remove(c.get('actor'), c.req.param('id'))));
  app.post('/:id/verify', requireRole('ADMIN_DEPT'), async (c) => c.json(await workflow.act(c.get('actor'), c.req.param('id'), 'verify', await body(c.req))));
  app.post('/:id/approve', requireRole('HOD', 'HR', 'PM'), async (c) => c.json(await workflow.act(c.get('actor'), c.req.param('id'), 'approve', await body(c.req))));
  app.post('/:id/reject', requireRole('ADMIN_DEPT', 'HOD', 'HR', 'PM', 'GA', 'SUPER_ADMIN'), async (c) => c.json(await workflow.act(c.get('actor'), c.req.param('id'), 'reject', await body(c.req))));
  app.post('/:id/revise', requireRole('ADMIN_DEPT', 'HOD', 'HR', 'PM', 'GA', 'SUPER_ADMIN'), async (c) => c.json(await workflow.act(c.get('actor'), c.req.param('id'), 'revise', await body(c.req))));
  app.post('/:id/edit-approve', requireRole('HR', 'GA'), async (c) => c.json(await workflow.act(c.get('actor'), c.req.param('id'), 'edit-approve', await body(c.req))));
  app.post('/:id/process', requireRole('GA'), async (c) => c.json(await workflow.act(c.get('actor'), c.req.param('id'), 'process', await body(c.req))));
  app.onError((error, c) => {
    if (error instanceof HTTPException) return c.json({ message: error.message }, error.status);
    console.error('TRF request failed.', error instanceof Error ? error.name : 'UnknownError');
    return c.json({ message: 'Permintaan TRF gagal. Silakan coba kembali.' }, 500);
  });
  return app;
}
