import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { z } from 'zod';

export const openDatabase = () => {
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
    max: 1, prepare: false, connect_timeout: 10, idle_timeout: 10,
    onnotice: () => {},
  });
};
