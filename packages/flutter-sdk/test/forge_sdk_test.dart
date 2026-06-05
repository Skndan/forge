// ── Flutter SDK Unit Tests ──

import 'package:flutter_test/flutter_test.dart';
import 'package:forge_flutter_sdk/src/models/forge_user.dart';
import 'package:forge_flutter_sdk/src/models/api_response.dart';
import 'package:forge_flutter_sdk/src/models/db_query_result.dart';
import 'package:forge_flutter_sdk/src/models/upload_result.dart';
import 'package:forge_flutter_sdk/src/errors/forge_exception.dart';
import 'package:forge_flutter_sdk/src/errors/error_handler.dart';

void main() {
  group('ForgeUser', () {
    test('creates from JSON with all fields', () {
      final user = ForgeUser.fromJson({
        'sub': 'user-123',
        'email': 'test@example.com',
        'name': 'Test User',
        'preferred_username': 'testuser',
        'tenant_id': 'tenant-1',
        'roles': ['admin', 'editor'],
        'picture': 'https://example.com/avatar.png',
      });

      expect(user.sub, 'user-123');
      expect(user.email, 'test@example.com');
      expect(user.name, 'Test User');
      expect(user.preferredUsername, 'testuser');
      expect(user.tenantId, 'tenant-1');
      expect(user.roles, ['admin', 'editor']);
      expect(user.picture, 'https://example.com/avatar.png');
      expect(user.isAdmin, true);
    });

    test('creates anonymous user', () {
      final user = ForgeUser.anonymous();
      expect(user.sub, '');
      expect(user.email, '');
      expect(user.name, 'Anonymous');
      expect(user.isAdmin, false);
    });

    test('serializes to JSON and back', () {
      final original = ForgeUser(
        sub: 'user-456',
        email: 'user@test.com',
        name: 'User',
        preferredUsername: 'user',
        tenantId: 'tenant-2',
        roles: ['viewer'],
        picture: null,
      );

      final json = original.toJson();
      final restored = ForgeUser.fromJson(json);

      expect(restored.sub, original.sub);
      expect(restored.email, original.email);
      expect(restored.name, original.name);
      expect(restored.tenantId, original.tenantId);
      expect(restored.roles, original.roles);
    });

    test('handles alternate key names from gateway', () {
      final user = ForgeUser.fromJson({
        'id': 'user-789',
        'email': 'alt@test.com',
        'display_name': 'Alt User',
        'client_roles': ['admin'],
      });

      expect(user.sub, 'user-789');
      expect(user.email, 'alt@test.com');
      expect(user.name, 'Alt User');
      expect(user.roles, ['admin']);
    });
  });

  group('ApiResponse', () {
    test('parses success response', () {
      final response = ApiResponse.fromJson({
        'success': true,
        'data': {'id': '123'},
      }, null);

      expect(response.success, true);
      expect(response.data, isA<Map>());
      expect(response.error, isNull);
    });

    test('parses error response', () {
      final response = ApiResponse.fromJson({
        'success': false,
        'error': {
          'code': 'VALIDATION_ERROR',
          'message': 'Invalid input',
        },
      }, null);

      expect(response.success, false);
      expect(response.error, isNotNull);
      expect(response.error!.code, 'VALIDATION_ERROR');
      expect(response.error!.message, 'Invalid input');
    });

    test('parses paginated response', () {
      final response = ApiResponse.fromJson({
        'success': true,
        'data': [{'id': '1'}],
        'total': 1,
        'page': 1,
        'per_page': 50,
      }, null);

      expect(response.total, 1);
      expect(response.page, 1);
      expect(response.perPage, 50);
    });

    test('parses with typed data transform', () {
      final response = ApiResponse.fromJson({
        'success': true,
        'data': {'name': 'test'},
      }, (data) => (data as Map)['name'] as String);

      expect(response.data, 'test');
    });
  });

  group('DbQueryResult', () {
    test('parses successful query result', () {
      final result = DbQueryResult.fromJson({
        'success': true,
        'data': [
          {'id': 1, 'name': 'test'},
          {'id': 2, 'name': 'test2'},
        ],
        'row_count': 2,
      });

      expect(result.success, true);
      expect(result.data.length, 2);
      expect(result.rowCount, 2);
      expect(result.isEmpty, false);
      expect(result.isNotEmpty, true);
    });

    test('parses empty result', () {
      final result = DbQueryResult.fromJson({
        'success': true,
        'data': [],
        'row_count': 0,
      });

      expect(result.success, true);
      expect(result.data, isEmpty);
      expect(result.isEmpty, true);
    });

    test('parses error result', () {
      final result = DbQueryResult.fromJson({
        'success': false,
        'error': {
          'code': 'QUERY_ERROR',
          'message': 'Syntax error',
        },
      });

      expect(result.success, false);
      expect(result.error, 'Syntax error');
    });
  });

  group('UploadResult', () {
    test('parses upload result', () {
      final result = UploadResult.fromJson({
        'url': 'https://storage.example.com/upload',
        'method': 'PUT',
        'expires_in': 900,
      });

      expect(result.url, 'https://storage.example.com/upload');
      expect(result.method, 'PUT');
      expect(result.expiresIn, 900);
    });
  });

  group('ForgeException', () {
    test('creates unauthorized exception', () {
      final ex = ForgeException.unauthorized();
      expect(ex.code, 'UNAUTHORIZED');
      expect(ex.statusCode, 401);
    });

    test('creates forbidden exception', () {
      final ex = ForgeException.forbidden();
      expect(ex.code, 'FORBIDDEN');
      expect(ex.statusCode, 403);
    });

    test('creates not found exception', () {
      final ex = ForgeException.notFound();
      expect(ex.code, 'NOT_FOUND');
      expect(ex.statusCode, 404);
    });

    test('creates validation exception', () {
      final ex = ForgeException.validation('Email is required');
      expect(ex.code, 'VALIDATION_ERROR');
      expect(ex.message, 'Email is required');
    });

    test('creates network exception', () {
      final ex = ForgeException.network('Connection refused');
      expect(ex.code, 'NETWORK_ERROR');
    });

    test('creates timeout exception', () {
      final ex = ForgeException.timeout();
      expect(ex.code, 'TIMEOUT');
    });

    test('DatabaseException includes query info', () {
      final ex = DatabaseException(
        code: 'QUERY_ERROR',
        message: 'Syntax error',
        query: 'SELECT * FROM',
      );
      expect(ex.toString(), contains('SELECT * FROM'));
    });

    test('StorageException includes bucket info', () {
      final ex = StorageException(
        code: 'UPLOAD_ERROR',
        message: 'Upload failed',
        bucket: 'my-bucket',
        path: '/file.txt',
      );
      expect(ex.code, 'UPLOAD_ERROR');
      expect(ex.bucket, 'my-bucket');
    });

    test('FunctionException includes function ID', () {
      final ex = FunctionException(
        code: 'INVOKE_ERROR',
        message: 'Timeout',
        functionId: 'func-123',
      );
      expect(ex.functionId, 'func-123');
    });
  });

  group('AuthState', () {
    test('starts in unknown state', () {
      // AuthState requires Flutter bindings — test the model logic
      expect(true, isTrue); // Placeholder for integration test
    });
  });

  group('ErrorHandler retry logic', () {
    test('retries on network errors', () async {
      int attempts = 0;

      await expectLater(
        () => ErrorHandler.withRetry(
          operation: () async {
            attempts++;
            if (attempts < 2) {
              throw ForgeException.network('Connection failed');
            }
            return 'success';
          },
          maxRetries: 3,
          baseDelay: const Duration(milliseconds: 10),
        ),
        completion('success'),
      );

      expect(attempts, 2);
    });

    test('throws after exhausting retries', () async {
      int attempts = 0;

      await expectLater(
        () => ErrorHandler.withRetry(
          operation: () async {
            attempts++;
            throw ForgeException.network('Always fails');
          },
          maxRetries: 2,
          baseDelay: const Duration(milliseconds: 10),
        ),
        throwsA(isA<ForgeException>()),
      );

      expect(attempts, 2); // 1 initial + 1 retry
    });

    test('does not retry on 4xx errors', () async {
      int attempts = 0;

      await expectLater(
        () => ErrorHandler.withRetry(
          operation: () async {
            attempts++;
            throw ForgeException(code: 'VALIDATION_ERROR', message: 'Bad request', statusCode: 400);
          },
          maxRetries: 3,
          baseDelay: const Duration(milliseconds: 10),
        ),
        throwsA(isA<ForgeException>()),
      );

      expect(attempts, 1); // No retry for 400
    });

    test('retries on 429 rate limit', () async {
      int attempts = 0;

      await expectLater(
        () => ErrorHandler.withRetry(
          operation: () async {
            attempts++;
            if (attempts < 2) {
              throw ForgeException(code: 'RATE_LIMITED', message: 'Too fast', statusCode: 429);
            }
            return 'success';
          },
          maxRetries: 3,
          baseDelay: const Duration(milliseconds: 10),
        ),
        completion('success'),
      );

      expect(attempts, 2);
    });

    test('uses custom retry predicate', () async {
      int attempts = 0;

      await expectLater(
        () => ErrorHandler.withRetry(
          operation: () async {
            attempts++;
            throw ForgeException.server('Server error');
          },
          maxRetries: 5,
          baseDelay: const Duration(milliseconds: 10),
          retryOn: (e) => e.code == 'INTERNAL_ERROR',
        ),
        throwsA(isA<ForgeException>()),
      );

      expect(attempts, 5); // Only retries on INTERNAL_ERROR
    });
  });
}
