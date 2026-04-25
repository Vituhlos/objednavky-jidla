import type { OrderData, OrderRowEnriched } from "./types";
import { EXTRAS_ROW_FIELDS } from "./pricing";
import { getSubmittedRows, isDepartmentSubmitted, joinDepartmentNames } from "./order-utils";

function formatOrderDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatOrderDateForSubject(date: string): string {
  return date;
}

function summariseCounts(items: string[]): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "cs", { sensitivity: "base" }))
    .map(([label, count]) => ({ label, count }));
}

function buildExtrasSummary(rows: OrderRowEnriched[]): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();

  for (const row of rows) {
    for (const extra of EXTRAS_ROW_FIELDS) {
      const count = row[extra.rowKey] as number;
      if (count > 0) {
        counts.set(extra.label, (counts.get(extra.label) ?? 0) + count);
      }
    }
  }

  return [...counts.entries()].map(([label, count]) => ({ label, count }));
}

function renderCountList(
  items: Array<{ label: string; count: number }>,
  prefix: string,
  emptyLabel: string
): string {
  if (items.length === 0) return `<li>${emptyLabel}</li>`;
  return items
    .map((item) => `<li>${item.count}x ${escapeHtml(prefix)} ${escapeHtml(item.label)}</li>`)
    .join("");
}

function inflectExtra(label: string, count: number): string {
  const forms: Record<string, [string, string, string]> = {
    Houska: ["Houska", "Housky", "Housek"],
    "Houskový knedlík": ["Houskový knedlík", "Houskové knedlíky", "Houskových knedlíků"],
    "Bramborový knedlík": ["Bramborový knedlík", "Bramborové knedlíky", "Bramborových knedlíků"],
    Kečup: ["Kečup", "Kečupy", "Kečupů"],
    Tatarka: ["Tatarka", "Tatarky", "Tatarek"],
    "BBQ omáčka": ["BBQ omáčka", "BBQ omáčky", "BBQ omáček"],
  };

  const variant = count === 1 ? 0 : count >= 2 && count <= 4 ? 1 : 2;
  return `${count} ${forms[label][variant]}`;
}

function renderExtrasList(items: Array<{ label: string; count: number }>): string {
  if (items.length === 0) {
    return "<li>Žádné</li>";
  }

  return items
    .map((item) => `<li>${escapeHtml(inflectExtra(item.label, item.count))}</li>`)
    .join("");
}

export function buildOrderEmail(orderData: OrderData): {
  subject: string;
  html: string;
  text: string;
} {
  const activeDepartments = orderData.departments.filter(isDepartmentSubmitted);
  const activeRows = activeDepartments.flatMap((department) =>
    getSubmittedRows(department.rows)
  );

  if (activeRows.length === 0) {
    throw new Error("Objednávka neobsahuje žádné aktivní položky k odeslání.");
  }

  const notes = activeRows
    .filter((row) => row.note?.trim())
    .map((row) => ({ name: row.personName || "?", note: row.note.trim() }));

  const soups = summariseCounts(
    activeRows.flatMap((row) => {
      const items: string[] = [];
      if (row.soupItem) items.push(`${row.soupItem.code} – ${row.soupItem.name}`.replace(/\s*[-–]\s*/, " – "));
      if (row.soupItem2) items.push(`${row.soupItem2.code} – ${row.soupItem2.name}`.replace(/\s*[-–]\s*/, " – "));
      return items;
    })
  );
  const meals = summariseCounts(
    activeRows.flatMap((row) => {
      const items: string[] = [];
      if (row.mainItem) {
        const label = `${row.mainItem.code} – ${row.mainItem.name}`.replace(/\s*[-–]\s*/, " – ");
        for (let i = 0; i < (row.mealCount || 1); i++) items.push(label);
      }
      for (const { item, count } of row.extraMealItems) {
        const label = `${item.code} – ${item.name}`.replace(/\s*[-–]\s*/, " – ");
        for (let i = 0; i < count; i++) items.push(label);
      }
      return items;
    })
  );
  const extras = buildExtrasSummary(activeRows);
  const subject = `Denní objednávka obědů – LIMA (${formatOrderDateForSubject(orderData.order.date)})`;
  const departmentNames = activeDepartments.map((d) => d.emailLabel);
  const departmentList = joinDepartmentNames(departmentNames);

  const oddeleniHtml = departmentNames
    .map((name) => `<li>${escapeHtml(name)}</li>`)
    .join("");

  const prilohyHtml = `
    <h3 style="color:#2F5496;">🥖 Přílohy</h3>
    <ul>${renderExtrasList(extras)}</ul>`;

  const notesHtml = notes.length > 0
    ? `<h3 style="color:#2F5496;">📝 Poznámky k jídlům</h3><ul>${notes.map((n) => `<li><strong>${escapeHtml(n.name)}:</strong> ${escapeHtml(n.note)}</li>`).join("")}</ul>`
    : "";

  const htmlShrnuti = `
    <div style="font-family: Calibri, sans-serif; font-size: 15px;">
      <h3 style="color:#2F5496;">📍 Objednávaná oddělení</h3>
      <ul>${oddeleniHtml}</ul>
      <h3 style="color:#2F5496;">🥣 Polévky</h3>
      <ul>${renderCountList(soups, "Polévka", "Žádné")}</ul>
      <h3 style="color:#2F5496;">🍽 Jídla</h3>
      <ul>${renderCountList(meals, "Jídlo", "Žádná")}</ul>
      ${prilohyHtml}
      ${notesHtml}
      <h3 style="color:#2F5496;">💰 Celková cena</h3>
      <p style="font-size:17px;font-weight:bold;">${orderData.totalPrice} Kč</p>
    </div>`;

  const html = `
    <div style="font-family: Calibri, sans-serif; font-size: 15px;">
      Dobrý den,<br><br>
      v příloze posílám PDF s dnešní objednávkou obědů firmy STROS - Sedlčanské strojírny,a.s., pro oddělení ${escapeHtml(
        departmentList
      )}.<br><br>
      ${htmlShrnuti}
      <br>Hezký den!<br><br>– automat objednávek<br>Jiří Rytíř<br>+420 770 138 644
    </div>
  `;

  const textLines = [
    "Denní objednávka obědů – LIMA",
    `v příloze posílám PDF s dnešní objednávkou obědů firmy STROS - Sedlčanské strojírny,a.s., pro oddělení ${departmentList}.`,
    "",
    "Objednávaná oddělení:",
    ...departmentNames.map((name) => `- ${name}`),
    "",
    "Polévky:",
    ...(soups.length > 0
      ? soups.map((item) => `- ${item.count}x Polévka ${item.label}`)
      : ["- Žádné"]),
    "",
    "Jídla:",
    ...(meals.length > 0
      ? meals.map((item) => `- ${item.count}x Jídlo ${item.label}`)
      : ["- Žádná"]),
    "",
    "Přílohy:",
    ...(extras.length > 0
      ? extras.map((item) => `- ${inflectExtra(item.label, item.count)}`)
      : ["- Žádné"]),
    "",
  ];
  if (notes.length > 0) {
    textLines.push("Poznámky k jídlům:");
    textLines.push(...notes.map((n) => `- ${n.name}: ${n.note}`));
    textLines.push("");
  }
  textLines.push(`Celková cena: ${orderData.totalPrice} Kč`, "");
  textLines.push("", "Hezký den!", "", "– automat objednávek", "Jiří Rytíř", "+420 770 138 644");

  return {
    subject,
    html,
    text: textLines.join("\n"),
  };
}
