/// Auth interceptor for Dio — auto-attaches Bearer token and handles refresh.

import 'package:dio/dio.dart';
import '../auth/auth_state.dart';

/// Dio interceptor that attaches the access token and handles 401 refresh.
class AuthInterceptor extends Interceptor {
  final AuthState _authState;
  final Dio _dio;

  AuthInterceptor({
    required AuthState authState,
    required Dio dio,
  })  : _authState = authState,
        _dio = dio;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final token = _authState.accessToken;
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401) {
      // Try token refresh
      final success = await _authState.refreshToken();
      if (success && _authState.accessToken != null) {
        // Retry the original request with the new token
        final options = err.requestOptions;
        options.headers['Authorization'] = 'Bearer ${_authState.accessToken}';

        try {
          final response = await _dio.fetch(options);
          handler.resolve(response);
          return;
        } catch (retryError) {
          handler.next(retryError as DioException);
          return;
        }
      }
    }
    handler.next(err);
  }
}
