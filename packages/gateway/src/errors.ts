// Gateway — Error handling utilities
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

// ============================================================
// Custom Error Classes
// ============================================================

export class ForgeError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ForgeError';
  }
}

export class UnauthorizedError extends ForgeError {
  constructor(message = 'Unauthorized', details?: unknown) {
    super(401, 'UNAUTHORIZED', message, details);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ForgeError {
  constructor(message = 'Forbidden', details?: unknown) {
    super(403, 'FORBIDDEN', message, details);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends ForgeError {
  constructor(message = 'Not found', details?: unknown) {
    super(404, 'NOT_FOUND', message, details);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends ForgeError {
  constructor(message = 'Validation error', details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

export class RateLimitedError extends ForgeError {
  constructor(message = 'Rate limited', details?: unknown) {
    super(429, 'RATE_LIMITED', message, details);
    this.name = 'RateLimitedError';
  }
}

// ============================================================
// Error Handler
// ============================================================

export function errorHandler(
  error: FastifyError | Error,
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  if (error instanceof ForgeError) {
    return reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
  }

  // Fastify validation errors
  if ('validation' in error && error.validation) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.validation,
      },
    });
  }

  // Rate limit errors
  if ('statusCode' in error && (error as FastifyError).statusCode === 429) {
    return reply.status(429).send({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests',
      },
    });
  }

  // Default: internal error
  console.error('Unhandled error:', error);
  return reply.status(500).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
  });
}
