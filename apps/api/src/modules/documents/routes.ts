import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { protectedRoutes, uuid, type Database } from '../../http.ts';
import * as repo from '../trf/repository.ts';
import { canSeeTRF } from '../trf/policy.ts';
import { assertVersion, etag, expectedVersion } from '../trf/concurrency.ts';
import type { FileStorage } from './storage.ts';
import { verifyGrant } from './signing.ts';

/** Document slots offered on the GA process dialog. */
export const GA_DOCUMENT_KEYS = ['hotelVoucher', 'flightTicket', 'shipTicket'] as const;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

const TYPES = [
  { ext: 'pdf', mime: 'application/pdf', magic: [0x25, 0x50, 0x44, 0x46] },
  { ext: 'png', mime: 'image/png', magic: [0x89, 0x50, 0x4e, 0x47] },
  { ext: 'jpg', mime: 'image/jpeg', magic: [0xff, 0xd8, 0xff] },
];

// Trust the file content, not the client-provided name or MIME type.
const detectType = (bytes: Uint8Array) => TYPES.find((t) => t.magic.every((b, i) => bytes[i] === b));

const documentKey = (value: string) => {
  if (!(GA_DOCUMENT_KEYS as readonly string[]).includes(value)) throw new HTTPException(400, { message: 'Jenis dokumen tidak dikenal.' });
  return value;
};

interface StoredDocument { name: string; url: string; path: string; contentType: string; size: number; uploadedAt: string; uploadedBy: string }
const docsOf = (row: repo.TrfRow) => (row.ga_documents ?? {}) as Record<string, StoredDocument | string>;
const safeName = (name: string) => name.replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'document';

async function sendFile(storage: FileStorage, doc: StoredDocument) {
  const bytes = await storage.get(doc.path);
  return new Response(bytes, { headers: {
    'Content-Type': doc.contentType,
    'Content-Disposition': `attachment; filename="${safeName(doc.name)}"`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  } });
}

export function createDocumentRoutes(db: Database, origin: string, storage: FileStorage) {
  const app = protectedRoutes(db, origin, undefined, MAX_DOCUMENT_BYTES + 64 * 1024);

  app.get('/:trfId/:key', async (c) => {
    const row = await repo.findRow(db, uuid(c.req.param('trfId')));
    if (!row || !canSeeTRF(c.get('actor'), row)) throw new HTTPException(404, { message: 'TRF tidak ditemukan.' });
    const doc = docsOf(row)[documentKey(c.req.param('key'))];
    if (!doc || typeof doc === 'string' || !doc.path) throw new HTTPException(404, { message: 'Dokumen tidak ditemukan.' });
    return sendFile(storage, doc);
  });

  // Only GA uploads, and only while the TRF waits for GA processing.
  const change = async (actor: { id: string; role: string; displayName: string }, trfId: string, key: string,
    expected: number, file?: File) => {
    let added: string | undefined;
    let removed: string | undefined;
    try {
      const row = await db.begin(async (tx) => {
        const current = await repo.findRow(tx, trfId, true);
        if (!current) throw new HTTPException(404, { message: 'TRF tidak ditemukan.' });
        if (actor.role !== 'GA') throw new HTTPException(403, { message: 'Hanya GA yang dapat mengelola dokumen.' });
        if (current.status !== 'PM_APPROVED') throw new HTTPException(409, { message: 'Dokumen hanya dapat diubah saat TRF menunggu proses GA.' });
        assertVersion(current.version, expected);
        const docs = docsOf(current);
        const previous = docs[key];
        if (previous && typeof previous !== 'string') removed = previous.path;
        if (file) {
          const bytes = new Uint8Array(await file.arrayBuffer());
          if (bytes.length === 0 || bytes.length > MAX_DOCUMENT_BYTES) throw new HTTPException(400, { message: 'Ukuran dokumen harus 1 byte sampai 10 MB.' });
          const type = detectType(bytes);
          if (!type) throw new HTTPException(400, { message: 'Format dokumen harus PDF, PNG, atau JPG.' });
          added = `${current.id}/${randomUUID()}.${type.ext}`;
          await storage.put(added, bytes);
          docs[key] = { name: safeName(file.name), url: `/api/trf-documents/${current.id}/${key}`, path: added,
            contentType: type.mime, size: bytes.length, uploadedAt: new Date().toISOString(), uploadedBy: actor.displayName };
        } else {
          if (!previous) throw new HTTPException(404, { message: 'Dokumen tidak ditemukan.' });
          delete docs[key];
        }
        const [changed] = await tx<repo.TrfRow[]>`update public.trfs set ga_documents=${tx.json(docs as never)}
          where id=${current.id} and version=${current.version} returning id`;
        if (!changed) throw new HTTPException(409, { message: 'Data sudah diubah orang lain, muat ulang.' });
        return (await repo.findRow(tx, current.id))!;
      });
      // The old file is removed only after the new reference is committed.
      if (removed) await storage.remove(removed).catch(() => undefined);
      return row;
    } catch (error) {
      if (added) await storage.remove(added).catch(() => undefined);
      throw error;
    }
  };

  app.post('/:trfId/:key', async (c) => {
    const key = documentKey(c.req.param('key'));
    const form = await c.req.formData().catch(() => { throw new HTTPException(400, { message: 'Form upload tidak valid.' }); });
    const file = form.get('file');
    if (!(file instanceof File)) throw new HTTPException(400, { message: 'File wajib diunggah.' });
    const row = await change(c.get('actor'), uuid(c.req.param('trfId')), key, expectedVersion(c.req.header('If-Match')), file);
    c.header('ETag', etag(row.version));
    return c.json(repo.trfDTO(row), 201);
  });

  app.delete('/:trfId/:key', async (c) => {
    const row = await change(c.get('actor'), uuid(c.req.param('trfId')), documentKey(c.req.param('key')),
      expectedVersion(c.req.header('If-Match')));
    c.header('ETag', etag(row.version));
    return c.json(repo.trfDTO(row));
  });

  return app;
}

/** Session-less, signed and expiring download used for WhatsApp attachments. */
export function createPublicDocumentRoutes(db: Database, storage: FileStorage, secret: string) {
  const app = new Hono();
  app.get('/:token', async (c) => {
    const grant = verifyGrant(secret, c.req.param('token'));
    if (!grant) return c.json({ message: 'Tautan tidak valid atau kedaluwarsa.' }, 404);
    const row = await repo.findRow(db, grant.trfId);
    const doc = row ? docsOf(row)[grant.key] : undefined;
    if (!doc || typeof doc === 'string' || !doc.path) return c.json({ message: 'Dokumen tidak ditemukan.' }, 404);
    return sendFile(storage, doc);
  });
  return app;
}
