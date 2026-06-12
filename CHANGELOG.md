# Changelog

Všechny významné změny tohoto projektu budou dokumentované v tomto souboru.

Formát vychází z Keep a Changelog a projekt používá Semantic Versioning.

## [Unreleased]

Zatím žádné nevydané změny.

## [1.1.0] - 2026-06-12

### Added

- Přidán profesionální release proces pro verzování, changelog, commit zprávy a Docker tagování.
- Přidán endpoint `/api/version` s diagnostikou aktuálně běžící verze.
- Přidán endpoint `/api/health` pro monitoring, Docker healthcheck a ověření databáze.
- Přidán panel `O aplikaci` v nastavení se zobrazením verze, commitu, data buildu, kanálu, git refu a Docker tagu.
- Přidán modal `Co je nového` s produktovými release notes přímo v aplikaci.
- Přidána GitHub issue šablona pro release checklist.
- Přidán GitHub Release workflow generovaný z `CHANGELOG.md`.
- Přidána CI kontrola, která u produktových PR hlídá changelog nebo release notes.

### Changed

- Budoucí změny mají být připravované tak, aby bylo jasné, jestli vyžadují `PATCH`, `MINOR` nebo `MAJOR` release.
- Docker build přijímá release metadata a GitHub Actions umí publikovat SemVer Docker tagy z git tagů `vX.Y.Z`.
- Docker image obsahuje `HEALTHCHECK` napojený na `/api/health`.
- README nově doporučuje pinovat produkční nasazení na konkrétní verzi a popisuje aktualizaci, rollback a monitoring.

## [1.0.2] - 2026-06-12

### Changed

- Aktuální výchozí verze projektu zachycená z `package.json`.

### Known issues

- Historické změny před zavedením tohoto changelogu nejsou zpětně rozepsané podle jednotlivých verzí.
