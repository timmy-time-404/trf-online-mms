import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { z } from 'zod';

interface OpenOptions {
  /** Pool size. Scripts keep 1 so session-level advisory locks stay on one connection. */
  max?: number;
  /** Server-side limits so one stuck query or open transaction cannot stall the API. */
  requestTimeouts?: boolean;
}

export const openDatabase = ({ max = 1, requestTimeouts = false }: OpenOptions = {}) => {
  const env = z.object({
    DB_HOST: z.string().min(1),
    DB_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
    DB_NAME: z.string().min(1),
    DB_USER: z.string().min(1),
    DB_PASSWORD_FILE: z.string().min(1),
  }).parse(process.env);
  return postgres({
    host: env.DB_HOST, port: env.DB_PORT, database: env.DB_NAME, username: env.DB_USER,
    password: readFileSync(env.DB_PASSWORD_FILE, 'utf8').trimEnd(),
    max, prepare: false, connect_timeout: 10, idle_timeout: 10,
    connection: requestTimeouts ? {
      statement_timeout: 15_000,
      lock_timeout: 5_000,
      idle_in_transaction_session_timeout: 30_000,
    } : {},
    onnotice: () => {},
  });
};
