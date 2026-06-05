# Forge Example: File Gallery

> A file/image gallery built with the Forge Flutter SDK.

---

## Overview

This example demonstrates:
- File uploads via presigned URLs
- Image thumbnails and galleries
- File metadata management
- User-specific file buckets

## Prerequisites

- Flutter 3.x
- Forge stack running locally

## Setup

### 1. Create Storage Bucket

```bash
curl -X POST http://localhost:3000/v1/storage/upload-url \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bucket": "gallery", "path": "init", "content_type": "text/plain", "size": 1}'
```

### 2. Configure & Run

```bash
cd examples/file-gallery
flutter run
```

## Features

### Upload Image

```dart
// Get presigned URL
final uploadUrl = await forge.storage.getUploadUrl(
  bucket: 'gallery',
  path: 'images/${DateTime.now().millisecondsSinceEpoch}.jpg',
  contentType: 'image/jpeg',
);

// Upload file
await forge.storage.upload(uploadUrl, selectedFile);
```

### Load Gallery

```dart
final files = await forge.storage.list(bucket: 'gallery', prefix: 'images/');

// Display thumbnails using download URLs
for (final file in files) {
  final url = await forge.storage.getDownloadUrl(
    bucket: 'gallery',
    path: file.path,
  );
  // Use url to display image
}
```
