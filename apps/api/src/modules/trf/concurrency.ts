import { HTTPException } from 'hono/http-exception';
export const etag = (version: number) => `"${version}"`;
export function expectedVersion(header: string | undefined) {
  if (!header) throw new HTTPException(428, { message: 'If-Match wajib diisi.' });
  if (!/^"\d+"$/.test(header)) throw new HTTPException(400, { message: 'If-Match tidak valid.' });
  return Number(header.slice(1,-1));
}
export function assertVersion(version: number, expected: number) {
  if (version!==expected) throw new HTTPException(409, { message: 'Data sudah diubah orang lain, muat ulang.' });
}
