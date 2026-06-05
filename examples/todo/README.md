# Forge Example: Todo App

> A simple todo application built with the Forge Flutter SDK.

---

## Overview

This example demonstrates:
- User authentication with Keycloak (PKCE)
- CRUD operations on a `todos` table
- Realtime updates when todos change
- File upload for todo attachments

## Prerequisites

- Flutter 3.x
- Forge stack running locally (see [Quick Start](../../README.md#quick-start))

## Setup

### 1. Create the Database Table

```bash
docker exec -i forge-postgres psql -U forge forge << 'SQL'
CREATE TABLE IF NOT EXISTS forge.todos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL DEFAULT current_setting('app.current_tenant_id')::uuid,
  title text NOT NULL,
  completed boolean DEFAULT false,
  attachment_path text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE forge.todos ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY tenant_isolation ON forge.todos
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Add pg_notify trigger
CREATE TRIGGER notify_todos_change
  AFTER INSERT OR UPDATE OR DELETE ON forge.todos
  FOR EACH ROW EXECUTE FUNCTION forge.notify_change();
SQL
```

### 2. Configure the App

```dart
final forge = ForgeClient(
  baseUrl: 'http://localhost:3000',
  keycloakUrl: 'http://localhost:8080',
  realm: 'forge',
  clientId: 'forge-flutter',
);
```

### 3. Run

```bash
cd examples/todo
flutter run
```

## Features

### Add Todo

```dart
await forge.db.execute(
  'INSERT INTO forge.todos (title) VALUES (@title)',
  params: {'title': 'Buy groceries'},
);
```

### List Todos

```dart
final todos = await forge.db.query(
  'SELECT * FROM forge.todos ORDER BY created_at DESC',
);
```

### Toggle Completion

```dart
await forge.db.execute(
  'UPDATE forge.todos SET completed = @completed, updated_at = now() WHERE id = @id',
  params: {'id': todoId, 'completed': true},
);
```

### Realtime Sync

```dart
forge.realtime
  .channel('todos')
  .on('INSERT', (p) => setState(() => _todos.insert(0, Todo.fromJson(p.newRecord))))
  .on('UPDATE', (p) => setState(() => _updateTodo(Todo.fromJson(p.newRecord))))
  .on('DELETE', (p) => setState(() => _removeTodo(p.oldRecord['id'])))
  .subscribe();
```

## File Structure

```
examples/todo/
├── lib/
│   ├── main.dart
│   ├── pages/
│   │   ├── login_page.dart
│   │   └── todo_list_page.dart
│   ├── models/
│   │   └── todo.dart
│   └── services/
│       └── forge_service.dart
├── pubspec.yaml
└── README.md
```
