/// Error handling and automatic retry logic.

import 'package:dio/dio.dart';
import 'forge_exception.dart';

class ErrorHandler {
  /// Converts Dio errors to typed Forge exceptions.
  static ForgeException handleDioException(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return ForgeException.timeout(e.message ?? 'Request timed out');

      case DioExceptionType.connectionError:
        return ForgeException.network(
          'Unable to connect to server: ${e.message}',
        );

      case DioExceptionType.badResponse:
        final statusCode = e.response?.statusCode ?? 0;
        final body = e.response?.data;

        // Try to extract error details from Forge API format
        String code = 'UNKNOWN';
        String message = 'Request failed';

        if (body is Map<String, dynamic>) {
          if (body['error'] is Map<String, dynamic>) {
            code = body['error']['code'] ?? code;
            message = body['error']['message'] ?? message;
          } else if (body['message'] is String) {
            message = body['message'];
          }
        }

        return ForgeException(
          code: code,
          message: message,
          statusCode: statusCode,
          details: body,
        );

      case DioExceptionType.cancel:
        return ForgeException(
          code: 'CANCELLED',
          message: 'Request was cancelled',
        );

      default:
        return ForgeException.server(
          e.message ?? 'An unexpected error occurred',
        );
    }
  }

  /// Retry configuration.
  static const int defaultMaxRetries = 3;
  static const Duration defaultBaseDelay = Duration(seconds: 1);
  static const Duration defaultMaxDelay = Duration(seconds: 10);

  /// Execute a function with automatic retry on failure.
  ///
  /// [operation] — the async function to retry.
  /// [maxRetries] — maximum number of retry attempts (default 3).
  /// [baseDelay] — initial delay before first retry (default 1s).
  /// [maxDelay] — maximum delay cap (default 10s).
  /// [retryOn] — optional predicate to determine if retry should happen.
  static Future<T> withRetry<T>({
    required Future<T> Function() operation,
    int maxRetries = defaultMaxRetries,
    Duration baseDelay = defaultBaseDelay,
    Duration maxDelay = defaultMaxDelay,
    bool Function(ForgeException)? retryOn,
  }) async {
    int attempt = 0;

    while (true) {
      try {
        return await operation();
      } on ForgeException catch (e) {
        attempt++;

        // Check if we should retry
        if (attempt > maxRetries) rethrow;
        if (retryOn != null && !retryOn(e)) rethrow;

        // Don't retry client errors (4xx) except 429
        if (e.statusCode != null && e.statusCode! >= 400 && e.statusCode! < 500 && e.statusCode != 429) {
          rethrow;
        }

        // Exponential backoff with jitter
        final delayMs = (baseDelay.inMilliseconds * (1 << (attempt - 1)))
            .clamp(0, maxDelay.inMilliseconds);
        final jitter = DateTime.now().millisecondsSinceEpoch % delayMs;

        await Future.delayed(Duration(milliseconds: delayMs + jitter));
      } on Exception catch (e) {
        // Non-Forge exception — wrap and throw
        throw ForgeException.server(e.toString());
      }
    }
  }
}
