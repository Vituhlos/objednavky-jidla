# Security Review — Auth systém v4

Datum: 2026-05-20

---

## 🔴 KRITICKÉ

### C1 — Middleware nekontroluje token v databázi
**Soubor:** `middleware.ts` (řádky 15–19)

Middleware jen ověří že cookie existuje, ale nekontroluje jestli session je v DB,
není expirovaná nebo patří aktivnímu uživateli. Smazaná/expirovaná/podvržená session projde.

**Fix:**
```ts
import { getSessionUser } from "@/lib/auth";
// ...
const token = request.cookies.get(COOKIE_NAME)?.value;
if (!token || !getSessionUser(token)) {
  return NextResponse.redirect(new URL("/login", request.url));
}
```

---

### C2 — PIN nastavení hashován SHA-256 bez soli
**Soubor:** `lib/settings.ts` (řádky 4–6, 186–193)

`hashPin()` používá `createHash("sha256")` bez soli → 4-ciferný PIN prolomitelný
v milisekundách (rainbow tables). Navíc plaintext fallback pokud PIN nebyl nikdy
uložen přes UI (env `SETTINGS_PIN=1234` se porovnává v plaintextu).

PIN chrání SMTP přihlašovací údaje, Telegram bot token a nastavení auto-odesílání.

**Fix:** Nahradit `crypto.scryptSync` se salt (stejně jako auth.ts pro hesla).

---

## 🟠 HIGH

### H1 — Pizza řádky: chybí kontrola ownership
**Soubor:** `app/actions.ts` (řádky 192–208)

`actionUpdatePizzaRow` a `actionDeletePizzaRow` volají `requireAuth()` (jakýkoliv
přihlášený user) ale nepředávají `user.id` do DB funkce. Kdokoliv přihlášený může
editovat/smazat cizí pizza řádek znaje integer ID.

Obědové objednávky toto správně řeší — pizza ne.

---

### H2 — Password reset endpoint bez rate limitingu
**Soubor:** `app/api/auth/reset-password/route.ts`

Forgot-password route má rate limit (5/10 min). Samotný reset-password endpoint
(spotřebování tokenu + nastavení hesla) rate limiting nemá.

---

### H3 — Telegram webhook bez ověření podpisu
**Soubor:** `app/api/telegram/webhook/route.ts` (řádky 569–578)

Webhook přijímá libovolný POST z internetu. Kdokoliv kdo zná URL může poslat
falešný payload a spustit odeslání objednávky, změnu nastavení nebo rozeslání zprávy.

**Fix:** Nastavit a ověřovat `X-Telegram-Bot-Api-Secret-Token` header
(Telegram `setWebhook` parametr `secret_token`).

---

### H4 — Cookie `secure` flag závisí na spoofovatelném headeru
**Soubory:** `app/api/auth/login/route.ts` (ř. 33), `app/api/auth/register/route.ts` (ř. 59)

```ts
secure: req.headers.get("x-forwarded-proto") === "https",  // ← špatně
```

Pokud proxy nestrippuje `x-forwarded-proto`, attacker může header podvrhnout.

**Fix:**
```ts
secure: process.env.NODE_ENV === "production",
```

---

## 🟡 MEDIUM

### M1 — Race condition při registraci prvního admina
**Soubor:** `app/api/auth/register/route.ts` (řádky 46–47)

Count-check a INSERT nejsou v transakci. Dva simultánní requesty na prázdné DB
mohou oba dostat admin roli.

**Fix:** Obalit do `db.transaction()`.

---

### M2 — Telegram test/subscription akce bez auth guardu
**Soubor:** `app/actions.ts` (řádky 505–519)

`actionSendTelegramTest` (odešle zprávu všem uživatelům) a
`actionGetTelegramSubscriptions` nemají `requireAuth()` / `requireAdmin()`.

---

### M3 — PIN plaintext fallback přetrvává po první instalaci
**Soubor:** `lib/settings.ts` (řádky 186–193)

Pokud operátor nastaví `SETTINGS_PIN=mysecret` v env ale nikdy neuloží přes UI,
PIN se porovnává v plaintextu donekonečna (ne jen při prvním spuštění).

---

## ✅ Co je v pořádku

| Oblast | Stav |
|---|---|
| Hashing hesel | ✅ scrypt + 16-byte random salt + 64-byte output + timingSafeEqual |
| Session tokeny | ✅ `crypto.randomBytes(32)` = 256 bitů entropie |
| Expiry sessions | ✅ 30 dní, ověřováno v DB |
| Invalidace sessions | ✅ Logout smaže token; deaktivace uživatele smaže všechny jeho sessions |
| Password reset tokeny | ✅ Single-use, 1h expiry, 256-bit random, staré tokeny invalidovány |
| SQL injection | ✅ Všude prepared statements s `?`, žádná string interpolace |
| CSRF | ✅ Server Actions jsou POST-only same-origin (Next.js) |
| Rate limiting login | ✅ 10 pokusů / minutu / IP |
| Admin gating | ✅ `requireAdmin()` konzistentně na destruktivních akcích |
| Secrets na klientovi | ✅ Backup route správně vylučuje smtpPass, settingsPin, vapidPrivateKey |
| httpOnly cookie | ✅ Nastaveno v login i register |
| sameSite cookie | ✅ `lax` — vhodné pro tuto aplikaci |
