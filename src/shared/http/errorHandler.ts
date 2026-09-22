import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { AppError } from '@/shared/errors/AppError.js'
import { logger } from '@/shared/logging/logger.js'

export async function errorHandlerPlugin(app: FastifyInstance): Promise<void> {
  app.setErrorHandler(
    (
      error: Error & { statusCode?: number; validation?: unknown },
      request: FastifyRequest,
      reply: FastifyReply,
    ) => {
      const requestId = request.id

      if (error instanceof AppError) {
        const payload: Record<string, unknown> = {
          error: {
            code: error.code,
            message: error.message,
            requestId,
          },
        }
        if ('details' in error && error.details !== undefined) {
          const body = payload.error as Record<string, unknown>
          body.details = error.details
        }
        return reply.status(error.statusCode).send(payload)
      }

      if (error.validation) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            requestId,
            details: error.validation,
          },
        })
      }

      if (error.statusCode === 429) {
        return reply.status(429).send({
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests',
            requestId,
          },
        })
      }

      logger.error({ err: error, requestId }, 'Unhandled error')

      return reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          requestId,
        },
      })
    },
  )
}
