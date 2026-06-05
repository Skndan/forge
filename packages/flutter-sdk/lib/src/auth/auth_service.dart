/// Auth service — PKCE login via flutter_appauth, token management.

import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_appauth/flutter_appauth.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../http/api_client.dart';
import '../models/forge_user.dart';
import 'auth_state.dart';

/// Service handling PKCE authentication flow with Keycloak.
class AuthService {
  final ApiClient _apiClient;
  final AuthState _authState;
  final String _keycloakUrl;
  final String _realm;
  final String _clientId;
  final String _redirectUri;
  final FlutterAppAuth _appAuth;
  final FlutterSecureStorage _secureStorage;

  AuthService({
    required ApiClient apiClient,
    required AuthState authState,
    required String keycloakUrl,
    required String realm,
    required String clientId,
    required String redirectUri,
    FlutterAppAuth? appAuth,
    FlutterSecureStorage? secureStorage,
  })  : _apiClient = apiClient,
        _authState = authState,
        _keycloakUrl = keycloakUrl,
        _realm = realm,
        _clientId = clientId,
        _redirectUri = redirectUri,
        _appAuth = appAuth ?? const FlutterAppAuth(),
        _secureStorage = secureStorage ?? const FlutterSecureStorage();

  String get _issuer => '$_keycloakUrl/realms/$_realm';
  String get _authEndpoint => '$_issuer/protocol/openid-connect/auth';
  String get _tokenEndpoint => '$_issuer/protocol/openid-connect/token';
  String get _endSessionEndpoint => '$_issuer/protocol/openid-connect/logout';

  /// Start the PKCE login flow.
  Future<ForgeUser?> login() async {
    _authState.setLoading();

    try {
      final result = await _appAuth.authorizeAndExchangeCode(
        AuthorizationTokenRequest(
          _clientId,
          _redirectUri,
          serviceConfiguration: AuthorizationServiceConfiguration(
            authorizationEndpoint: _authEndpoint,
            tokenEndpoint: _tokenEndpoint,
            endSessionEndpoint: _endSessionEndpoint,
          ),
          scopes: ['openid', 'profile', 'email', 'offline_access'],
          preferEphemeralSession: true,
        ),
      );

      if (result == null || result.accessToken == null) {
        _authState.setUnauthenticated(errorMessage: 'Login cancelled');
        return null;
      }

      return await _handleTokenResponse(result);
    } catch (e) {
      debugPrint('[AuthService] Login error: $e');
      _authState.setError('Login failed: ${e.toString()}');
      return null;
    }
  }

  /// Handle token response from Keycloak.
  Future<ForgeUser> _handleTokenResponse(TokenResponse result) async {
    final accessToken = result.accessToken!;
    final refreshToken = result.refreshToken;
    final idToken = result.idToken;

    // Parse user info from the ID token or access token
    final user = _parseUserFromToken(accessToken, idToken);

    // Update state and persist
    _authState.setAuthenticated(
      accessToken: accessToken,
      refreshToken: refreshToken ?? '',
      user: user,
    );

    await _authState.persistTokens(
      accessToken: accessToken,
      refreshToken: refreshToken,
      user: user,
    );

    return user;
  }

  /// Try to restore session from persisted tokens.
  Future<bool> tryRestoreSession() async {
    final hasTokens = await _authState.loadPersistedTokens();
    if (hasTokens && _authState.accessToken != null) {
      // Token might be expired — we'll try a request and the interceptor will refresh
      return true;
    }
    return false;
  }

  /// Refresh the access token using the refresh token.
  Future<bool> refreshToken() async {
    final currentRefresh = _authState.refreshToken;
    if (currentRefresh == null || currentRefresh.isEmpty) return false;

    try {
      final result = await _appAuth.token(
        TokenRequest(
          _clientId,
          _redirectUri,
          serviceConfiguration: AuthorizationServiceConfiguration(
            authorizationEndpoint: _authEndpoint,
            tokenEndpoint: _tokenEndpoint,
            endSessionEndpoint: _endSessionEndpoint,
          ),
          refreshToken: currentRefresh,
          scopes: ['openid', 'profile', 'email', 'offline_access'],
        ),
      );

      if (result == null || result.accessToken == null) {
        _authState.setUnauthenticated(errorMessage: 'Token refresh failed');
        return false;
      }

      _authState.updateToken(result.accessToken!, result.refreshToken);

      // Re-persist tokens
      await _authState.persistTokens(
        accessToken: result.accessToken!,
        refreshToken: result.refreshToken,
      );

      return true;
    } catch (e) {
      debugPrint('[AuthService] Token refresh error: $e');
      _authState.setUnauthenticated(errorMessage: 'Session expired');
      return false;
    }
  }

  /// Logout — clear tokens and end session
  Future<void> logout() async {
    try {
      final idToken = await _secureStorage.read(key: 'forge_id_token');
      if (idToken != null) {
        await _appAuth.endSession(
          EndSessionRequest(
            idTokenHint: idToken,
            postLogoutRedirectUrl: _redirectUri,
            serviceConfiguration: AuthorizationServiceConfiguration(
              authorizationEndpoint: _authEndpoint,
              tokenEndpoint: _tokenEndpoint,
              endSessionEndpoint: _endSessionEndpoint,
            ),
          ),
        );
      }
    } catch (e) {
      debugPrint('[AuthService] Logout error: $e');
    }

    _authState.setLoading();
    await _authState.clearTokens();
    _authState.setUnauthenticated();
  }

  /// Parse user info from JWT token.
  ForgeUser _parseUserFromToken(String accessToken, String? idToken) {
    try {
      // Try ID token first, fall back to access token
      final tokenToDecode = idToken ?? accessToken;
      final parts = tokenToDecode.split('.');
      if (parts.length != 3) {
        return ForgeUser.anonymous();
      }

      // Normalize base64
      String normalized = parts[1].replaceAll('-', '+').replaceAll('_', '/');
      switch (normalized.length % 4) {
        case 2:
          normalized += '==';
          break;
        case 3:
          normalized += '=';
          break;
      }

      final decoded = utf8.decode(base64Url.decode(parts[1]));
      final Map<String, dynamic> payload = jsonDecode(decoded);

      return ForgeUser(
        sub: payload['sub'] ?? '',
        email: payload['email'] ?? '',
        name: payload['name'] ?? payload['preferred_username'] ?? '',
        preferredUsername: payload['preferred_username'] ?? '',
        tenantId: payload['tenant_id'],
        roles: List<String>.from(payload['roles'] ?? []),
        picture: payload['picture'],
      );
    } catch (e) {
      debugPrint('[AuthService] Token parse error: $e');
      return ForgeUser.anonymous();
    }
  }

  /// Fetch current user info from the gateway.
  Future<ForgeUser?> fetchUserInfo() async {
    try {
      final response = await _apiClient.get('/v1/auth/me');
      if (response.statusCode == 200 && response.data != null) {
        final data = response.data as Map<String, dynamic>;
        if (data['success'] == true && data['data'] != null) {
          return ForgeUser.fromJson(data['data']);
        }
      }
    } catch (e) {
      debugPrint('[AuthService] Fetch user info error: $e');
    }
    return null;
  }

  Future<void> dispose() async {
    // Cleanup if needed
  }
}
