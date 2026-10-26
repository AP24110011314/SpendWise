import { z } from 'zod';

// Automatically load local .env if present without crashing when absent in production
try {
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile();
  }
} catch {
  // .env file is not present on disk, which is expected in cloud deployment (Render, Vercel, Docker)
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5001),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  COOKIE_NAME: z.string().default('sw_token'),
  ENABLE_CRON: z.coerce.boolean().default(true),
  RECURRING_CRON: z.string().default('5 0 * * *'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

let config;

export function loadEnv() {
  if (config) return config;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  config = parsed.data;
  return config;
}

export function getEnv() {
  if (!config) loadEnv();
  return config;
}