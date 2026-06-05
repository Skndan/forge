/// Auth state model and management stream.

import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/forge_user.dart';

/// Authentication state enum.
enum AuthStatus {
  /// Initial state, not yet checked for existing session.
  unknown,

  /// Authenticated with a valid token.
  authenticated,

  /// Not authenticated (no token or token expired and refresh failed).
  unauthenticated,

  /// Authentication is in progress.
  loading,

  /// An authentication error occurred.
  error,
}

/// Manages auth state and exposes a stream for reactive UI.
class AuthState extends ChangeNotifier {
  static const _tokenKey = 'forge_access_token';
  static const _refreshTokenKey = 'forge_refresh_token';
  static const _userKey = 'forge_user_data';

  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();

  AuthStatus _status = AuthStatus.unknown;
  ForgeUser? _user;
  String? _accessToken;
  String? _refreshToken;
  String? _error;

  // Stream-based API for reactive consumption
  final StreamController<AuthState> _controller = StreamController<AuthState>.broadcast();

  // ── Getters ────────────────────────────────────────────────
  AuthStatus get status => _status;
  ForgeUser? get user => _user;
  String? get accessToken => _accessToken;
  String? get refreshToken => _refreshToken;
  String? get error => _error;
  bool get isAuthenticated => _status == AuthStatus.authenticated;
  bool get isLoading => _status == AuthStatus.loading;

  Stream<AuthState> get stream => _controller.stream;

  // ── State Updates ──────────────────────────────────────────

  void setLoading() {
    _status = AuthStatus.loading;
    _error = null;
    notifyListeners();
    _controller.add(this);
  }

  void setAuthenticated({
    required String accessToken,
    required String refreshToken,
    required ForgeUser user,
  }) {
    _status = AuthStatus.authenticated;
    _accessToken = accessToken;
    _refreshToken = refreshToken;
    _user = user;
    _error = null;
    notifyListeners();
    _controller.add(this);
  }

  void setUnauthenticated({String? errorMessage}) {
    _status = AuthStatus.unauthenticated;
    _accessToken = null;
    _refreshToken = null;
    _user = null;
    _error = errorMessage;
    notifyListeners();
    _controller.add(this);
  }

  void setError(String message) {
    _status = AuthStatus.error;
    _error = message;
    notifyListeners();
    _controller.add(this);
  }

  void updateToken(String newAccessToken, String? newRefreshToken) {
    _accessToken = newAccessToken;
    if (newRefreshToken != null) {
      _refreshToken = newRefreshToken;
    }
    notifyListeners();
    _controller.add(this);
  }

  // ── Persistence ────────────────────────────────────────────

  /// Persist tokens to secure storage.
  Future<void> persistTokens({
    required String accessToken,
    String? refreshToken,
    ForgeUser? user,
  }) async {
    await _secureStorage.write(key: _tokenKey, value: accessToken);
    if (refreshToken != null) {
      await _secureStorage.write(key: _refreshTokenKey, value: refreshToken);
    }
    if (user != null) {
      await _secureStorage.write(key: _userKey, value: user.toJson());
    }
  }

  /// Restore a previously persisted token (e.g. from restore).
  Future<void> restoreToken(String token) async {
    _accessToken = token;
    _status = AuthStatus.authenticated;
    notifyListeners();
    _controller.add(this);
  }

  /// Load persisted tokens from secure storage.
  Future<bool> loadPersistedTokens() async {
    try {
      final token = await _secureStorage.read(key: _tokenKey);
      if (token != null && token.isNotEmpty) {
        _accessToken = token;
        _refreshToken = await _secureStorage.read(key: _refreshTokenKey);
        final userJson = await _secureStorage.read(key: _userKey);
        if (userJson != null) {
          _user = ForgeUser.fromJson(userJson);
        }
        _status = AuthStatus.authenticated;
        notifyListeners();
        _controller.add(this);
        return true;
      }
    } catch (_) {
      // Storage error — continue as unauthenticated
    }

    _status = AuthStatus.unauthenticated;
    notifyListeners();
    _controller.add(this);
    return false;
  }

  /// Clear all persisted tokens (logout).
  Future<void> clearTokens() async {
    await _secureStorage.delete(key: _tokenKey);
    await _secureStorage.delete(key: _refreshTokenKey);
    await _secureStorage.delete(key: _userKey);
    setUnauthenticated();
  }

  @override
  void dispose() {
    _controller.close();
    super.dispose();
  }
}
