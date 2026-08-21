export type ReleaseNoteSection = {
  title: "Added" | "Changed" | "Deprecated" | "Removed" | "Fixed" | "Security" | "Migration notes" | "Known issues";
  items: string[];
};

export type ReleaseNote = {
  version: string;
  date: string;
  title: string;
  sections: ReleaseNoteSection[];
};

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "1.3.1",
    date: "2026-08-21",
    title: "Oprava objednávkového PDF",
    sections: [
      {
        title: "Fixed",
        items: [
          "Když se tabulka oddělení nevešla na jednu stránku, PDF se rozsypalo — z objednávky s 23 lidmi vypadlo 51 stran, na kterých byly jen útržky (na jedné pořadové číslo, na další jméno). Nově se tabulka správně stránkuje: na každé další straně se zopakuje hlavička sloupců i název oddělení s poznámkou „(pokračování)“ a řádky plynule navazují.",
          "Patička byla jen na poslední straně. Teď je na každé a u víc stránek přibylo označení „Strana X / Y“.",
          "„Znovu odeslat email“ v Nastavení poslalo správné PDF, ale ke stažení v historii zůstala starší verze. Nově se obě shodují.",
        ],
      },
      {
        title: "Migration notes",
        items: [
          "Aktualizace nevyžaduje žádné kroky navíc. Už odeslané objednávky si nechávají původní PDF — opravené dostanou po opětovném otevření a odeslání, nebo přes „Znovu odeslat email“.",
        ],
      },
    ],
  },
  {
    version: "1.3.0",
    date: "2026-08-04",
    title: "Dovolená na objednávkové stránce",
    sections: [
      {
        title: "Changed",
        items: [
          "Když se nevaří, objednávková stránka ukáže stejnou kartu jako jídelníček: název dovolené, od kdy do kdy trvá, kdy byl poslední oběd a odkdy se zase vaří. Dřív tam byla jen šedá cedule „Zavřeno“ a název dovolené se krčil v drobném řádku pod ní.",
          "V přepínači dnů se celá dovolená ukazuje jako jeden předěl s vaší ikonou. Dnešek už z ní nevyčnívá jako zvlášť přeškrtnutý den a přes ten předěl se dá kliknutím vrátit na dnešek.",
          "Karta dovolené je zarovnaná doleva a ikona stojí vedle názvu, takže se čte jedním tahem shora dolů.",
        ],
      },
      {
        title: "Fixed",
        items: [
          "Karta dovolené byla na objednávkové stránce zúžená, takže se údaje o posledním obědu a návratu tiskly k sobě a karta vypadala jako dvě.",
          "Popisky „poslední oběd“ a „vaří se zase od“, neaktivní dny v přepínači i označení dovolené byly moc světlé a špatně se četly.",
          "Na obou obrazovkách chyběl při dovolené nadpis, takže čtečka obrazovky neoznámila, proč je stránka prázdná.",
        ],
      },
      {
        title: "Known issues",
        items: [
          "Předěl v přepínači dnů uvádí jen zbývající dny dovolené, kdežto karta pod ním celé období. Od druhého dne dovolené si tak obě data neodpovídají.",
        ],
      },
    ],
  },
  {
    version: "1.2.1",
    date: "2026-07-30",
    title: "Úprava zadaného zavření",
    sections: [
      {
        title: "Fixed",
        items: [
          "Zadanou dovolenou nebo zavření lze nově upravit tlačítkem Upravit. Dřív se musela smazat a vypsat celá znovu.",
          "Při úpravě jde změnit jen popis, poznámku nebo ikonu beze změny termínu; kontrola překryvu už nehlásí kolizi záznamu se sebou samým.",
        ],
      },
    ],
  },
  {
    version: "1.2.0",
    date: "2026-07-30",
    title: "Dovolená, přehlednější nastavení a spolehlivější bot",
    sections: [
      {
        title: "Added",
        items: [
          "V Nastavení lze zadat období, kdy se nevaří — dovolenou, údržbu i svátek. Zadává se dopředu a nezávisle na importu jídelníčku.",
          "Na objednávkové stránce se s předstihem objeví upozornění, kdy si dát poslední oběd a odkdy se zase vaří.",
          "Ke každému zavření si vyberete vlastní ikonu z 1914 emoji, včetně hledání podle názvu.",
          "Jídelníček ukáže i týdny za příštím týdnem, pokud pro ně už existuje jídelníček nebo zavření.",
          "Nastavení má postranní navigaci s kategoriemi a upozorní vás, když máte neuložené změny.",
        ],
      },
      {
        title: "Fixed",
        items: [
          "Bot v přehledu objednávky ukazoval jen první polévku a první jídlo. Nově vypíše i druhé polévky, další jídla, počty porcí a přílohy.",
          "Horní lišta a postranní navigace přestaly poskakovat při přepínání dnů a kategorií.",
          "Zrušení objednávky přes bota nově odemkne objednávky i po uzávěrce, stejně jako v aplikaci.",
          "Po vyčerpání pokusů o PIN se zobrazí zbývající čas místo hlášky o nesprávném PINu.",
        ],
      },
      {
        title: "Security",
        items: [
          "Telegram bot vydával přes inline režim celou objednávku včetně jmen komukoli, kdo znal jméno bota. Nově je nutná registrace.",
          "Webhook bota nově ověřuje sdílený secret token, takže na něj nemůže poslat příkaz kdokoliv.",
        ],
      },
      {
        title: "Migration notes",
        items: [
          "Po aktualizaci znovu zaregistrujte webhook v Nastavení → Napojení. Tím se vytvoří ověřovací token.",
          "Databáze se rozšíří sama při startu, žádný ruční zásah není potřeba.",
        ],
      },
    ],
  },
  {
    version: "1.1.1",
    date: "2026-06-12",
    title: "Pohodlnější aktualizace na Unraidu",
    sections: [
      {
        title: "Changed",
        items: [
          "Unraid template nově používá Docker tag stable, takže běžná aktualizace nevyžaduje ruční přepis čísla verze image.",
          "Stabilní release workflow publikuje tag stable vedle přesných verzí pro rollback a podporu.",
          "Dokumentace rozlišuje pohodlný stabilní kanál pro Unraid a přesné verze pro audit nebo návrat na starší release.",
        ],
      },
    ],
  },
  {
    version: "1.1.0",
    date: "2026-06-12",
    title: "Profesionální release proces a diagnostika",
    sections: [
      {
        title: "Added",
        items: [
          "Profesionální informace o verzi přímo v nastavení aplikace.",
          "Diagnostický endpoint /api/version pro podporu a ověření nasazeného buildu.",
          "Health endpoint /api/health pro monitoring a Docker healthcheck.",
          "Release metadata: verze, commit, datum buildu, kanál, git ref a Docker tag.",
          "Release checklist jako GitHub issue šablona.",
        ],
      },
      {
        title: "Changed",
        items: [
          "Docker release workflow je připravený na tag-based vydávání podle SemVer.",
          "README popisuje bezpečnou aktualizaci, rollback a ověření běžící verze.",
          "Kopírovaná diagnostika obsahuje URL aplikace, čas klienta, timezone a prohlížeč.",
        ],
      },
    ],
  },
  {
    version: "1.0.2",
    date: "2026-06-12",
    title: "Aktuální stabilní základ",
    sections: [
      {
        title: "Changed",
        items: [
          "Výchozí verze projektu zachycená z package.json.",
        ],
      },
      {
        title: "Known issues",
        items: [
          "Starší změny před zavedením profesionálního changelogu nejsou zpětně rozepsané podle jednotlivých verzí.",
        ],
      },
    ],
  },
];
