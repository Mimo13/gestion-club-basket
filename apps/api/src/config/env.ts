import path from 'node:path'
import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config({ path: process.env.ENV_FILE ?? path.resolve(process.cwd(), '../../.env') })

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1),
  STORAGE_ROOT: z.string().default('./var/storage'),
  SESSION_SECRET: z.string().min(16),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
})

export const env = envSchema.parse(process.env)
