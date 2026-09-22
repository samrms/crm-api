export class AppError extends Error {
  readonly statusCode: number
  readonly code: string

  constructor(opts: { statusCode: number; code: string; message: string }) {
    super(opts.message)
    this.name = this.constructor.name
    this.statusCode = opts.statusCode
    this.code = opts.code
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: id
        ? `${resource} with id ${id} not found`
        : `${resource} not found`,
    })
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super({ statusCode: 409, code: 'CONFLICT', message })
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super({ statusCode: 403, code: 'FORBIDDEN', message })
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super({ statusCode: 401, code: 'UNAUTHORIZED', message })
  }
}

export class ValidationError extends AppError {
  readonly details?: unknown

  constructor(message: string, details?: unknown) {
    super({ statusCode: 422, code: 'VALIDATION_ERROR', message })
    this.details = details
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests') {
    super({ statusCode: 429, code: 'RATE_LIMITED', message })
  }
}

export class OptimisticLockError extends AppError {
  constructor(resource: string) {
    super({
      statusCode: 409,
      code: 'OPTIMISTIC_LOCK_CONFLICT',
      message: `${resource} has been modified by another request. Please retry.`,
    })
  }
}
