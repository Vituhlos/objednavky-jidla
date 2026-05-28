# Kantýna iOS app (SwiftUI)

The Kotlin Multiplatform **shared** module exports a static framework named `Shared` for iOS. This folder contains a minimal SwiftUI shell with four bottom tabs matching the wireframes.

> **Windows note:** Xcode cannot run on Windows. Generate the framework on macOS (or CI) and open `KantynaIOS.xcodeproj` in Xcode 15+.

## Prerequisites

- macOS with Xcode 15+
- JDK 17+ (for Gradle framework build)
- CocoaPods not required (SPM / direct framework embed)

## 1. Build the Kotlin framework

From the `mobile/` directory:

```bash
# Device (physical iPhone)
./gradlew :shared:linkReleaseFrameworkIosArm64

# Simulator (Apple Silicon Mac)
./gradlew :shared:linkReleaseFrameworkIosSimulatorArm64
```

Framework output (example, Simulator):

```
shared/build/bin/iosSimulatorArm64/releaseFramework/Shared.framework
```

## 2. Wire framework into Xcode

1. Open `iosApp/KantynaIOS.xcodeproj` in Xcode.
2. Select the **KantynaIOS** target → **General** → **Frameworks, Libraries, and Embedded Content**.
3. Click **+** → **Add Other…** → **Add Files…** and select `Shared.framework` from the Gradle output path above.
4. Set embed to **Embed & Sign** (or **Do Not Embed** if linking statically per your build settings).
5. Add a **Run Script** build phase (before Compile Sources) if you want automatic rebuilds:

```bash
cd "$SRCROOT/.."
./gradlew :shared:linkReleaseFrameworkIosSimulatorArm64
```

Adjust the Gradle task for device vs simulator builds.

## 3. Import shared APIs in Swift

```swift
import Shared

// Example: read production API base URL
let baseUrl = ApiConfig.shared.PRODUCTION_BASE_URL
```

Auth and DTO types are exposed from the `cz.pbas.kantyna.mobile` package.

## 4. Run the app

Select an iOS Simulator or device, then **Product → Run**. The scaffold shows a `TabView` with **Oběd**, **Jídelníček**, **Historie**, and **Profil** placeholders.

## Deep links (future)

Pairing QR format: `kantyna://pair?v=1&token={opaque}` — register URL schemes in `Info.plist` when implementing device pairing.

## Related docs

- [../README.md](../README.md) — mobile monorepo overview
- [../../docs/mobile/api-v1.openapi.yaml](../../docs/mobile/api-v1.openapi.yaml)
- [../../docs/mobile/wireframes-v1.md](../../docs/mobile/wireframes-v1.md)
