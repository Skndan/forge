/// Database query result model.

class DbQueryResult {
  final bool success;
  final List<Map<String, dynamic>> data;
  final int? rowCount;
  final String? error;

  DbQueryResult({
    required this.success,
    this.data = const [],
    this.rowCount,
    this.error,
  });

  bool get isEmpty => data.isEmpty;
  bool get isNotEmpty => data.isNotEmpty;
  int get length => data.length;

  factory DbQueryResult.fromJson(Map<String, dynamic> json) => DbQueryResult(
        success: json['success'] == true,
        data: json['data'] != null
            ? List<Map<String, dynamic>>.from(json['data'] as List)
            : [],
        rowCount: json['row_count'] as int?,
        error: json['error']?['message'] as String?,
      );

  @override
  String toString() => 'DbQueryResult(rows: ${data.length}, success: $success)';
}
