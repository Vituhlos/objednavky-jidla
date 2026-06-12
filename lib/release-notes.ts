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
