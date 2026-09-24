export type ReleaseNoteSection = {
  title: "Added" | "Changed" | "Deprecated" | "Removed" | "Fixed" | "Security" | "Migration notes" | "Known issues";
  items: string[];
};

export type ReleaseNote = {
  version: string;
  date: string;
  title: string;
  sections: ReleaseNoteSection[];
  /**
   * Krátce pro lidi, kteří si objednávají — ukazuje se veřejně na stránce
   * Připomínky. Jen to, čeho si při objednávání všimnou; správa, zabezpečení
   * a nasazení sem nepatří. Neosobně (bez „vy“ i „ty“), protože stránka tyká,
   * zbytek appky vyká. Prázdné pole = verze se veřejně neukáže.
   */
  forEveryone: string[];
};

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "1.5.0",
    date: "2026-09-24",
    title: "Co je nového pro všechny",
    sections: [
      {
        title: "Added",
        items: [
          "Na stránce Připomínky přibyla karta „Co je nového“. Novinky tak uvidí i ti, kdo nemají PIN do Nastavení. Ukazuje se jen to, čeho si všimnou při objednávání; technické věci zůstávají tady.",
        ],
      },
    ],
    // Karta sama sebe ohlašovat nemusí.
    forEveryone: [],
  },
  {
    version: "1.4.0",
    date: "2026-09-24",
    title: "Připomínky k aplikaci",
    sections: [
      {
        title: "Added",
        items: [
          "Nová stránka Připomínky (v menu, na mobilu „Nápady“). Kdo si objednává, může napsat nápad, nahlásit chybu nebo pochválit. Stačí vybrat, čeho se to týká, a napsat pár slov. Jméno je nepovinné.",
          "K připomínce jde přidat až tři screenshoty: přetažením na stránku, vložením přes Ctrl+V nebo výběrem souboru, na mobilu i z galerie.",
          "Kdo připomínku pošle, vidí v kartě „Moje připomínky“, jak to s ní vypadá, a vaši odpověď. Funguje to bez přihlašování, jen v prohlížeči, ze kterého ji poslal.",
          "Když appka spadne, chybová stránka nabídne „Nahlásit problém“. Připomínka pak rovnou ví, kde a jaká chyba nastala.",
          "Hlasování: nápadům, které zveřejníte k hlasování, můžou lidé dát 👍 v kartě „Co chystáme“. Hned vidíte, co chce nejvíc lidí.",
          "Pod objednávkou je nenápadná pozvánka k připomínkám, pokaždé s jinou větou. Kdo ji nechce vidět, skryje ji na 14 dní.",
          "Nastavení → Připomínky: přehled s filtrem podle stavu, změna stavu jedním klikem, interní poznámka a odpověď autorovi. Hotové připomínky s odpovědí se objeví v seznamu „Změnili jsme díky vám“.",
          "Upozornění na novou připomínku do Telegramu. Dostanou ho jen admini bota, kteří si ho zapnou v /nastaveni.",
        ],
      },
      {
        title: "Fixed",
        items: [
          "Opravili jsme texty v celé aplikaci: pravopis, čárky, skloňování počtů („3 objednávky“, „zbývají 2 minuty“) a jednotné vykání.",
        ],
      },
      {
        title: "Security",
        items: [
          "Připomínky i screenshoty vidí jen ten, kdo zná PIN do Nastavení. Veřejně se ukazuje jen vaše odpověď u hotových připomínek, nikdy původní text ani autor.",
          "Neukládá se IP adresa. Ze screenshotů se odstraní skrytá data (například poloha z telefonu) a screenshoty vyřízených připomínek se po 90 dnech samy smažou.",
        ],
      },
      {
        title: "Known issues",
        items: [
          "Hlasování je orientační: hlas patří prohlížeči, ne člověku, takže kdo si smaže data prohlížeče, může hlasovat znovu.",
          "Záloha v Nastavení obsahuje text připomínek, ale ne screenshoty. Ty jsou ve složce data/feedback-attachments vedle databáze.",
        ],
      },
    ],
    forEveryone: [
      "Nová stránka Připomínky: nápad, chyba nebo pochvala, klidně i se screenshotem.",
      "V kartě „Moje připomínky“ je vidět, jak to s připomínkou vypadá a co na ni správce odpověděl.",
      "Nápadům v kartě „Co chystáme“ jde dát 👍. Nahoře jsou ty, které chce nejvíc lidí.",
      "Texty v celé aplikaci prošly jazykovou kontrolou.",
    ],
  },
  {
    version: "1.3.4",
    date: "2026-08-25",
    title: "Novinky se zase ukazují",
    sections: [
      {
        title: "Fixed",
        items: [
          "Okno „Co je nového“ ukazovalo naposledy verzi 1.3.1, přestože aplikace běžela na 1.3.3. Novinky se totiž píšou zvlášť od technického seznamu změn a při vydání se na ně zapomnělo. Chybějící verze 1.3.2 a 1.3.3 jsou doplněné.",
        ],
      },
      {
        title: "Changed",
        items: [
          "Vydání nově neprojde, pokud k němu novinky chybí — hlídá to automatický test. Stejná chyba se tak nemůže zopakovat.",
        ],
      },
    ],
    forEveryone: [],
  },
  {
    version: "1.3.3",
    date: "2026-08-25",
    title: "Zabezpečení zálohy a obnovy",
    sections: [
      {
        title: "Security",
        items: [
          "Stažení zálohy, obnova dat a test SMTP byly dostupné komukoli, kdo znal adresu aplikace — a to i bez otevření Nastavení. Aplikace je přitom na veřejné adrese. Nově všechny tři vyžadují PIN.",
          "Záloha navíc obsahovala přístupový token Telegram bota. S ním by šlo bota převzít a psát jeho jménem. Token se nově do zálohy nedostane.",
          "Po deseti chybných PINech za sebou se přístup k těmto funkcím na čtvrt hodiny zavře, aby se PIN nedal uhodnout zkoušením.",
        ],
      },
      {
        title: "Migration notes",
        items: [
          "Doporučené opatření: nechte si u @BotFather vygenerovat nový token bota a vložte ho v Nastavení → Napojení. Ten dosavadní mohl uniknout a oprava ho zpětně nezneplatní.",
        ],
      },
      {
        title: "Known issues",
        items: [
          "Samotná objednávková stránka zůstává veřejná — kdo zná adresu, vidí objednávky a může je měnit. Řeší se přihlašováním, které se připravuje.",
        ],
      },
    ],
    forEveryone: [],
  },
  {
    version: "1.3.2",
    date: "2026-08-24",
    title: "Datum v záhlaví a přidávání jídel",
    sections: [
      {
        title: "Fixed",
        items: [
          "V záhlaví objednávky svítilo datum dneška i po přepnutí na jiný den. Nejčastěji to nastalo samo: po uzávěrce aplikace přeskočí na zítřek, přepínač dnů ukazoval „Zítra“, ale nadpis pořád dnešní datum — a člověk pak upravoval jiný den, než si myslel.",
          "Dny „úterý“ a „čtvrtek“ se v záhlaví psaly s malým písmenem, ostatní s velkým.",
          "Tlačítko „Přidat“ v Jídelníčku založilo prázdnou položku hned při kliknutí. Když jste okno zavřeli bez vyplnění, zůstal v jídelníčku řádek bez názvu, který se počítal do souhrnu dne. Nově se položka uloží až tlačítkem „Přidat“ v dialogu a bez názvu ji uložit nejde.",
        ],
      },
      {
        title: "Changed",
        items: [
          "Vnitřní úklid: velké obrazovky se rozdělily na menší části. Na ovládání se nic nemění, ale další úpravy budou rychlejší a bezpečnější.",
        ],
      },
    ],
    forEveryone: [
      "Záhlaví objednávky ukazuje datum vybraného dne. Dřív tam po uzávěrce svítilo dnešní datum, i když se už upravoval zítřek.",
    ],
  },
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
    forEveryone: [
      "PDF s objednávkou pro LIMU se u velkých oddělení už nerozpadá na útržky.",
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
    forEveryone: [
      "Když se nevaří, objednávková stránka ukáže přehlednou kartu: od kdy do kdy je zavřeno a odkdy se zase vaří.",
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
    forEveryone: [],
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
    forEveryone: [
      "Objednávková stránka s předstihem upozorní, kdy je poslední oběd před dovolenou a odkdy se zase vaří.",
      "Telegram bot v přehledu objednávky ukazuje i druhé polévky, další jídla, počty porcí a přílohy.",
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
    forEveryone: [],
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
    forEveryone: [],
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
    forEveryone: [],
  },
];

export type PublicReleaseNote = Pick<ReleaseNote, "version" | "date" | "title" | "forEveryone">;

/** Vydané verze, které mají co říct lidem, co si objednávají; nejnovější první. */
export function getPublicReleaseNotes(notes: ReleaseNote[] = RELEASE_NOTES): PublicReleaseNote[] {
  return notes
    .filter((note) => note.version !== "Unreleased" && note.forEveryone.length > 0)
    .map(({ version, date, title, forEveryone }) => ({ version, date, title, forEveryone }));
}

/** „2026-09-24“ → „24. 9. 2026“. Bez Date, ať nerozhoduje časové pásmo. */
export function formatReleaseDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return m ? `${Number(m[3])}. ${Number(m[2])}. ${m[1]}` : date;
}
