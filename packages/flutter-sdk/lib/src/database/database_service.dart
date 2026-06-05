/// Database service — query the Forge gateway.

import '../http/api_client.dart';
import '../models/db_query_result.dart';
import '../errors/forge_exception.dart';
import '../errors/error_handler.dart';

/// Service for executing database queries through the Forge gateway.
class DatabaseService {
  final ApiClient _apiClient;

  DatabaseService({required ApiClient apiClient}) : _apiClient = apiClient;

  /// Execute a SELECT query through the gateway.
  ///
  /// [query] — SQL query string (only SELECT is allowed by gateway).
  /// [params] — optional parameter values for parameterized queries.
  Future<DbQueryResult> query({
    required String query,
    List<dynamic>? params,
  }) async {
    return ErrorHandler.withRetry(
      operation: () async {
        final response = await _apiClient.post('/v1/db/query', data: {
          'query': query,
          if (params != null) 'params': params,
        });

        if (response.isSuccess && response.data != null) {
          return DbQueryResult.fromJson(response.data as Map<String, dynamic>);
        }

        throw ForgeException.server('Database query failed');
      },
      retryOn: (e) => e.statusCode == 429 || e.statusCode == null,
    );
  }

  /// Shorthand to fetch all rows from a table.
  Future<DbQueryResult> fromTable(
    String table, {
    List<String>? columns,
    String? where,
    int? limit,
    int? offset,
    String? orderBy,
  }) async {
    final cols = columns?.join(', ') ?? '*';
    String sql = 'SELECT $cols FROM $table';

    if (where != null) {
      sql += ' WHERE $where';
    }
    if (orderBy != null) {
      sql += ' ORDER BY $orderBy';
    }
    if (limit != null) {
      sql += ' LIMIT $limit';
    }
    if (offset != null) {
      sql += ' OFFSET $offset';
    }

    return query(query: sql);
  }

  /// Fetch a single row by ID.
  Future<Map<String, dynamic>?> findById(
    String table,
    String id, {
    String idColumn = 'id',
  }) async {
    final result = await query(
      query: 'SELECT * FROM $table WHERE $idColumn = \$1 LIMIT 1',
      params: [id],
    );

    if (result.data.isNotEmpty) {
      return result.data.first;
    }
    return null;
  }

  /// Count rows in a table.
  Future<int> count(String table, {String? where}) async {
    String sql = 'SELECT COUNT(*) as count FROM $table';
    if (where != null) {
      sql += ' WHERE $where';
    }

    final result = await query(query: sql);
    if (result.data.isNotEmpty) {
      return result.data.first['count'] as int;
    }
    return 0;
  }
}
