import { getSettings } from "@/lib/settings";
import { EXTRAS_PRICES_DEFAULT } from "@/lib/pricing";
import type { UserRow } from "@/lib/users";

export type UserProfile = {
  id: number;
  email: string | null;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: "admin" | "user";
  emailVerified: boolean;
  active: boolean;
  defaultDepartment: string | null;
  emailOrderConfirmation: boolean;
};

export type AppConfigResponse = {
  cutoffTime: string;
  autoSendEnabled: boolean;
  autoSendTime: string;
  autoSendDays: string;
  defaultSoupPrice: number;
  defaultMealPrice: number;
  extrasPrices: {
    roll: number;
    breadDumpling: number;
    potatoDumpling: number;
    ketchup: number;
    tatarka: number;
    bbq: number;
  };
  pushReminderMinutes: number;
  pizzaEnabled: boolean;
};

export function toUserProfile(user: UserRow): UserProfile {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    emailVerified: user.emailVerified,
    active: user.active,
    defaultDepartment: user.defaultDepartment,
    emailOrderConfirmation: user.emailOrderConfirmation,
  };
}

export function buildAppConfig(): AppConfigResponse {
  const s = getSettings();
  return {
    cutoffTime: s.cutoffTime || "08:00",
    autoSendEnabled: s.autoSendEnabled === "true",
    autoSendTime: s.autoSendTime || "08:00",
    autoSendDays: s.autoSendDays || "Po,Út,St,Čt,Pá",
    defaultSoupPrice: parseInt(s.defaultSoupPrice, 10) || 30,
    defaultMealPrice: parseInt(s.defaultMealPrice, 10) || 110,
    extrasPrices: {
      roll: parseInt(s.priceRoll, 10) || EXTRAS_PRICES_DEFAULT.roll,
      breadDumpling: parseInt(s.priceBreadDumpling, 10) || EXTRAS_PRICES_DEFAULT.breadDumpling,
      potatoDumpling: parseInt(s.pricePotatoDumpling, 10) || EXTRAS_PRICES_DEFAULT.potatoDumpling,
      ketchup: parseInt(s.priceKetchup, 10) || EXTRAS_PRICES_DEFAULT.ketchup,
      tatarka: parseInt(s.priceTatarka, 10) || EXTRAS_PRICES_DEFAULT.tatarka,
      bbq: parseInt(s.priceBbq, 10) || EXTRAS_PRICES_DEFAULT.bbq,
    },
    pushReminderMinutes: parseInt(s.pushReminderMinutes, 10) || 20,
    pizzaEnabled: s.pizzaEnabled !== "false",
  };
}
