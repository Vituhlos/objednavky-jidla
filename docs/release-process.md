# Release process

Tento projekt používá jeden profesionální release model: SemVer + ručně kurátorovaný changelog + tag-based Docker release.

Proces je záměrně jednoduchý, ale přísný. Cílem je, aby každá verze šla zpětně dohledat, bezpečně nasadit, vrátit a vysvětlit člověku, který aplikaci používá.

## Standardy

- Verze dodržují Semantic Versioning 2.0.0: `MAJOR.MINOR.PATCH`.
- Changelog dodržuje Keep a Changelog 1.1.0.
- Commit zprávy mají používat Conventional Commits.
- Docker image se vydává z git tagů, ne pouze z náhodného pushnutí do větve.

Referenční zdroje:

- https://semver.org/spec/v2.0.0.html
- https://keepachangelog.com/en/1.1.0/
- https://www.conventionalcommits.org/en/v1.0.0/
- https://github.com/docker/metadata-action

## Význam verzí

- `PATCH` (`1.0.2` -> `1.0.3`): opravy chyb, bezpečnostní opravy, malé interní změny bez změny chování pro uživatele.
- `MINOR` (`1.0.2` -> `1.1.0`): nové funkce, rozšíření UI, nové nastavení, kompatibilní změny databáze nebo Docker konfigurace.
- `MAJOR` (`1.0.2` -> `2.0.0`): změny vyžadující ruční migraci, ztrátu kompatibility, zásadní změnu nasazení, odstranění funkce nebo nekompatibilní změnu dat.
- Prerelease (`1.1.0-beta.1`, `1.1.0-rc.1`): pouze pro testování před stabilním vydáním.

Pro tuto aplikaci je "public API" definované šířeji než jen HTTP API. Patří sem:

- chování uživatelského rozhraní,
- formát a význam uložených dat v SQLite,
- env proměnné,
- Docker image, volume a porty,
- exporty/importy záloh,
- Telegram, e-mail, PDF a další integrační chování.

## Changelog

`CHANGELOG.md` je zdroj pravdy pro člověka. Nesmí být jen výpis commitů.

Každá vydaná verze musí mít:

- verzi,
- datum vydání,
- krátké skupiny změn,
- migrační poznámky, pokud existují,
- známá rizika nebo omezení, pokud existují.

Používané sekce:

- `Added` - nové funkce.
- `Changed` - změny existujícího chování.
- `Deprecated` - věci označené k budoucímu odstranění.
- `Removed` - odstraněné funkce.
- `Fixed` - opravy chyb.
- `Security` - bezpečnostní opravy.
- `Migration notes` - dopad na data, env proměnné, Docker, zálohy nebo ruční kroky po aktualizaci.
- `Known issues` - důležité známé problémy.

Sekce bez obsahu se vynechávají.

## Commit zprávy

Používej Conventional Commits:

- `feat: ...` pro nové funkce; typicky `MINOR`.
- `fix: ...` pro opravy; typicky `PATCH`.
- `docs: ...` pro dokumentaci.
- `ci: ...` pro GitHub Actions a release workflow.
- `build: ...` pro Docker, npm, dependency a build změny.
- `refactor: ...` pro interní změny bez změny chování.
- `test: ...` pro testy.
- `chore: ...` pro údržbu bez uživatelského dopadu.

Breaking change se značí `!` nebo footerem `BREAKING CHANGE:` a vyžaduje `MAJOR`, pokud už byla dotčená funkcionalita vydaná.

Příklady:

```text
feat(pizza): add department selection to each pizza order
fix(pdf): keep duplicated soups grouped in export
ci(release): publish Docker image from version tags
feat(settings)!: replace legacy backup import format
```

## Release checklist

Před vydáním:

1. Zkontrolovat, že pracovní změny patří do release.
2. Rozhodnout bump: `PATCH`, `MINOR`, `MAJOR`, případně prerelease.
3. Aktualizovat `package.json` a `package-lock.json`.
4. Aktualizovat `CHANGELOG.md`.
5. Spustit dostupné ověření:
   - `npm run build`
   - `npm run lint`, pokud je v daném okamžiku užitečný; repo může mít historické warningy.
6. Vytvořit commit s release změnami.
7. Vytvořit anotovaný git tag ve tvaru `vX.Y.Z`, například:

```bash
git tag -a v1.1.0 -m "Release v1.1.0"
```

8. Pushnout commit a tag:

```bash
git push origin main
git push origin v1.1.0
```

Po vydání:

1. Ověřit, že GitHub Actions doběhly.
2. Ověřit existenci Docker tagů.
3. U běžného Unraid nasazení používat `stable`, pro rollback a audit používat přesný tag `X.Y.Z`.
4. Zapsat nebo zkontrolovat GitHub Release notes podle `CHANGELOG.md`.

GitHub Release se vytváří automaticky workflowem `.github/workflows/release.yml` po pushnutí tagu `vX.Y.Z`. Poznámky se extrahují z odpovídající sekce v `CHANGELOG.md`.

## Docker tagy

Stabilní release z tagu `v1.2.3` má publikovat:

- `ghcr.io/vituhlos/objednavky-jidla:1.2.3`
- `ghcr.io/vituhlos/objednavky-jidla:1.2`
- `ghcr.io/vituhlos/objednavky-jidla:1`
- `ghcr.io/vituhlos/objednavky-jidla:stable`
- `ghcr.io/vituhlos/objednavky-jidla:latest`
- `ghcr.io/vituhlos/objednavky-jidla:sha-<short-sha>`

Prerelease z tagu `v1.2.3-beta.1` má publikovat jen přesný prerelease tag a SHA tag. Nemá přepisovat `stable`, `latest`, `1.2` ani `1`.

Produkční dokumentace pro Unraid má doporučovat `:stable`, protože umožní pohodlnou aktualizaci bez ručního přepisování verze image. Přesné verze, například `:1.2.3`, slouží pro audit, podporu a rychlý rollback. `latest` je jen technický alias pro rychlé testování.

## Build metadata v aplikaci

Aplikace má umět zobrazit alespoň:

- verzi aplikace,
- commit SHA,
- datum buildu,
- případně git ref/tag.

Tyto údaje pomáhají při podpoře, rollbacku a ověřování, co skutečně běží.

Aktuální implementace:

- UI: `Nastavení -> Systém -> O aplikaci`.
- Diagnostika: `GET /api/version`.
- Release notes v aplikaci: `lib/release-notes.ts`.
- Healthcheck: `GET /api/health`.
- Build metadata: `APP_VERSION`, `COMMIT_SHA`, `BUILD_DATE`, `RELEASE_CHANNEL`, `GIT_REF`, `DOCKER_TAG`.

Docker image obsahuje `HEALTHCHECK` napojený na `/api/health`.

## Changelog guardrail

Pull requesty do `main` spouští `.github/workflows/changelog.yml`. Pokud se mění produktový kód, Docker, workflow nebo závislosti, musí PR obsahovat změnu v `CHANGELOG.md` nebo v `lib/release-notes.ts`, případně musí autor vědomě vysvětlit, proč změna nemá release dopad.

## Pravidla pro AI asistenty

Když AI mění produktové chování, Docker, databázi, env proměnné, GitHub Actions nebo uživatelské workflow, musí:

- vyhodnotit dopad na verzi,
- navrhnout nebo upravit relevantní položku v `CHANGELOG.md`,
- nepoužívat `latest` jako jediný produkční release identifikátor,
- zachovat dohledatelnost přes git tag, commit SHA a Docker tag,
- upozornit na migrační kroky, pokud existují.

AI nemá vydávat release bez výslovného souhlasu člověka.
