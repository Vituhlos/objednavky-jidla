# Kantýna — native mobile (KMP)

Kotlin Multiplatform companion app for [objednavky-jidla](https://github.com/) (lunch ordering). Consumes the versioned REST API at `/api/mobile/v1`.

## Branch strategy

| Branch | Purpose |
|--------|---------|
| `feature/mobile-native` | **All mobile work** — KMP scaffold, Android, iOS |
| `v2-auth-sso-versioning` | Web/backend SSO — **do not merge mobile here until tested** |
| `main` | Production web app |

Merge mobile into the base branch only after full on-device testing.

## Project layout

```
mobile/
├── shared/          # KMP: API client, DTOs, auth skeleton, SQLDelight cache/outbox
├── androidApp/      # Jetpack Compose shell (4 tabs)
├── iosApp/          # SwiftUI shell + Xcode project (build shared framework on Mac)
└── gradle/          # Version catalog + wrapper
```

## Open in Android Studio

1. Install **Android Studio Ladybug** (or newer) with JDK **17+**.
2. **File → Open** → select this `mobile/` folder (not the repo root).
3. Wait for Gradle sync.
4. Run configuration **androidApp** on an emulator or device (API 26+).

### API base URL

Production default (in shared `ApiConfig`):

```
https://kantyna2.pbas.cz/api/mobile/v1
```

Local Next.js dev (Android emulator → host machine):

```kotlin
ApiConfig.setDevBaseUrl("http://10.0.2.2:3000/api/mobile/v1")
```

## Build from CLI

```bash
cd mobile
./gradlew :androidApp:assembleDebug
./gradlew :shared:build
```

## iOS

See [iosApp/README.md](iosApp/README.md) for framework export and Xcode wiring. Xcode is required on macOS.

## Push (server)

Set on the Next.js host (not in the KMP app):

| Env | Purpose |
|-----|---------|
| `FCM_SERVER_KEY` | Firebase server key for native push delivery |

See [../docs/mobile/README.md](../docs/mobile/README.md#push-notifications-fcm) for API routes and scheduler behaviour.

## Push (Android / FCM)

The Android app registers FCM device tokens with `POST /api/mobile/v1/push/register` after login and on cold start when a session exists. Logout sends `DELETE /api/mobile/v1/push/register` with the stored token.

### Firebase setup

1. Open [Firebase Console](https://console.firebase.google.com/) → **Add project** (or use an existing one).
2. **Add app** → Android → package name **`cz.pbas.kantyna.mobile`** (must match `applicationId` in `androidApp/build.gradle.kts`).
3. Download **`google-services.json`** and replace the placeholder at:

   ```
   mobile/androidApp/google-services.json
   ```

   The committed placeholder only satisfies the Gradle `google-services` plugin for local builds; **FCM token registration requires the real file** from your Firebase project.

4. In Firebase → **Project settings → Cloud Messaging**, copy the **Server key** (legacy) into the Next.js host as `FCM_SERVER_KEY` (see table above).

5. Sync Gradle and run **androidApp** on a device or emulator with Google Play services. After login, confirm the token row appears in `mobile_device_tokens` (or use admin `POST /api/mobile/v1/push/test`).

### Notification channel

Android 8+ uses channel **„Připomínky objednávky“** (`order_reminders`). Tapping a notification with `data.url` opens the **Oběd** tab.

### Permissions

Android 13+ prompts for `POST_NOTIFICATIONS` when the main tabs screen loads. Token registration still runs without the permission; notifications are shown only after grant.

## Documentation

| Doc | Path |
|-----|------|
| OpenAPI contract | [../docs/mobile/api-v1.openapi.yaml](../docs/mobile/api-v1.openapi.yaml) |
| Wireframes v1 | [../docs/mobile/wireframes-v1.md](../docs/mobile/wireframes-v1.md) |
| Mobile plan | [../docs/mobile/README.md](../docs/mobile/README.md) (if present) |

## Stack

- **Shared:** Kotlin 2.0, Ktor 3, kotlinx.serialization, Coroutines, SQLDelight 2
- **Android:** Jetpack Compose, Material 3, Navigation — brand `#EA580C`
- **iOS:** SwiftUI TabView (consumes `Shared` framework)

## Package

`cz.pbas.kantyna.mobile`
