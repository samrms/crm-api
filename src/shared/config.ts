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

export class Config {
  readonly port = getEnvInt('PORT', 3000)
  readonly host = getEnv('HOST', '0.0.0.0')
  readonly nodeEnv = getEnv('NODE_ENV', 'development')
  readonly logLevel = getEnv('LOG_LEVEL', 'info')
  readonly isProduction = this.nodeEnv === 'production'

  readonly databaseUrl = getEnv(
    'DATABASE_URL',
    'postgres://postgres:postgres@localhost:5432/crm',
  )
  readonly redisUrl = getEnv('REDIS_URL', 'redis://localhost:6379')
  readonly corsOrigin = getEnv('CORS_ORIGIN', 'http://localhost:5173')

  // Signs JWTs and pagination cursors. Rotating it invalidates every token.
  readonly sessionSecret = getEnv(
    'SESSION_SECRET',
    'dev-session-secret-change-in-production',
  )
  // Short by design: a stateless token cannot be revoked before it expires,
  // so the TTL bounds how long a stolen token stays useful. See ADR 003.
  readonly jwtTtlMinutes = getEnvInt('JWT_TTL_MINUTES', 15)
  readonly storageDir = getEnv('STORAGE_DIR', './storage')

  readonly pagination = {
    defaultLimit: 25,
    maxLimit: 100,
  } as const

  readonly rateLimit = {
    max: getEnvInt('RATE_LIMIT_MAX', 100),
    timeWindow: getEnv('RATE_LIMIT_TIME_WINDOW', '1 minute'),
  } as const
}

export const config = new Config()
