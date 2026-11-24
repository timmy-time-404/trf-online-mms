import { z } from 'zod';

/** Environment is validated once at startup so misconfiguration fails fast. */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
});

export type Config = z.infer<typeof envSchema>;

// API_PORT wins over PORT so local tooling that injects PORT (e.g. for Vite) cannot move the API.
export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config =>
  envSchema.parse({ ...env, PORT: env.API_PORT ?? env.PORT });
