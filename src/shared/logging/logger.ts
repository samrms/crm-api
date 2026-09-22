import pino from 'pino'
import { config } from '@/shared/config.js'

export const logger = pino({
  level: config.logLevel,
  transport: config.isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard' },
      },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
})
