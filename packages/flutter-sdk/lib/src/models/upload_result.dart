/// Upload result model.

class UploadResult {
  final String url;
  final String method;
  final int expiresIn;

  UploadResult({
    required this.url,
    required this.method,
    required this.expiresIn,
  });

  factory UploadResult.fromJson(Map<String, dynamic> json) => UploadResult(
        url: json['url'] ?? '',
        method: json['method'] ?? 'PUT',
        expiresIn: json['expires_in'] ?? 900,
      );
}

class DownloadResult {
  final String url;
  final String method;
  final int expiresIn;

  DownloadResult({
    required this.url,
    required this.method,
    required this.expiresIn,
  });

  factory DownloadResult.fromJson(Map<String, dynamic> json) => DownloadResult(
        url: json['url'] ?? '',
        method: json['method'] ?? 'GET',
        expiresIn: json['expires_in'] ?? 3600,
      );
}
