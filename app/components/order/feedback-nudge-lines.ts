/**
 * Věty do pozvánky k připomínkám pod objednávkou. Schválené, jazykově
 * ověřené — při úpravách hlídat: tykání, žádné tvary podle pohlaví
 * („napsal jsi“), nic, co nemusí platit (třeba konkrétní čas uzávěrky).
 */
export const NUDGE_LINES = [
  { lead: "Na porci si stěžuj v LIMĚ.", rest: "Na appku tady." },
  { lead: "Stížnosti na knedlíky řeš s kuchyní.", rest: "Stížnosti na appku s námi." },
  { lead: "Polévku nevylepšíme.", rest: "Appku ale ano." },
  { lead: "Tatarku navíc ti nepřidáme.", rest: "Funkci navíc možná ano." },
  { lead: "Svíčkovou v pátek nevyprosíš.", rest: "Nápady na appku ale čteme." },
  { lead: "Knedlíků je vždycky málo.", rest: "Připomínek taky." },
  { lead: "I kuchař občas přesolí.", rest: "My zase občas něco pokazíme v appce. Dej vědět." },
  { lead: "O chutích se nepřete.", rest: "O appce klidně." },
  { lead: "Appka neumí vařit.", rest: "Všechno ostatní by ale umět měla. Co jí chybí?" },
  { lead: "Nápady nejíme.", rest: "Čteme je." },
  { lead: "Zítřejší menu neovlivníš.", rest: "Zítřejší appku možná ano." },
  { lead: "Pochvala potěší víc než přídavek.", rest: "Skoro." },
  { lead: "Něco nefunguje?", rest: "Napiš nám, ať to spravíme dřív, než vystydne oběd." },
  { lead: "Tři kliknutí a pořád nic?", rest: "Tohle chceme vědět." },
  { lead: "Appka zlobí zrovna pět minut před uzávěrkou?", rest: "Tohle chceme vědět hned." },
  { lead: "Tlačítko, které nikdo nenajde, je k ničemu.", rest: "Které to je?" },
  { lead: "Hledáš v jídelníčku déle, než pak jíš?", rest: "Tak to nám řekni." },
  { lead: "Objednat by mělo jít rychleji, než ohřeješ oběd v mikrovlnce.", rest: "Nejde? Řekni nám." },
  { lead: "Chyba appky, nebo jen divný den?", rest: "Napiš i tak, rádi to zjistíme." },
  { lead: "Screenshot řekne víc než dlouhý popis.", rest: "Přidej ho k připomínce." },
  { lead: "Kolega za tebe zase objednal?", rest: "To nevyřešíme. Skoro všechno ostatní ano." },
  { lead: "Co tě štve nejvíc?", rest: "Tlačítka, barvy, nebo kolega, který objednává za celé oddělení?" },
  { lead: "Máš na appku vztek?", rest: "Lepší napsat nám než kolegovi u oběda." },
  { lead: "Pondělí je těžké pro každého.", rest: "Pro appku taky? Napiš nám." },
  { lead: "Uzávěrka přijde vždycky moc brzo, víme.", rest: "Co dalšího tě štve?" },
  { lead: "Objednáváš každý den?", rest: "Pak víš líp než my, co tu chybí." },
  { lead: "Nápad z fronty na oběd?", rest: "Napiš ho, než ho zapomeneš." },
  { lead: "Dobrý nápad nemusí být dlouhý.", rest: "Stačí jedna věta." },
  { lead: "Kdo mlčí, dostane zase stejnou appku.", rest: "Tak nemlč." },
  { lead: "Klidně i bez jména.", rest: "Nikdo nebude pátrat, kdo to psal." },
] as const;

/**
 * Náhodný index věty, jiný než minule. `random` jde podstrčit v testech.
 * Neplatné `last` (třeba po zkrácení seznamu) se bere jako žádné.
 */
export function pickNextLine(count: number, last: number | null, random: () => number = Math.random): number {
  if (count <= 1) return 0;
  const hasLast = last !== null && Number.isInteger(last) && last >= 0 && last < count;
  if (!hasLast) return Math.floor(random() * count) % count;
  // Vybírá se z ostatních count − 1 vět a mezera po té minulé se přeskočí
  const i = Math.floor(random() * (count - 1)) % (count - 1);
  return i >= last ? i + 1 : i;
}
