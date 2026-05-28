# Mobile companion app — docs

Native iOS (SwiftUI) + Android (Jetpack Compose) with Kotlin Multiplatform shared layer.

## Branch

All mobile work lives on **`feature/mobile-native`**, branched from **`v2-auth-sso-versioning`**.

```bash
git checkout v2-auth-sso-versioning
git pull origin v2-auth-sso-versioning
git checkout feature/mobile-native
```

PRs target `v2-auth-sso-versioning`, not `main`.

## CI Docker image (GHCR)

On push to `feature/mobile-native`, [`.github/workflows/docker-mobile-native-ghcr.yml`](../../.github/workflows/docker-mobile-native-ghcr.yml) builds the same production image as the web app (includes `/api/mobile/v1`) and pushes to GitHub Container Registry. This is separate from the `main` / `v2` / `v2-auth-sso-versioning` workflows.

```bash
docker pull ghcr.io/vituhlos/objednavky-jidla:mobile-native
# pin to a specific commit (short SHA tag):
docker pull ghcr.io/vituhlos/objednavky-jidla:mobile-native-<short-sha>
```

Package visibility follows the repo; authenticate with a PAT or `gh auth token` if the image is private.

## Phase 0 deliverables (this branch)

| File | Description |
|------|-------------|
| [wireframes-v1.md](./wireframes-v1.md) | Low-fi screens, flows, offline UX |
| [api-v1.openapi.yaml](./api-v1.openapi.yaml) | REST contract under `/api/mobile/v1` |

## Phase 1 — mobile API routes (implemented)

Handlers live under `app/api/mobile/v1/`:

| Area | Routes |
|------|--------|
| Auth | `auth/login`, `auth/refresh`, `auth/logout`, `auth/device-pair` |
| Pairing | `pairing/qr`, `pairing/qr/[pairingId]/status` |
| Config | `config`, `departments` |
| Profile | `me` |
| Menu | `menu/weeks`, `menu`, `menu/day` |
| Orders | `orders`, `orders/[orderId]`, `orders/[orderId]/rows`, `orders/rows/[rowId]`, `orders/[orderId]/send` |
| History | `history/orders`, `history/stats` |
| Push | `push/register` (FCM/APNs token storage), `push/test` (admin FCM test) |

Supporting libs: `lib/mobile-jwt.ts`, `lib/mobile-auth.ts`, `lib/mobile-pairing.ts`, `lib/mobile-api.ts`, `lib/mobile-user.ts`, `lib/mobile-push.ts`.

OAuth mobile routes (`auth/oauth/*`) and delta sync (`sync/since`) are spec-only for now.

## Implementation order (remaining)

1. ~~**API routes**~~ — done (`app/api/mobile/v1/`)
2. ~~**Web QR UI**~~ — done (`MobilePairingQr` on `/profil`, tab Profil)
3. **KMP scaffold** — `mobile/shared`, `mobile/androidApp`, `mobile/iosApp`
4. **Read-only v0** — login, QR pair, menu cache, history
5. **Draft ordering** — outbox + sync in app
6. ~~**Push delivery**~~ — server-side FCM send via `lib/mobile-push.ts` (legacy HTTP API; iOS APNs direct TBD)
7. **OAuth mobile** — `auth/oauth/start`, `auth/oauth/callback`

## QR pairing (v1)

- Web (logged in): `POST /api/mobile/v1/pairing/qr` → display QR
- Mobile: scan `kantyna://pair?v=1&token=…` → `POST /api/mobile/v1/auth/device-pair`
- Token: one-time, TTL 120s

Existing [`app/api/profil/qr/route.ts`](../../app/api/profil/qr/route.ts) encodes user **name** only — not used for mobile pairing.

## Push notifications (FCM)

Native apps register device tokens via `POST /api/mobile/v1/push/register`. The server sends reminders through Firebase Cloud Messaging (legacy HTTP API).

| Variable / setting | Description |
|--------------------|-------------|
| `FCM_SERVER_KEY` | Firebase **Server key** (Project settings → Cloud Messaging). Env var or `fcm_server_key` in app settings DB. |
| Web push (separate) | VAPID keys in settings — used only for browser push via `lib/push.ts`. |

Scheduler integration: `checkPushReminder` in `lib/scheduler.ts` sends the same cutoff reminder to web subscriptions and mobile tokens (users who have not ordered yet).

Admin test (mobile JWT, admin role): `POST /api/mobile/v1/push/test` — sends a test notification to the caller's registered devices.

## Domain reference

Types mirror [`lib/types.ts`](../../lib/types.ts). Key rules from web app:

- Order `status`: `draft` | `sent` — edits blocked when `sent`
- Row `department` = `DepartmentInfo.name`
- **Send order**: admin only
- Row ownership: user can edit own rows; admin bypasses
