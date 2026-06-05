# Forge Example: Chat App

> A realtime chat application built with the Forge Flutter SDK.

---

## Overview

This example demonstrates:
- Realtime messaging using WebSocket subscriptions
- Multi-tenant chat rooms
- File attachments (images) via RustFS
- User presence tracking

## Prerequisites

- Flutter 3.x
- Forge stack running locally

## Setup

### 1. Create Database Tables

```bash
docker exec -i forge-postgres psql -U forge forge << 'SQL'
-- Chat rooms
CREATE TABLE forge.chat_rooms (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL DEFAULT current_setting('app.current_tenant_id')::uuid,
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE forge.chat_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON forge.chat_rooms
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Messages
CREATE TABLE forge.chat_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES forge.chat_rooms(id),
  user_id uuid NOT NULL,
  content text NOT NULL,
  attachment_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE forge.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON forge.chat_messages
  FOR ALL USING (
    room_id IN (
      SELECT id FROM forge.chat_rooms
      WHERE tenant_id = current_setting('app.current_tenant_id')::uuid
    )
  );

-- Add triggers
CREATE TRIGGER notify_chat_messages_change
  AFTER INSERT ON forge.chat_messages
  FOR EACH ROW EXECUTE FUNCTION forge.notify_change();
SQL
```

### 2. Configure & Run

```bash
cd examples/chat
flutter run
```

## Features

### Send Message

```dart
await forge.db.execute(
  'INSERT INTO forge.chat_messages (room_id, user_id, content) VALUES (@roomId, @userId, @content)',
  params: {'roomId': roomId, 'userId': userId, 'content': 'Hello!'},
);
```

### Realtime Message Stream

```dart
forge.realtime
  .channel('chat_messages')
  .filter('room_id', 'eq', currentRoomId)
  .on('INSERT', (payload) {
    setState(() => _messages.add(Message.fromJson(payload.newRecord)));
  })
  .subscribe();
```
