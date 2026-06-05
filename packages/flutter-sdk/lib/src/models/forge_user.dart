/// Models for Forge API responses.

import 'dart:convert';

/// User model representing an authenticated user.
class ForgeUser {
  final String sub;
  final String email;
  final String name;
  final String preferredUsername;
  final String? tenantId;
  final List<String> roles;
  final String? picture;

  ForgeUser({
    required this.sub,
    required this.email,
    required this.name,
    required this.preferredUsername,
    this.tenantId,
    this.roles = const [],
    this.picture,
  });

  bool get isAdmin => roles.contains('admin');

  factory ForgeUser.anonymous() => ForgeUser(
        sub: '',
        email: '',
        name: 'Anonymous',
        preferredUsername: 'anonymous',
      );

  factory ForgeUser.fromJson(Map<String, dynamic> json) => ForgeUser(
        sub: json['sub'] ?? json['id'] ?? '',
        email: json['email'] ?? '',
        name: json['name'] ?? json['display_name'] ?? '',
        preferredUsername: json['preferred_username'] ?? '',
        tenantId: json['tenant_id'],
        roles: List<String>.from(json['roles'] ?? json['client_roles'] ?? []),
        picture: json['picture'] ?? json['avatar_url'],
      );

  Map<String, dynamic> toJson() => {
        'sub': sub,
        'email': email,
        'name': name,
        'preferred_username': preferredUsername,
        'tenant_id': tenantId,
        'roles': roles,
        'picture': picture,
      };

  @override
  String toString() => 'ForgeUser(email: $email, name: $name, tenant: $tenantId)';
}
