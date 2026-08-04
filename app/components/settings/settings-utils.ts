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

export function getSettingsUpdates(formData: FormData): Partial<AppSettings> {
  const value = (name: string) => String(formData.get(name) ?? "");
  const updates: Partial<AppSettings> = {
    smtpHost: value("smtpHost"),
    smtpPort: value("smtpPort"),
    smtpUser: value("smtpUser"),
    smtpPass: value("smtpPass"),
    smtpFrom: value("smtpFrom"),
    smtpSecure: checked(formData, "smtpSecure"),
    orderEmailTo: value("orderEmailTo"),
    orderExtraEmail: value("orderExtraEmail"),
    smtpReplyTo: value("smtpReplyTo"),
    reminderEmailTo: value("reminderEmailTo"),
    cutoffTime: value("cutoffTime"),
    defaultSoupPrice: value("defaultSoupPrice"),
    defaultMealPrice: value("defaultMealPrice"),
    priceRoll: value("priceRoll"),
    priceBreadDumpling: value("priceBreadDumpling"),
    pricePotatoDumpling: value("pricePotatoDumpling"),
    priceKetchup: value("priceKetchup"),
    priceTatarka: value("priceTatarka"),
    priceBbq: value("priceBbq"),
    autoSendEnabled: checked(formData, "autoSendEnabled"),
    autoSendTime: value("autoSendTime"),
    autoSendDays: selectedDays(formData, "autoSendDay"),
    autoSendMinOrders: value("autoSendMinOrders"),
    autoSendFailureEmail: value("autoSendFailureEmail"),
    imapEnabled: checked(formData, "imapEnabled"),
    imapHost: value("imapHost"),
    imapPort: value("imapPort"),
    imapUser: value("imapUser"),
    imapPass: value("imapPass"),
    imapSender: value("imapSender"),
    imapCheckTime: value("imapCheckTime"),
    imapCheckDays: selectedDays(formData, "imapCheckDay"),
    pushReminderMinutes: value("pushReminderMinutes"),
    telegramEnabled: checked(formData, "telegramEnabled"),
    telegramBotToken: value("telegramBotToken"),
    telegramMorningMenuTime: value("telegramMorningMenuTime"),
    telegramAppUrl: value("telegramAppUrl"),
    pizzaEnabled: checked(formData, "pizzaEnabled"),
    pizzaCutoffEnabled: checked(formData, "pizzaCutoffEnabled"),
    pizzaCutoffTime: value("pizzaCutoffTime"),
    pizzaCutoffDays: selectedDays(formData, "pizzaCutoffDay"),
  };

  const newPin = value("newPin").trim();
  if (newPin) updates.settingsPin = newPin;
  return updates;
}
