/// Generic API response wrapper.

class ApiResponse<T> {
  final bool success;
  final T? data;
  final ApiError? error;
  final int? total;
  final int? page;
  final int? perPage;

  ApiResponse({
    required this.success,
    this.data,
    this.error,
    this.total,
    this.page,
    this.perPage,
  });

  bool get isSuccess => success;
  bool get isError => !success && error != null;

  factory ApiResponse.fromJson(Map<String, dynamic> json, T Function(dynamic)? fromJsonT) {
    return ApiResponse(
      success: json['success'] == true,
      data: json['data'] != null && fromJsonT != null ? fromJsonT(json['data']) : json['data'] as T?,
      error: json['error'] != null ? ApiError.fromJson(json['error']) : null,
      total: json['total'] as int?,
      page: json['page'] as int?,
      perPage: json['per_page'] as int?,
    );
  }
}

class ApiError {
  final String code;
  final String message;
  final dynamic details;

  ApiError({
    required this.code,
    required this.message,
    this.details,
  });

  factory ApiError.fromJson(Map<String, dynamic> json) => ApiError(
        code: json['code'] ?? 'UNKNOWN',
        message: json['message'] ?? 'An unknown error occurred',
        details: json['details'],
      );

  @override
  String toString() => 'ApiError($code: $message)';
}
