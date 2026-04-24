export type DayCode = "Po" | "Út" | "St" | "Čt" | "Pá";

export type MenuItemType = "Polévka" | "Jídlo";

export type Department = "Konstrukce" | "Dílna" | "Kanceláře";

export const DEPARTMENTS: Department[] = ["Konstrukce", "Dílna", "Kanceláře"];

export const DEPARTMENT_LABELS: Record<Department, string> = {
  Konstrukce: "Konstrukce",
  Dílna: "Dílna",
  Kanceláře: "Kanceláře / obchod",
};

export const DEPARTMENT_EMAIL_LABELS: Record<Department, string> = {
  Konstrukce: "Konstrukce",
  Dílna: "Dílna",
  Kanceláře: "Kanceláře (obchod)",
};

export const DEPARTMENT_ACCENT: Record<Department, "blue" | "rust" | "green"> =
  {
    Konstrukce: "blue",
    Dílna: "rust",
    Kanceláře: "green",
  };

export interface MenuItem {
  id: number;
  weekLabel: string | null;
  day: string;
  type: MenuItemType;
  code: string;
  name: string;
  price: number;
}

export interface OrderRow {
  id: number;
  orderId: number;
  department: Department;
  sortOrder: number;
  personName: string;
  soupItemId: number | null;
  mainItemId: number | null;
  rollCount: number;
  breadDumplingCount: number;
  potatoDumplingCount: number;
  ketchupCount: number;
  tatarkaCount: number;
  bbqCount: number;
  note: string;
}

export interface Order {
  id: number;
  date: string;
  status: "draft" | "sent";
  extraEmail: string | null;
  sentAt: string | null;
}

export interface OrderRowEnriched extends OrderRow {
  soupItem: MenuItem | null;
  mainItem: MenuItem | null;
  rowPrice: number;
}

export interface DepartmentData {
  name: Department;
  rows: OrderRowEnriched[];
  subtotal: number;
}

export interface OrderData {
  order: Order;
  departments: DepartmentData[];
  todayMenu: {
    soups: MenuItem[];
    meals: MenuItem[];
  };
  totalPrice: number;
  dayCode: string | null;
}
