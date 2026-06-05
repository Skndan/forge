import 'package:flutter/foundation.dart';
import 'auth/auth_service.dart';
import 'auth/auth_state.dart';
import 'database/database_service.dart';
import 'storage/storage_service.dart';
import 'functions/functions_service.dart';
import 'realtime/realtime_service.dart';
import 'http/api_client.dart';
import 'errors/forge_exception.dart';

/// Singleton client for the Forge BaaS platform.
///
/// Usage:
/// ```dart
/// final forge = ForgeClient.instance;
/// await forge.initialize(
///   gatewayUrl: 'http://localhost:3000',
///   keycloakUrl: 'http://localhost:8080',
///   realm: 'forge',
///   clientId: 'forge-app',
/// );
/// ```
class ForgeClient {
  // ── Singleton ──────────────────────────────────────────────
  ForgeClient._();
  static final ForgeClient _instance = ForgeClient._();
  static ForgeClient get instance => _instance;

  // ── Configuration ──────────────────────────────────────────
  String _gatewayUrl = '';
  String _keycloakUrl = '';
  String _realm = '';
  String _clientId = '';
  String _redirectUri = '';
  bool _initialized = false;

  // ── Services ───────────────────────────────────────────────
  late final AuthService auth;
  late final DatabaseService database;
  late final StorageService storage;
  late final FunctionsService functions;
  late final RealtimeService realtime;
  late final ApiClient apiClient;
  late final AuthState authState;

  // ── Getters ────────────────────────────────────────────────
  String get gatewayUrl => _gatewayUrl;
  String get keycloakUrl => _keycloakUrl;
  String get realm => _realm;
  String get clientId => _clientId;
  bool get isInitialized => _initialized;

  /// Initialize the Forge client with configuration.
  Future<void> initialize({
    required String gatewayUrl,
    required String keycloakUrl,
    required String realm,
    required String clientId,
    String redirectUri = 'com.forge.app:/callback',
    String? existingToken,
  }) async {
    _gatewayUrl = gatewayUrl.endsWith('/') ? gatewayUrl.substring(0, gatewayUrl.length - 1) : gatewayUrl;
    _keycloakUrl = keycloakUrl.endsWith('/') ? keycloakUrl.substring(0, keycloakUrl.length - 1) : keycloakUrl;
    _realm = realm;
    _clientId = clientId;
    _redirectUri = redirectUri;

    // Initialize services
    authState = AuthState();
    apiClient = ApiClient(
      baseUrl: _gatewayUrl,
      authState: authState,
    );
    auth = AuthService(
      apiClient: apiClient,
      authState: authState,
      keycloakUrl: _keycloakUrl,
      realm: _realm,
      clientId: _clientId,
      redirectUri: _redirectUri,
    );
    database = DatabaseService(apiClient: apiClient);
    storage = StorageService(apiClient: apiClient);
    functions = FunctionsService(apiClient: apiClient);
    realtime = RealtimeService(
      gatewayUrl: _gatewayUrl,
      authState: authState,
    );

    // Restore existing token
    if (existingToken != null) {
      await authState.restoreToken(existingToken);
    } else {
      // Try to restore from secure storage
      await auth.tryRestoreSession();
    }

    _initialized = true;
  }

  /// Dispose of all services and connections.
  Future<void> dispose() async {
    await realtime.disconnect();
    await auth.dispose();
    debugPrint('[ForgeClient] Disposed');
  }
}
