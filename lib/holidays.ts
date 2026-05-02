const HOLIDAY_DESCRIPTIONS: Record<string, string> = {
  "Nový rok": "Oslavy příchodu nového roku a výročí vzniku samostatné České republiky v roce 1993.",
  "Svátek práce": "Mezinárodní den práce připomínající boj za práva pracujících od 19. století.",
  "Den vítězství": "Výročí konce druhé světové války v Evropě — kapitulace Německa 8. května 1945.",
  "Den slovanských věrozvěstů Cyrila a Metoděje": "Příchod soluňských bratří na Velkou Moravu v roce 863, kteří přinesli písmo a přeložili bohoslužebné texty do slovanštiny.",
  "Den upálení mistra Jana Husa": "Upálení českého náboženského reformátora Jana Husa na kostnickém koncilu 6. července 1415.",
  "Den české státnosti": "Svátek sv. Václava, knížete a patrona českých zemí, symbol české státnosti.",
  "Den vzniku samostatného Československa": "Vznik samostatného Československa 28. října 1918 po rozpadu Rakouska-Uherska.",
  "Den boje za svobodu a demokracii": "Výročí sametové revoluce z 17. listopadu 1989 a připomínka násilného potlačení studentské demonstrace v roce 1939.",
  "Velký pátek": "Den ukřižování Ježíše Krista — den smutku, postu a rozjímání.",
  "Velikonoční pondělí": "Oslava vzkříšení Ježíše Krista, největší křesťanský svátek.",
  "Štědrý den": "Vánoční štědrý večer plný tradic — ryba, cukroví, koledy a rozdávání dárků.",
  "1. svátek vánoční": "Slavnost narození Ježíše Krista, den klidu a setkání s rodinou.",
  "2. svátek vánoční": "Pokračování vánočních oslav, den sv. Štěpána.",
};

const FIXED: Record<string, string> = {
  "01-01": "Nový rok",
  "05-01": "Svátek práce",
  "05-08": "Den vítězství",
  "07-05": "Den slovanských věrozvěstů Cyrila a Metoděje",
  "07-06": "Den upálení mistra Jana Husa",
  "09-28": "Den české státnosti",
  "10-28": "Den vzniku samostatného Československa",
  "11-17": "Den boje za svobodu a demokracii",
  "12-24": "Štědrý den",
  "12-25": "1. svátek vánoční",
  "12-26": "2. svátek vánoční",
};

function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export function getHolidayName(iso: string): string | null {
  const [y, mo, d] = iso.split("-").map(Number);

  const key = `${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  if (FIXED[key]) return FIXED[key];

  const easter = easterSunday(y);
  const match = (offset: number) => {
    const dt = new Date(easter);
    dt.setDate(easter.getDate() + offset);
    return dt.getFullYear() === y && dt.getMonth() + 1 === mo && dt.getDate() === d;
  };
  if (match(-2)) return "Velký pátek";
  if (match(1)) return "Velikonoční pondělí";

  return null;
}

export function getHolidayEmoji(name: string | null): string {
  if (!name) return "☺";

  const EMOJI_MAP: Record<string, string> = {
    "Nový rok": "🎆",
    "Svátek práce": "🛠",
    "Den vítězství": "🕊",
    "Den slovanských věrozvěstů Cyrila a Metoděje": "📖",
    "Den upálení mistra Jana Husa": "🕯",
    "Den české státnosti": "🇨🇿",
    "Den vzniku samostatného Československa": "🎉",
    "Den boje za svobodu a demokracii": "🗽",
    "Štědrý den": "🎄",
    "1. svátek vánoční": "🎁",
    "2. svátek vánoční": "✨",
    "Velký pátek": "✝",
    "Velikonoční pondělí": "🐣",
  };

  return EMOJI_MAP[name] ?? "☺";
}

export function getHolidayDescription(name: string | null): string | null {
  if (!name) return null;
  return HOLIDAY_DESCRIPTIONS[name] ?? null;
}
