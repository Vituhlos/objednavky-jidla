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
