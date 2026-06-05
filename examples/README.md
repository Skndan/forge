# Forge Example Apps

> Example applications demonstrating Forge's features across different platforms.

---

## Available Examples

| App | Platform | Features Demonstrated |
|---|---|---|
| [Todo App](./todo/README.md) | Flutter | CRUD, auth, realtime sync |
| [Chat App](./chat/README.md) | Flutter | Realtime messaging, multi-tenant rooms |
| [File Gallery](./file-gallery/README.md) | Flutter | File upload/download via S3, presigned URLs |

---

## Using the Examples

Each example is a standalone Flutter app. To run one:

```bash
cd examples/<app-name>
flutter run
```

Make sure the Forge stack is running first:

```bash
cd ../..
docker compose up -d
```
