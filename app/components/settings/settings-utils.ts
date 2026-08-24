import type { Closure } from "@/lib/closures";
import type { AppSettings } from "@/lib/settings";
import { getPragueNow } from "@/lib/time";
import { DAY_OPTIONS } from "./constants";

export function getNextAutoSend(
  enabled: string,
  time: string,
  daysStr: string,
  now?: Date
): string {
  if (enabled !== "true") return "Vypnuto";
  const days = daysStr.split(",").map((day) => day.trim()).filter(Boolean);
  if (days.length === 0 || !time) return "Nenastaveno";

  const jsToCode: Record<number, string> = { 1: "Po", 2: "Út", 3: "St", 4: "Čt", 5: "Pá" };
  const dayNames: Record<string, string> = {
    Po: "pondělí",
    "Út": "úterý",
    St: "středu",
    "Čt": "čtvrtek",
    "Pá": "pátek",
  };
  try {
    const current = now ?? getPragueNow();
    const currentDay = current.getDay();
    const currentTime = `${String(current.getHours()).padStart(2, "0")}:${String(current.getMinutes()).padStart(2, "0")}`;

    for (let offset = 0; offset < 7; offset++) {
      const code = jsToCode[(currentDay + offset) % 7];
      if (!code || !days.includes(code)) continue;
      if (offset === 0 && currentTime >= time) continue;
      const label = offset === 0 ? "Dnes" : offset === 1 ? "Zítra" : `V ${dayNames[code] ?? code}`;
      return `${label} v ${time}`;
    }
  } catch {
    // Keep the settings page usable even when the runtime lacks timezone data.
  }

  return `Příštích ${days[0]} v ${time}`;
}

export function formatTimestamp(value: string): string {
  if (!value) return "—";
  const normalized =
    value.includes("T") && (value.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(value))
      ? value
      : value.replace(" ", "T") + "Z";
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatBuildDate(value: string): string {
  if (!value) return "Lokální vývoj";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatClosureRange(startDate: string, endDate: string): string {
  const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
  const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
  if (startDate === endDate) return `${startDay}. ${startMonth}. ${startYear}`;
  if (startYear === endYear) return `${startDay}. ${startMonth}. – ${endDay}. ${endMonth}. ${endYear}`;
  return `${startDay}. ${startMonth}. ${startYear} – ${endDay}. ${endMonth}. ${endYear}`;
}

export function validateClosureRange(
  from: string,
  to: string,
  existing: Closure[],
  todayISO: string
): { error?: string; warning?: string } {
  if (!from || !to) return {};
  if (from > to) return { error: "Datum „Do“ je dřív než „Od“ — prohoďte je." };

  const clash = existing.find((closure) => from <= closure.endDate && to >= closure.startDate);
  if (clash) {
    return {
      error: `Překrývá se s „${clash.label || "Dovolená"}“ (${formatClosureRange(clash.startDate, clash.endDate)}).`,
    };
  }
  if (to < todayISO) return { warning: "Termín je celý v minulosti — na provoz už nemá vliv." };
  return {};
}

function checked(formData: FormData, name: string): string {
  return formData.get(name) === "on" ? "true" : "false";
}

function selectedDays(formData: FormData, prefix: string): string {
  return DAY_OPTIONS
    .filter((day) => formData.get(`${prefix}_${day.code}`) === "on")
    .map((day) => day.code)
    .join(",");
}

/**
 * Jak se dané pole čte z `FormData`:
 * - `text` — hodnota inputu tak, jak je,
 * - `checkbox` — nezaškrtnutý checkbox se v `FormData` vůbec neobjeví,
 *   takže chybějící klíč znamená `"false"`, ne prázdný řetězec,
 * - `days` — pětice checkboxů `<prefix>_Po` … `<prefix>_Pá` složená do
 *   jednoho řetězce `"Po,St,Pá"`.
 */
type SettingsFieldKind = "text" | "checkbox" | "days";

type SettingsFieldSpec = {
  /** Klíč v `AppSettings` i `name` inputu; u `days` je `name` prefix. */
  key: keyof AppSettings;
  kind: SettingsFieldKind;
  /** Jen pro `days` — prefix jmen checkboxů, liší se od klíče nastavení. */
  dayPrefix?: string;
};

/**
 * Které pole nastavení patří do které kategorie.
 *
 * Zdroj pravdy pro ukládání: bez něj by se muselo spoléhat na to, že jsou
 * v DOM všechna pole naráz. `getSettingsUpdates()` čte jen kategorie, které
 * dostane, takže formulář jedné kategorie nemůže přepsat cizí hodnoty
 * prázdným řetězcem.
 *
 * `lide` tu chybí záměrně — oddělení a odběratelé bota se ukládají vlastními
 * akcemi, ne přes nastavení.
 */
export const SETTINGS_FIELDS = {
  provoz: [
    { key: "cutoffTime", kind: "text" },
    { key: "autoSendEnabled", kind: "checkbox" },
    { key: "autoSendTime", kind: "text" },
    { key: "autoSendDays", kind: "days", dayPrefix: "autoSendDay" },
    { key: "autoSendMinOrders", kind: "text" },
    { key: "autoSendFailureEmail", kind: "text" },
  ],
  ceny: [
    { key: "defaultSoupPrice", kind: "text" },
    { key: "defaultMealPrice", kind: "text" },
    { key: "priceRoll", kind: "text" },
    { key: "priceBreadDumpling", kind: "text" },
    { key: "pricePotatoDumpling", kind: "text" },
    { key: "priceKetchup", kind: "text" },
    { key: "priceTatarka", kind: "text" },
    { key: "priceBbq", kind: "text" },
  ],
  napojeni: [
    { key: "smtpHost", kind: "text" },
    { key: "smtpPort", kind: "text" },
    { key: "smtpUser", kind: "text" },
    { key: "smtpPass", kind: "text" },
    { key: "smtpFrom", kind: "text" },
    { key: "smtpSecure", kind: "checkbox" },
    { key: "orderEmailTo", kind: "text" },
    { key: "orderExtraEmail", kind: "text" },
    { key: "smtpReplyTo", kind: "text" },
    { key: "reminderEmailTo", kind: "text" },
    { key: "imapEnabled", kind: "checkbox" },
    { key: "imapHost", kind: "text" },
    { key: "imapPort", kind: "text" },
    { key: "imapUser", kind: "text" },
    { key: "imapPass", kind: "text" },
    { key: "imapSender", kind: "text" },
    { key: "imapCheckTime", kind: "text" },
    { key: "imapCheckDays", kind: "days", dayPrefix: "imapCheckDay" },
    { key: "pushReminderMinutes", kind: "text" },
    { key: "telegramEnabled", kind: "checkbox" },
    { key: "telegramBotToken", kind: "text" },
    { key: "telegramMorningMenuTime", kind: "text" },
    { key: "telegramAppUrl", kind: "text" },
  ],
  pizza: [
    { key: "pizzaEnabled", kind: "checkbox" },
    { key: "pizzaCutoffEnabled", kind: "checkbox" },
    { key: "pizzaCutoffTime", kind: "text" },
    { key: "pizzaCutoffDays", kind: "days", dayPrefix: "pizzaCutoffDay" },
  ],
  // PIN se řeší zvlášť: prázdné pole znamená „ponechat stávající“, ne „smazat“.
  system: [],
} as const satisfies Record<string, readonly SettingsFieldSpec[]>;

export type SettingsFieldCategory = keyof typeof SETTINGS_FIELDS;

export const SETTINGS_FIELD_CATEGORIES = Object.keys(SETTINGS_FIELDS) as SettingsFieldCategory[];

/**
 * Sestaví změny nastavení z formuláře. `categories` omezuje, které klíče se
 * vůbec přečtou — formulář jedné kategorie tak nemůže vynulovat pole, která
 * v DOM nemá.
 */
export function getSettingsUpdates(
  formData: FormData,
  categories: readonly SettingsFieldCategory[] = SETTINGS_FIELD_CATEGORIES
): Partial<AppSettings> {
  const updates: Partial<AppSettings> = {};

  for (const category of categories) {
    for (const field of SETTINGS_FIELDS[category] as readonly SettingsFieldSpec[]) {
      if (field.kind === "checkbox") {
        updates[field.key] = checked(formData, field.key);
      } else if (field.kind === "days") {
        updates[field.key] = selectedDays(formData, field.dayPrefix ?? field.key);
      } else {
        updates[field.key] = String(formData.get(field.key) ?? "");
      }
    }
  }

  if (categories.includes("system")) {
    const newPin = String(formData.get("newPin") ?? "").trim();
    if (newPin) updates.settingsPin = newPin;
  }

  return updates;
}
