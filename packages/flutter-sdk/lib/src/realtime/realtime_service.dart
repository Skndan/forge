/// Realtime service — WebSocket connection with Dart Stream.

import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../auth/auth_state.dart';
import '../errors/forge_exception.dart';

/// Types of realtime messages.
enum RealtimeEventType {
  subscribed,
  unsubscribed,
  error,
  pong,
  message,
}

/// A realtime event received from the server.
class RealtimeEvent {
  final RealtimeEventType type;
  final String? subscriptionId;
  final String? message;
  final String? code;
  final Map<String, dynamic>? data;

  RealtimeEvent({
    required this.type,
    this.subscriptionId,
    this.message,
    this.code,
    this.data,
  });

  factory RealtimeEvent.fromJson(Map<String, dynamic> json) {
    return RealtimeEvent(
      type: _parseType(json['type'] as String?),
      subscriptionId: json['subscription_id'] as String?,
      message: json['message'] as String?,
      code: json['code'] as String?,
      data: json['data'] as Map<String, dynamic>?,
    );
  }

  static RealtimeEventType _parseType(String? type) {
    switch (type) {
      case 'subscribed':
        return RealtimeEventType.subscribed;
      case 'unsubscribed':
        return RealtimeEventType.unsubscribed;
      case 'error':
        return RealtimeEventType.error;
      case 'pong':
        return RealtimeEventType.pong;
      case 'message':
        return RealtimeEventType.message;
      default:
        return RealtimeEventType.error;
    }
  }
}

/// Manages the WebSocket connection to the Forge realtime service.
class RealtimeService {
  final String _gatewayUrl;
  final AuthState _authState;

  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _subscription;
  final StreamController<RealtimeEvent> _eventController = StreamController<RealtimeEvent>.broadcast();
  Timer? _pingTimer;
  bool _isConnected = false;
  bool _shouldReconnect = false;

  /// Active subscriptions: key is the table name.
  final Map<String, Map<String, dynamic>> _subscriptions = {};

  RealtimeService({
    required String gatewayUrl,
    required AuthState authState,
  })  : _gatewayUrl = gatewayUrl,
        _authState = authState;

  // ── Getters ────────────────────────────────────────────────

  bool get isConnected => _isConnected;
  Stream<RealtimeEvent> get events => _eventController.stream;

  /// Stream filtered to data events only (table changes).
  Stream<Map<String, dynamic>> get dataEvents => _eventController.stream
      .where((event) => event.type == RealtimeEventType.message && event.data != null)
      .map((event) => event.data!);

  /// Stream filtered to error events.
  Stream<RealtimeEvent> get errorEvents =>
      _eventController.stream.where((event) => event.type == RealtimeEventType.error);

  // ── Connection Management ─────────────────────────────────

  /// Connect to the realtime WebSocket server.
  Future<void> connect() async {
    if (_isConnected) return;

    final token = _authState.accessToken;
    if (token == null || token.isEmpty) {
      throw ForgeException.unauthorized('Access token required for realtime connection');
    }

    _shouldReconnect = true;

    try {
      // Build WebSocket URL with token
      final wsUrl = _gatewayUrl
          .replaceFirst('http://', 'ws://')
          .replaceFirst('https://', 'wss://');
      final url = Uri.parse('$wsUrl/ws?token=$token');

      _channel = WebSocketChannel.connect(url);
      _isConnected = true;

      // Listen for messages
      _subscription = _channel!.stream.listen(
        (data) {
          if (data is String) {
            try {
              final json = jsonDecode(data) as Map<String, dynamic>;
              final event = RealtimeEvent.fromJson(json);
              _eventController.add(event);
            } catch (e) {
              debugPrint('[Realtime] Failed to parse message: $e');
            }
          }
        },
        onError: (error) {
          debugPrint('[Realtime] Connection error: $error');
          _handleDisconnect();
        },
        onDone: () {
          debugPrint('[Realtime] Connection closed');
          _handleDisconnect();
        },
      );

      // Send ping every 30 seconds
      _pingTimer = Timer.periodic(const Duration(seconds: 30), (_) {
        sendMessage({'type': 'ping'});
      });

      debugPrint('[Realtime] Connected');
    } catch (e) {
      _isConnected = false;
      debugPrint('[Realtime] Connection failed: $e');
      if (_shouldReconnect) {
        await _attemptReconnect();
      }
    }
  }

  /// Disconnect from the WebSocket server.
  Future<void> disconnect() async {
    _shouldReconnect = false;
    _pingTimer?.cancel();
    _pingTimer = null;

    await _subscription?.cancel();
    _subscription = null;

    await _channel?.sink.close();
    _channel = null;
    _isConnected = false;

    debugPrint('[Realtime] Disconnected');
  }

  /// Send a JSON message to the server.
  void sendMessage(Map<String, dynamic> message) {
    if (_channel != null && _isConnected) {
      _channel!.sink.add(jsonEncode(message));
    }
  }

  // ── Subscription Management ───────────────────────────────

  /// Subscribe to changes on a table.
  void subscribe({
    required String table,
    String? rowId,
    Map<String, dynamic>? filter,
  }) {
    final key = '$table${rowId != null ? ':$rowId' : ''}';
    _subscriptions[key] = {
      'table': table,
      if (rowId != null) 'row_id': rowId,
      if (filter != null) 'filter': filter,
    };

    sendMessage({
      'type': 'subscribe',
      'table': table,
      if (rowId != null) 'row_id': rowId,
      if (filter != null) 'filter': filter,
    });
  }

  /// Unsubscribe from a table.
  void unsubscribe({required String table, String? rowId}) {
    final key = '$table${rowId != null ? ':$rowId' : ''}';
    _subscriptions.remove(key);

    sendMessage({
      'type': 'unsubscribe',
      'table': table,
      if (rowId != null) 'row_id': rowId,
    });
  }

  /// Resubscribe all active subscriptions (used after reconnect).
  void _resubscribeAll() {
    for (final sub in _subscriptions.values) {
      sendMessage({
        'type': 'subscribe',
        'table': sub['table'],
        if (sub['row_id'] != null) 'row_id': sub['row_id'],
        if (sub['filter'] != null) 'filter': sub['filter'],
      });
    }
  }

  // ── Reconnection ──────────────────────────────────────────

  void _handleDisconnect() {
    _isConnected = false;
    _pingTimer?.cancel();

    if (_shouldReconnect) {
      _attemptReconnect();
    }
  }

  Future<void> _attemptReconnect() async {
    // Exponential backoff: 1s, 2s, 4s, 8s... up to 30s
    int delay = 1;
    while (_shouldReconnect) {
      debugPrint('[Realtime] Reconnecting in ${delay}s...');
      await Future.delayed(Duration(seconds: delay));

      try {
        await connect();
        if (_isConnected) {
          _resubscribeAll();
          return;
        }
      } catch (e) {
        debugPrint('[Realtime] Reconnect attempt failed: $e');
      }

      delay = (delay * 2).clamp(1, 30);
    }
  }

  // ── Cleanup ───────────────────────────────────────────────

  void dispose() {
    _shouldReconnect = false;
    _pingTimer?.cancel();
    _subscription?.cancel();
    _channel?.sink.close();
    _eventController.close();
    _isConnected = false;
  }
}
