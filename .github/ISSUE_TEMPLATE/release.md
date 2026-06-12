---
name: Release
about: Checklist pro vydání nové verze Kantýny
title: "Release vX.Y.Z"
labels: release
assignees: ""
---

## Release vX.Y.Z

### Rozsah

- [ ] Rozhodnutý typ releasu: PATCH / MINOR / MAJOR / prerelease
- [ ] Zkontrolované změny od posledního tagu
- [ ] Zkontrolované migrační dopady na SQLite, env proměnné, Docker a zálohy

### Příprava

- [ ] Aktualizovaný `package.json`
- [ ] Aktualizovaný `package-lock.json`
- [ ] Aktualizovaný `CHANGELOG.md`
- [ ] Aktualizované `lib/release-notes.ts`, pokud se má změna zobrazit v aplikaci
- [ ] Aktualizovaný README nebo dokumentace, pokud se mění nasazení nebo chování

### Ověření

- [ ] `npm run build`
- [ ] `npm run lint`, pokud je pro daný release užitečný
- [ ] Ověřená hlavní objednávka
- [ ] Ověřený jídelníček/import PDF
- [ ] Ověřený export PDF nebo e-mail, pokud se změna dotýká objednávek
- [ ] Ověřené `Nastavení -> Systém -> O aplikaci`
- [ ] Ověřené `/api/health`
- [ ] Ověřené `/api/version`
- [ ] Stažená testovací záloha dat

### Vydání

- [ ] Commit release změn
- [ ] Anotovaný tag `vX.Y.Z`
- [ ] Push commitů
- [ ] Push tagu
- [ ] GitHub Actions doběhly úspěšně
- [ ] GitHub Release obsahuje release notes
- [ ] GHCR obsahuje očekávané Docker tagy

### Po vydání

- [ ] Produkční nasazení používá přesný tag `X.Y.Z`
- [ ] `/api/health` v produkci vrací `ok`
- [ ] `/api/version` v produkci ukazuje správnou verzi, commit a Docker tag
- [ ] Rollback plán je známý a proveditelný
