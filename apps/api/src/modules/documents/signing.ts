import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Short-lived download links for WhatsApp attachments. Fonnte fetches the file
 * without a session, so the link itself carries a signed, expiring grant.
 * The grant names the stored file (`path`), so replacing a document revokes old links.
 */
export interface DocumentGrant { trfId: string; key: string; path: string; exp: number }

/** Fonnte fetches the file right after sending; 72 hours covers retries and late opens. */
export const DOCUMENT_LINK_TTL_MS = 72 * 60 * 60 * 1000;

const encode = (value: Buffer | string) => Buffer.from(value).toString('base64url');

export function signGrant(secret: string, grant: DocumentGrant) {
  const payload = encode(JSON.stringify(grant));
  const mac = encode(createHmac('sha256', secret).update(payload).digest());
  return `${payload}.${mac}`;
}

export function verifyGrant(secret: string, token: string, now = Date.now()): DocumentGrant | null {
  const [payload, mac] = token.split('.');
  if (!payload || !mac) return null;
  const expected = createHmac('sha256', secret).update(payload).digest();
  const given = Buffer.from(mac, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const grant = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as DocumentGrant;
    return typeof grant.exp === 'number' && grant.exp > now && typeof grant.path === 'string' ? grant : null;
  } catch {
    return null;
  }
}
