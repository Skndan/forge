/// Exception classes for Forge SDK errors.

/// Base exception for all Forge SDK errors.
class ForgeException implements Exception {
  final String code;
  final String message;
  final int? statusCode;
  final dynamic details;

  ForgeException({
    required this.code,
    required this.message,
    this.statusCode,
    this.details,
  });

  @override
  String toString() => 'ForgeException($code): $message';

  // ── Specific factory constructors ─────────────────────────

  factory ForgeException.unauthorized([String message = 'Authentication required']) =>
      ForgeException(code: 'UNAUTHORIZED', message: message, statusCode: 401);

  factory ForgeException.forbidden([String message = 'Access denied']) =>
      ForgeException(code: 'FORBIDDEN', message: message, statusCode: 403);

  factory ForgeException.notFound([String message = 'Resource not found']) =>
      ForgeException(code: 'NOT_FOUND', message: message, statusCode: 404);

  factory ForgeException.validation([String message = 'Validation error']) =>
      ForgeException(code: 'VALIDATION_ERROR', message: message, statusCode: 400);

  factory ForgeException.server([String message = 'Internal server error']) =>
      ForgeException(code: 'INTERNAL_ERROR', message: message, statusCode: 500);

  factory ForgeException.network([String message = 'Network error']) =>
      ForgeException(code: 'NETWORK_ERROR', message: message);

  factory ForgeException.timeout([String message = 'Request timed out']) =>
      ForgeException(code: 'TIMEOUT', message: message);
}

/// Exception for database query errors.
class DatabaseException extends ForgeException {
  final String? query;

  DatabaseException({
    required String code,
    required String message,
    this.query,
    int? statusCode,
  }) : super(code: code, message: message, statusCode: statusCode);

  @override
  String toString() => 'DatabaseException($code): $message${query != null ? '\nQuery: $query' : ''}';
}

/// Exception for storage operation errors.
class StorageException extends ForgeException {
  final String? bucket;
  final String? path;

  StorageException({
    required String code,
    required String message,
    this.bucket,
    this.path,
    int? statusCode,
  }) : super(code: code, message: message, statusCode: statusCode);
}

/// Exception for function invocation errors.
class FunctionException extends ForgeException {
  final String? functionId;

  FunctionException({
    required String code,
    required String message,
    this.functionId,
    int? statusCode,
  }) : super(code: code, message: message, statusCode: statusCode);
}
