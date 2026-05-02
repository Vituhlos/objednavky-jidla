<div align="center">

<img src="./docs/logo.svg" width="96" height="96" alt="Kantýna logo" />

# Kantýna

**Firemní systém pro objednávky obědů a pizzy**

[![Docker](https://img.shields.io/badge/Docker-ghcr.io-0ea5e9?style=flat-square&logo=docker&logoColor=white)](https://ghcr.io/vituhlos/objednavky-jidla)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003b57?style=flat-square&logo=sqlite)](https://github.com/WiseLibs/better-sqlite3)

</div>

---

Webová aplikace pro týmy, které si každý den objednávají obědy z firemní kantýny. Sdílený objednávkový list, real-time synchronizace, automatické odesílání e-mailem s PDF přílohou. Jeden Docker kontejner, SQLite databáze, žádná cloud závislost.

---

## Funkce

### Objednávky obědů

- Sdílený objednávkový list rozdělený na oddělení — plně konfigurovatelná správa
- Výběr polévky, hlavního jídla, příloh a doplňků s automatickým výpočtem ceny
- Druhá polévka, extra jídla, počet porcí, poznámka k objednávce
- **Real-time synchronizace přes SSE** — změny ostatních se zobrazí okamžitě
- Živý odpočet do uzávěrky s barevným upozorněním (zelená → oranžová → červená)
- Souhrn počtu objednávek a celkové ceny přímo v navigaci

### Jídelníček

- Import přímo z PDF — automaticky rozpozná polévky a jídla podle dnů v týdnu
- Ruční přidávání a úprava položek, správa aktuálního i příštího týdne
- Uzavření konkrétního dne (státní svátek, dovolená)

### Automatické odesílání

- Nastavitelný čas, dny v týdnu a minimální počet objednávek
- Přeskočí automaticky zavřené dny detekované z jídelníčku
- Znovu odeslat e-mail bez změny stavu objednávky

### E-mail a PDF

- Odeslání e-mailem s PDF přílohou pro každé oddělení zvlášť
- Konfigurovatelní příjemci, volitelný extra CC e-mail
- Test SMTP připojení přímo z nastavení

### Pizza

- Sdílený objednávkový list s ceníkem načteným automaticky ze stránek pizzerie
- Automatický výpočet ceny

### Historie a audit

- Přehled všech odeslaných i rozepsaných objednávek s detailem
- Audit log — záznamy o přidání/smazání řádků, odeslání, znovuotevření

### Nastavení (chráněno PINem)

- SMTP, příjemci, uzávěrka, ceny jídel a příloh
- Správa oddělení — přidat, přejmenovat, barva, pořadí, smazat
- Záloha a obnova dat (JSON export/import, přídavná — nepřepíše stávající záznamy)

---

## Technologie

| Vrstva | Technologie |
|---|---|
| Framework | Next.js 15 (App Router, Server Actions) |
| UI | React 19, Tailwind CSS 4 |
| Databáze | SQLite — better-sqlite3 |
| Real-time | Server-Sent Events (SSE) |
| E-mail | nodemailer |
| PDF export | pdfkit |
| PDF import | pdf-parse |
| Scheduler | node-cron |
| Runtime | Node.js 24, Docker |

---

## Spuštění

### Docker

```bash
docker run -d \
  --name kantyna \
  -p 3000:3000 \
  -v /path/to/data:/app/data \
  -e SMTP_HOST=smtp.gmail.com \
  -e SMTP_PORT=587 \
  -e SMTP_USER=vas@email.cz \
  -e SMTP_PASS=heslo \
  -e ORDER_EMAIL_TO=prijemce@firma.cz \
  -e SETTINGS_PIN=1234 \
  ghcr.io/vituhlos/objednavky-jidla:latest
```

### Docker Compose

```yaml
services:
  kantyna:
    image: ghcr.io/vituhlos/objednavky-jidla:latest
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      SMTP_HOST: smtp.gmail.com
      SMTP_PORT: 587
      SMTP_USER: vas@email.cz
      SMTP_PASS: heslo
      ORDER_EMAIL_TO: prijemce@firma.cz
      SETTINGS_PIN: 1234
```

Aplikace poběží na `http://localhost:3000`. SQLite databáze se vytvoří automaticky v namountovaném `/app/data`.

---

## Proměnné prostředí

| Proměnná | Popis | Výchozí |
|---|---|---|
| `SMTP_HOST` | SMTP server | — |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP uživatel | — |
| `SMTP_PASS` | SMTP heslo | — |
| `SMTP_FROM` | Odesílatel (From) | = SMTP_USER |
| `SMTP_SECURE` | Použít TLS | `false` |
| `ORDER_EMAIL_TO` | Výchozí příjemce objednávky | — |
| `SETTINGS_PIN` | PIN pro stránku Nastavení | `1234` |
| `DB_PATH` | Cesta k SQLite souboru | `/app/data/stros.db` |

> Nastavení lze měnit také přímo v aplikaci přes `/nastaveni` (chráněno PINem). Hodnoty uložené v aplikaci mají přednost před env proměnnými.

---

## Lokální vývoj

```bash
npm install
npm run dev       # http://localhost:3000
```

```bash
docker build -t kantyna .
```

---

<div align="center">
<sub>Interní nástroj · SQLite · jeden kontejner · žádná cloud závislost</sub>
</div>
