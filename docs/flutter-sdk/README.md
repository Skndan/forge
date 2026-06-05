# Forge Flutter SDK

> Dart/Flutter SDK for the Forge BaaS platform.

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Authentication](#authentication)
- [Database Queries](#database-queries)
- [Realtime Subscriptions](#realtime-subscriptions)
- [Storage](#storage)
- [Function Invocation](#function-invocation)
- [Error Handling](#error-handling)
- [API Reference](#api-reference)

---

## Installation

Add to your `pubspec.yaml`:

```yaml
dependencies:
  forge: ^0.1.0
```

Or use a git dependency:

```yaml
dependencies:
  forge:
    git:
      url: https://github.com/Skndan/forge.git
      path: packages/flutter-sdk
```

Then run:

```bash
flutter pub get
```

### Required Platform Setup

**Android** (`android/app/build.gradle`):

```gradle
minSdkVersion 21
```

**iOS** (`ios/Runner/Info.plist`):

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>forge</string>
    </array>
  </dict>
</array>
```

---

## Quick Start

```dart
import 'package:forge/forge.dart';

void main() async {
  // Initialize with your Forge instance URL
  final forge = ForgeClient(
    baseUrl: 'https://api.yourdomain.com',
    keycloakUrl: 'https://auth.yourdomain.com',
    realm: 'forge',
    clientId: 'forge-flutter',
  );

  // Sign in
  await forge.auth.signIn(
    username: 'user@example.com',
    password: 'password123',
  );

  // Query data
  final result = await forge.db.query(
    'SELECT * FROM forge.users WHERE id = @id',
    params: {'id': 'user-uuid'},
  );

  print('Users: ${result.data}');

  // Sign out
  await forge.auth.signOut();
}
```

---

## Authentication

### PKCE Auth Flow

The SDK uses the PKCE (Proof Key for Code Exchange) OAuth 2.0 flow via `flutter_appauth`.

```dart
// Automatic PKCE flow
await forge.auth.signIn(
  username: 'user@example.com',
  password: 'password123',
);

// Or open browser-based login
await forge.auth.signInWithBrowser();
```

### Token Management

Tokens are automatically stored in `flutter_secure_storage` and refreshed transparently.

```dart
// Auth state stream
forge.auth.authState.listen((state) {
  if (state.isAuthenticated) {
    print('User is signed in!');
  } else {
    print('User is signed out.');
  }
});

// Get current token
final token = await forge.auth.getAccessToken();

// Check if authenticated
final isAuth = await forge.auth.isAuthenticated();
```

### Sign Out

```dart
await forge.auth.signOut();
```

---

## Database Queries

### Read Query

```dart
final result = await forge.db.query(
  'SELECT * FROM forge.users WHERE tenant_id = @tenantId',
  params: {'tenantId': 'tenant-uuid'},
);

for (final row in result.data) {
  print(row['email']);
}
```

### Write Query

```dart
final result = await forge.db.execute(
  'INSERT INTO forge.users (id, email, tenant_id) VALUES (@id, @email, @tenantId)',
  params: {
    'id': 'new-user-uuid',
    'email': 'new@example.com',
    'tenantId': 'tenant-uuid',
  },
);

print('Rows affected: ${result.affectedRows}');
```

### Error Handling

```dart
try {
  final result = await forge.db.query('SELECT * FROM forge.users');
} on ForgeException catch (e) {
  print('${e.code}: ${e.message}');
}
```

---

## Realtime Subscriptions

### Subscribe to Changes

```dart
final subscription = forge.realtime
    .channel('users')
    .on('INSERT', (payload) {
      print('User created: ${payload.newRecord}');
    })
    .on('UPDATE', (payload) {
      print('User updated: ${payload.newRecord}');
    })
    .on('DELETE', (payload) {
      print('User deleted: ${payload.oldRecord}');
    })
    .subscribe();

// Later...
await subscription.unsubscribe();
```

### Filtering

```dart
final subscription = forge.realtime
    .channel('users')
    .filter('tenant_id', 'eq', 'my-tenant-uuid')
    .on('*', (payload) {
      print('Change: ${payload.eventType} on ${payload.table}');
    })
    .subscribe();
```

### Connection State

```dart
forge.realtime.connectionState.listen((state) {
  // ConnectionState.connected
  // ConnectionState.disconnected
  // ConnectionState.reconnecting
  print('Realtime: $state');
});
```

---

## Storage

### Upload File

```dart
import 'dart:io';

final uploadUrl = await forge.storage.getUploadUrl(
  bucket: 'my-bucket',
  path: 'uploads/image.jpg',
);

// Upload directly to RustFS
final file = File('/path/to/image.jpg');
await forge.storage.upload(uploadUrl, file);
```

### Download File

```dart
final downloadUrl = await forge.storage.getDownloadUrl(
  bucket: 'my-bucket',
  path: 'uploads/image.jpg',
);

// Download to local file
final file = await forge.storage.download(downloadUrl);
```

### List Files

```dart
final files = await forge.storage.list(
  bucket: 'my-bucket',
  prefix: 'uploads/',
);

for (final file in files) {
  print('${file.path} (${file.size} bytes)');
}
```

---

## Function Invocation

### Call a Serverless Function

```dart
final result = await forge.functions.invoke(
  functionId: 'func-uuid',
  payload: {'userId': 'user-uuid'},
  async: false,
);

print('Result: ${result.data}');
```

### Async Invocation

```dart
final result = await forge.functions.invoke(
  functionId: 'func-uuid',
  payload: {'userId': 'user-uuid'},
  async: true,
);

print('Invocation ID: ${result.invocationId}');
```

---

## Error Handling

### Exception Types

```dart
try {
  await forge.db.query('SELECT * FROM forge.users');
} on ForgeUnauthorizedException {
  // Token expired or invalid
} on ForgeForbiddenException {
  // Insufficient permissions
} on ForgeNotFoundException {
  // Resource not found
} on ForgeValidationException catch (e) {
  // Invalid request
  print('Validation error: ${e.message}');
} on ForgeRateLimitException {
  // Too many requests
} on ForgeNetworkException {
  // Network connectivity issue
} on ForgeException catch (e) {
  // Generic Forge error
  print('${e.code}: ${e.message}');
}
```

### Retry Configuration

```dart
final forge = ForgeClient(
  baseUrl: 'https://api.yourdomain.com',
  keycloakUrl: 'https://auth.yourdomain.com',
  realm: 'forge',
  clientId: 'forge-flutter',
  maxRetries: 3,
  retryDelay: Duration(seconds: 1),
);
```

---

## API Reference

### ForgeClient

```dart
ForgeClient({
  required String baseUrl,
  required String keycloakUrl,
  required String realm,
  required String clientId,
  String? redirectUri,
  int maxRetries = 3,
  Duration retryDelay = Duration(seconds: 1),
});
```

### Auth

| Method | Description |
|---|---|
| `signIn({username, password})` | Sign in with credentials |
| `signInWithBrowser()` | Sign in with browser (PKCE) |
| `signOut()` | Sign out and clear tokens |
| `getAccessToken()` | Get current access token |
| `isAuthenticated()` | Check if user is authenticated |
| `authState` | Stream of auth state changes |

### Database

| Method | Description |
|---|---|
| `query(sql, {params})` | Execute SELECT query |
| `execute(sql, {params})` | Execute write query |
| `rpc(functionName, {params})` | Call a database function |

### Realtime

| Method | Description |
|---|---|
| `channel(name)` | Create or join a channel |
| `connectionState` | Stream of connection state |
| `Channel.on(event, callback)` | Listen for changes |
| `Channel.filter(column, operator, value)` | Filter changes |
| `Channel.subscribe()` | Start subscription |
| `Subscription.unsubscribe()` | Stop subscription |

### Storage

| Method | Description |
|---|---|
| `getUploadUrl({bucket, path})` | Get presigned upload URL |
| `getDownloadUrl({bucket, path})` | Get presigned download URL |
| `upload(url, file)` | Upload file to presigned URL |
| `download(url)` | Download file from presigned URL |
| `list({bucket, prefix})` | List files in bucket |

### Functions

| Method | Description |
|---|---|
| `invoke({functionId, payload, async})` | Invoke a serverless function |
| `deploy({name, code, runtime})` | Deploy a new function |
| `list()` | List deployed functions |
| `delete(functionId)` | Delete a function |

---

## Example App

Complete Flutter app using the Forge SDK:

```dart
import 'package:flutter/material.dart';
import 'package:forge/forge.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Forge Flutter Demo',
      home: const LoginPage(),
    );
  }
}

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  late final ForgeClient _forge;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _forge = ForgeClient(
      baseUrl: 'http://localhost:3000',
      keycloakUrl: 'http://localhost:8080',
      realm: 'forge',
      clientId: 'forge-flutter',
    );
  }

  Future<void> _login() async {
    setState(() => _loading = true);
    try {
      await _forge.auth.signIn(
        username: _emailController.text,
        password: _passwordController.text,
      );
      // Navigate to main page
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Login failed: $e')),
        );
      }
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Forge Login')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            TextField(controller: _emailController, decoration: const InputDecoration(labelText: 'Email')),
            TextField(controller: _passwordController, decoration: const InputDecoration(labelText: 'Password'), obscureText: true),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loading ? null : _login,
              child: _loading ? const CircularProgressIndicator() : const Text('Sign In'),
            ),
          ],
        ),
      ),
    );
  }
}
```

---

## See Also

- [Example Apps](../../examples/) — Working Flutter example apps
- [API Reference](../api/README.md) — Backend API documentation
- [Architecture Guide](../architecture/README.md) — System architecture overview
