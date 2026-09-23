function getEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

function getEnvInt(key: string, fallback: number): number {
  const raw = process.env[key]
  if (raw === undefined) return fallback
  const parsed = parseInt(raw, 10)
  if (isNaN(parsed)) {
    throw new Error(
      `Environment variable ${key} must be an integer, got: ${raw}`,
    )
  }
  return parsed
}

export const config = {
  port: getEnvInt('PORT', 3000),
  host: getEnv('HOST', '0.0.0.0'),
  nodeEnv: getEnv('NODE_ENV', 'development'),
  logLevel: getEnv('LOG_LEVEL', 'info'),
  isProduction: getEnv('NODE_ENV', 'development') === 'production',

  databaseUrl: getEnv(
    'DATABASE_URL',
  ),

  sessionSecret: getEnv(
    'SESSION_SECRET',
    'dev-session-secret-change-in-production',
  ),
  sessionMaxAgeDays: getEnvInt('SESSION_MAX_AGE_DAYS', 30),
  storageDir: getEnv('STORAGE_DIR', './storage'),

  pagination: {
    defaultLimit: 25,
    maxLimit: 100,
  },

  rateLimit: {
    max: getEnvInt('RATE_LIMIT_MAX', 100),
    timeWindow: getEnv('RATE_LIMIT_TIME_WINDOW', '1 minute'),
  },
} as const
