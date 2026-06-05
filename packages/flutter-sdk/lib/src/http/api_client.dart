/// Dio HTTP client configured for the Forge gateway.

import 'package:dio/dio.dart';
import '../auth/auth_state.dart';
import 'auth_interceptor.dart';
import '../errors/forge_exception.dart';
import '../errors/error_handler.dart';

/// Configured HTTP client for communicating with the Forge gateway.
class ApiClient {
  late final Dio _dio;
  final AuthState _authState;

  final String baseUrl;
  final Duration connectTimeout;
  final Duration receiveTimeout;

  ApiClient({
    required this.baseUrl,
    required AuthState authState,
    this.connectTimeout = const Duration(seconds: 10),
    this.receiveTimeout = const Duration(seconds: 30),
  }) : _authState = authState {
    _dio = Dio(
      BaseOptions(
        baseUrl: baseUrl,
        connectTimeout: connectTimeout,
        receiveTimeout: receiveTimeout,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    // Add auth interceptor
    _dio.interceptors.add(AuthInterceptor(authState: authState, dio: _dio));

    // Add logging interceptor in debug
    _dio.interceptors.add(
      LogInterceptor(
        requestBody: true,
        responseBody: true,
        logPrint: (obj) => print('[Forge API] $obj'),
      ),
    );
  }

  Dio get dio => _dio;

  // ── HTTP Methods ──────────────────────────────────────────

  Future<ApiResponseData> get(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    return _execute(() => _dio.get(path, queryParameters: queryParameters));
  }

  Future<ApiResponseData> post(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
  }) async {
    return _execute(() => _dio.post(path, data: data, queryParameters: queryParameters));
  }

  Future<ApiResponseData> put(
    String path, {
    dynamic data,
  }) async {
    return _execute(() => _dio.put(path, data: data));
  }

  Future<ApiResponseData> patch(
    String path, {
    dynamic data,
  }) async {
    return _execute(() => _dio.patch(path, data: data));
  }

  Future<ApiResponseData> delete(String path) async {
    return _execute(() => _dio.delete(path));
  }

  // ── Upload helper (multipart) ────────────────────────────

  Future<ApiResponseData> uploadFile(
    String path, {
    required String filePath,
    required String fileField,
    Map<String, dynamic>? extraFields,
  }) async {
    final formData = FormData.fromMap({
      fileField: await MultipartFile.fromFile(filePath),
      if (extraFields != null) ...extraFields,
    });

    return _execute(() => _dio.post(path, data: formData));
  }

  // ── Internal ──────────────────────────────────────────────

  Future<ApiResponseData> _execute(Future<Response> Function() request) async {
    try {
      final response = await request();
      return ApiResponseData(
        statusCode: response.statusCode ?? 200,
        data: response.data,
        headers: response.headers,
      );
    } on DioException catch (e) {
      throw ErrorHandler.handleDioException(e);
    }
  }
}

/// Wrapper for API response data.
class ApiResponseData {
  final int statusCode;
  final dynamic data;
  final Map<String, List<String>>? headers;

  ApiResponseData({
    required this.statusCode,
    this.data,
    this.headers,
  });

  bool get isSuccess => statusCode >= 200 && statusCode < 300;

  Map<String, dynamic>? get body => data is Map<String, dynamic> ? data as Map<String, dynamic> : null;
}
