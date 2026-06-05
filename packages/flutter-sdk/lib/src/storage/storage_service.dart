/// Storage service — upload/download files via presigned URLs.

import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import '../http/api_client.dart';
import '../models/upload_result.dart';
import '../errors/forge_exception.dart';
import '../errors/error_handler.dart';

/// Service for file storage operations through the Forge gateway.
class StorageService {
  final ApiClient _apiClient;
  final Dio _directDio;

  StorageService({required ApiClient apiClient})
      : _apiClient = apiClient,
        _directDio = Dio();

  /// Get a presigned upload URL.
  Future<UploadResult> getUploadUrl({
    required String bucket,
    required String path,
    String contentType = 'application/octet-stream',
    int? sizeBytes,
  }) async {
    final response = await _apiClient.post('/v1/storage/upload-url', data: {
      'bucket': bucket,
      'path': path,
      'content_type': contentType,
      if (sizeBytes != null) 'size_bytes': sizeBytes,
    });

    if (response.isSuccess && response.data != null) {
      final data = response.data as Map<String, dynamic>;
      if (data['success'] == true && data['data'] != null) {
        return UploadResult.fromJson(data['data'] as Map<String, dynamic>);
      }
    }

    throw StorageException(
      code: 'UPLOAD_ERROR',
      message: 'Failed to get upload URL',
      bucket: bucket,
      path: path,
    );
  }

  /// Upload a file using a presigned URL.
  Future<void> uploadFile({
    required String bucket,
    required String path,
    required List<int> fileBytes,
    String contentType = 'application/octet-stream',
    void Function(int, int)? onProgress,
  }) async {
    return ErrorHandler.withRetry(
      operation: () async {
        // Step 1: Get presigned URL
        final uploadResult = await getUploadUrl(
          bucket: bucket,
          path: path,
          contentType: contentType,
          sizeBytes: fileBytes.length,
        );

        // Step 2: Upload directly to storage
        await _directDio.put(
          uploadResult.url,
          data: Stream.fromIterable([fileBytes]),
          options: Options(
            headers: {
              'Content-Type': contentType,
              'Content-Length': fileBytes.length.toString(),
            },
          ),
          onSendProgress: onProgress,
        );
      },
      retryOn: (e) => e.statusCode == 429 || e.statusCode == null,
    );
  }

  /// Upload a file from disk using a presigned URL.
  Future<void> uploadFileFromPath({
    required String bucket,
    required String path,
    required String filePath,
    String contentType = 'application/octet-stream',
    void Function(int, int)? onProgress,
  }) async {
    final file = File(filePath);
    if (!await file.exists()) {
      throw StorageException(
        code: 'FILE_NOT_FOUND',
        message: 'File not found: $filePath',
      );
    }

    final bytes = await file.readAsBytes();
    return uploadFile(
      bucket: bucket,
      path: path,
      fileBytes: bytes,
      contentType: contentType,
      onProgress: onProgress,
    );
  }

  /// Get a presigned download URL.
  Future<String> getDownloadUrl({
    required String bucket,
    required String path,
  }) async {
    final response = await _apiClient.get(
      '/v1/storage/download-url',
      queryParameters: {'bucket': bucket, 'path': path},
    );

    if (response.isSuccess && response.data != null) {
      final data = response.data as Map<String, dynamic>;
      if (data['success'] == true && data['data'] != null) {
        return (data['data'] as Map<String, dynamic>)['url'] as String;
      }
    }

    throw StorageException(
      code: 'DOWNLOAD_ERROR',
      message: 'Failed to get download URL',
      bucket: bucket,
      path: path,
    );
  }

  /// Download a file from storage.
  Future<List<int>> downloadFile({
    required String bucket,
    required String path,
    void Function(int, int)? onProgress,
  }) async {
    return ErrorHandler.withRetry(
      operation: () async {
        final url = await getDownloadUrl(bucket: bucket, path: path);

        final response = await _directDio.get(
          url,
          options: Options(responseType: ResponseType.bytes),
          onReceiveProgress: onProgress,
        );

        return response.data as List<int>;
      },
      retryOn: (e) => e.statusCode == 429 || e.statusCode == null,
    );
  }

  /// Download a file to a local path.
  Future<void> downloadToFile({
    required String bucket,
    required String path,
    required String localPath,
    void Function(int, int)? onProgress,
  }) async {
    final bytes = await downloadFile(
      bucket: bucket,
      path: path,
      onProgress: onProgress,
    );
    await File(localPath).writeAsBytes(bytes);
  }
}
