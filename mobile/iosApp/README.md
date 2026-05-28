# Kantýna iOS app (SwiftUI)

Minimal SwiftUI shell for the Kotlin Multiplatform **shared** module. Matches the Android app structure: auth gate → four bottom tabs (**Oběd**, **Jídelníček**, **Historie**, **Profil**) with Czech labels and brand accent `#EA580C`.

> **Windows note:** Xcode cannot run on Windows. Build the Kotlin framework on macOS (or CI), then open `KantynaIOS.xcodeproj` in Xcode 15+.

## Project layout

```
iosApp/
├── KantynaIOS.xcodeproj/
└── KantynaIOS/
    ├── KantynaIOSApp.swift   # @main entry point
    ├── KantynaApp.swift      # Auth gate + tab root (mirrors Android KantynaApp)
    ├── AuthSession.swift     # UserDefaults token stub until Shared AuthRepository
    ├── Color+Brand.swift     # #EA580C brand accent
    ├── LoginView.swift       # Login placeholder (email/password + QR stub)
    └── MainTabView.swift     # TabView with four wireframe tabs
```

## Prerequisites

| Tool | Version |
|------|---------|
| macOS | Ventura+ |
| Xcode | 15+ |
| JDK | 17+ (Gradle framework build) |
| CocoaPods | Not required |

## 1. Build the Kotlin `Shared` framework

All commands run from the `mobile/` directory.

### Release (recommended for Xcode embed)

```bash
# Physical device (iPhone / iPad)
./gradlew :shared:linkReleaseFrameworkIosArm64

# Simulator — Apple Silicon Mac
./gradlew :shared:linkReleaseFrameworkIosSimulatorArm64

# Simulator — Intel Mac (legacy)
./gradlew :shared:linkReleaseFrameworkIosX64
```

### Debug (faster iteration)

```bash
./gradlew :shared:linkDebugFrameworkIosSimulatorArm64
./gradlew :shared:linkDebugFrameworkIosArm64
```

### Framework output paths

| Target | Release path |
|--------|----------------|
| Device | `shared/build/bin/iosArm64/releaseFramework/Shared.framework` |
| Simulator (Apple Silicon) | `shared/build/bin/iosSimulatorArm64/releaseFramework/Shared.framework` |
| Simulator (Intel) | `shared/build/bin/iosX64/releaseFramework/Shared.framework` |

The framework is **static** (`isStatic = true` in `shared/build.gradle.kts`).

### Windows / CI-only workflow

From Windows you can still compile the framework if a macOS runner or remote Mac is available:

```bash
cd mobile
./gradlew :shared:linkReleaseFrameworkIosSimulatorArm64
```

Copy the resulting `Shared.framework` to the Mac that runs Xcode, or consume it from CI artifacts.

## 2. Embed framework in Xcode

1. Open `iosApp/KantynaIOS.xcodeproj` in Xcode.
2. Select the **KantynaIOS** target → **General** → **Frameworks, Libraries, and Embedded Content**.
3. Click **+** → **Add Other…** → **Add Files…** and pick `Shared.framework` from the Gradle output path above.
4. For a **static** framework, set embed to **Do Not Embed** (link only). For dynamic builds, use **Embed & Sign**.
5. Confirm **Build Settings → Framework Search Paths** includes the directory containing `Shared.framework` (Xcode usually adds this when you embed).

### Optional: auto-rebuild Shared before compile

Add a **Run Script** build phase on the **KantynaIOS** target, **before** **Compile Sources**:

```bash
cd "$SRCROOT/.."
if [ "$PLATFORM_NAME" = "iphonesimulator" ]; then
  ./gradlew :shared:linkReleaseFrameworkIosSimulatorArm64
else
  ./gradlew :shared:linkReleaseFrameworkIosArm64
fi
```

Adjust `linkDebugFramework*` vs `linkReleaseFramework*` to match your workflow.

## 3. Import Shared APIs in Swift (future)

Once the framework is linked, replace `AuthSession` stubs with KMP types:

```swift
import Shared

// API base URL
let baseUrl = ApiConfig.shared.PRODUCTION_BASE_URL

// Auth — wire RootViewModel equivalent
// let authRepository = AuthRepository(...)
```

Exposed packages mirror Android: `cz.pbas.kantyna.mobile.auth`, `.dto`, `.menu`, `.history`, etc.

### Suggested integration order

1. Link `Shared.framework` and verify `import Shared` compiles.
2. Replace `AuthSession.loginStub()` with `AuthRepository.login(email:password:)`.
3. Swap tab placeholders for SwiftUI views calling `MenuRepository`, `HistoryRepository`.
4. Add Keychain storage for tokens (replace `UserDefaults` stub).

## 4. Run the app

1. Select an iOS Simulator or connected device.
2. **Product → Run** (⌘R).

Expected flow:

- **Logged out:** `LoginView` with Kantýna title, email/password fields, stub login button.
- **Logged in:** `MainTabView` with four tabs; **Profil** includes a stub logout action.

Auth is gated by a `UserDefaults` token (`kantyna.authToken`) until Shared auth is wired.

## 5. Branding

Accent color `#EA580C` is defined in `Color+Brand.swift` as `Color.brandAccent` and applied via `.tint()` on the root and tab bar.

## Deep links (future)

Pairing QR format: `kantyna://pair?v=1&token={opaque}`

Register URL schemes in `Info.plist` when implementing device pairing:

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>kantyna</string>
        </array>
    </dict>
</array>
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `import Shared` fails | Rebuild framework for the correct slice (simulator vs device). |
| Undefined symbols at link | Ensure framework matches architecture; clean build folder. |
| Gradle task not found | Run from `mobile/`; use `./gradlew tasks --group=build` to list iOS tasks. |

## Related docs

- [../README.md](../README.md) — mobile monorepo overview
- [../../docs/mobile/api-v1.openapi.yaml](../../docs/mobile/api-v1.openapi.yaml)
- [../../docs/mobile/wireframes-v1.md](../../docs/mobile/wireframes-v1.md)
