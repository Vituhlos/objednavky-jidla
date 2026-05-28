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
