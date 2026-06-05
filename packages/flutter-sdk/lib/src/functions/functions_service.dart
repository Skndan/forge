/// Functions service — invoke serverless functions.

import '../http/api_client.dart';
import '../errors/forge_exception.dart';
import '../errors/error_handler.dart';

/// Service for invoking Forge serverless functions.
class FunctionsService {
  final ApiClient _apiClient;

  FunctionsService({required ApiClient apiClient}) : _apiClient = apiClient;

  /// Invoke a function synchronously and return the result.
  Future<dynamic> invoke({
    required String functionId,
    dynamic payload,
  }) async {
    return ErrorHandler.withRetry(
      operation: () async {
        final response = await _apiClient.post('/v1/functions/invoke', data: {
          'function_id': functionId,
          'payload': payload ?? {},
          'async': false,
        });

        if (response.isSuccess && response.data != null) {
          final data = response.data as Map<String, dynamic>;
          if (data['success'] == true) {
            return data['data'];
          }
          throw FunctionException(
            code: data['error']?['code'] ?? 'INVOKE_ERROR',
            message: data['error']?['message'] ?? 'Function invocation failed',
            functionId: functionId,
          );
        }

        throw FunctionException(
          code: 'INVOKE_ERROR',
          message: 'Function invocation failed',
          functionId: functionId,
        );
      },
      retryOn: (e) => e.statusCode == 429 || e.statusCode == null,
    );
  }

  /// Invoke a function asynchronously (fire-and-forget).
  Future<String> invokeAsync({
    required String functionId,
    dynamic payload,
  }) async {
    final response = await _apiClient.post('/v1/functions/invoke', data: {
      'function_id': functionId,
      'payload': payload ?? {},
      'async': true,
    });

    if (response.isSuccess && response.data != null) {
      final data = response.data as Map<String, dynamic>;
      if (data['success'] == true && data['data'] != null) {
        return (data['data'] as Map<String, dynamic>)['function_id'] as String;
      }
    }

    throw FunctionException(
      code: 'ASYNC_INVOKE_ERROR',
      message: 'Async invocation failed',
      functionId: functionId,
    );
  }
}
