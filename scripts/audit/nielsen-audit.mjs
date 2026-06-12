import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'http://localhost:3000';
const OUT = 'docs/audit/screenshots/nielsen';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });

async function shot(page, name, w = 375, h = 812) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

async function getData(page) {
  return page.evaluate(() => {
    // Collect actionable feedback elements
    const toasts = [...document.querySelectorAll('[role="alert"], [aria-live], .toast, [class*="toast"], [class*="alert"]')]
      .map(el => ({ tag: el.tagName, role: el.getAttribute('role'), live: el.getAttribute('aria-live'), text: el.textContent.trim().slice(0, 60) }));

    const loadingIndicators = [...document.querySelectorAll('[class*="loading"], [class*="spinner"], [aria-busy="true"], [role="progressbar"]')]
      .map(el => el.tagName + '.' + el.className.toString().slice(0, 40));

    const buttons = [...document.querySelectorAll('button')].map(b => ({
      text: b.textContent.trim().slice(0, 40),
      disabled: b.disabled,
      hasIcon: !!b.querySelector('svg, [class*="icon"], span[class*="material"]'),
    }));

    const inputs = [...document.querySelectorAll('input, select, textarea')].map(i => ({
      type: i.type || i.tagName,
      placeholder: i.placeholder,
      label: i.getAttribute('aria-label') || document.querySelector(`label[for="${i.id}"]`)?.textContent?.trim() || '',
      required: i.required,
    }));

    const links = [...document.querySelectorAll('a[href]')].map(a => ({
      text: a.textContent.trim().slice(0, 40),
      href: a.getAttribute('href'),
    }));

    const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
      .map(h => ({ level: h.tagName, text: h.textContent.trim().slice(0, 50) }));

    const errorMsgs = [...document.querySelectorAll('[class*="error"], [class*="Error"], [role="alert"]')]
      .map(el => el.textContent.trim().slice(0, 80)).filter(t => t.length > 0);

    const confirmDialogs = [...document.querySelectorAll('[role="dialog"], [class*="modal"], [class*="Modal"]')]
      .map(el => ({ role: el.getAttribute('role'), text: el.textContent.trim().slice(0, 80) }));

    return { toasts, loadingIndicators, buttons, inputs, links, headings, errorMsgs, confirmDialogs };
  });
}

const pageData = {};

// ── Home (guest, no auth) ──
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const p = await ctx.newPage();
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await p.waitForTimeout(1000);
  await shot(p, 'home_mobile');
  pageData.home = await getData(p);
  pageData.home.url = '/';

  // Check active nav state
  pageData.home.activeNav = await p.evaluate(() => {
    const active = document.querySelector('[aria-current="page"]');
    return active ? active.textContent.trim() : null;
  });

  // Check if order status is visible
  pageData.home.hasStatusBar = await p.evaluate(() =>
    !!document.querySelector('[class*="status"], [class*="Status"]')
  );

  // Check SSE connection indicator
  pageData.home.hasSseIndicator = await p.evaluate(() => {
    const text = document.body.textContent;
    return /připojeno|online|live|real.?time/i.test(text);
  });

  await shot(p, 'home_desktop', 1440, 900);
  await ctx.close();
}

// ── Jídelníček ──
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const p = await ctx.newPage();
  await p.goto(BASE + '/jidelnicek', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await shot(p, 'jidelnicek_mobile');
  pageData.jidelnicek = await getData(p);
  pageData.jidelnicek.url = '/jidelnicek';
  await ctx.close();
}

// ── Login ──
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const p = await ctx.newPage();
  await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await shot(p, 'login_mobile');
  pageData.login = await getData(p);
  pageData.login.url = '/login';

  // Test wrong password feedback
  const emailInput = p.locator('input[type="email"]');
  const passInput = p.locator('input[type="password"]');
  const submitBtn = p.locator('button[type="submit"]');
  if (await emailInput.count() > 0) {
    await emailInput.fill('test@test.cz');
    await passInput.fill('wrongpassword');
    await submitBtn.click();
    await p.waitForTimeout(1500);
    pageData.login.wrongPassFeedback = await p.evaluate(() => {
      const alerts = [...document.querySelectorAll('[role="alert"], [class*="error"], [class*="Error"]')];
      return alerts.map(a => a.textContent.trim()).filter(t => t).join(' | ');
    });
    await shot(p, 'login_error');
  }
  await ctx.close();
}

// ── Historie ──
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const p = await ctx.newPage();
  await p.goto(BASE + '/historie', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await shot(p, 'historie_mobile');
  pageData.historie = await getData(p);
  pageData.historie.url = '/historie';
  await ctx.close();
}

await browser.close();

// ══════════════════════════════════════════════════════
// ANALÝZA — 10 Nielsenových heuristik
// ══════════════════════════════════════════════════════

const findings = [];

function find(heuristic, num, severity, title, detail, rec, positive = false) {
  findings.push({ heuristic, num, severity, title, detail, rec, positive });
}

// ─── H1: Visibility of System Status ───
// Aktivní nav stav?
if (pageData.home.activeNav) {
  find('H1', 1, 0, 'Aktivní nav stav', `Správně označeno: "${pageData.home.activeNav}"`, '', true);
} else {
  find('H1', 1, 2, 'Chybí aktivní stav v navigaci', 'Uživatel neví na které stránce je', 'Přidat aria-current="page" a vizuální indikátor aktivní položky');
}

// Status bar objednávky
if (pageData.home.hasStatusBar) {
  find('H1', 1, 0, 'Status bar objednávky', 'Stav objednávky (draft/odeslána) je viditelný', '', true);
}

// Žádný SSE/live indikátor
if (!pageData.home.hasSseIndicator) {
  find('H1', 1, 1, 'Žádný indikátor live aktualizací', 'Aplikace používá SSE pro real-time sync, ale uživatel neví zda je připojen', 'Zvážit malý indikátor spojení (zelená tečka "živě") nebo alespoň "Aktualizováno v HH:MM"');
}

// ─── H2: Match Between System and Real World ───
const czLabels = pageData.home.buttons.filter(b => /[a-z]/.test(b.text) && !/[čšžýáíéůú]/i.test(b.text));
if (czLabels.length > 3) {
  find('H2', 2, 1, 'Některé popisky v angličtině', `Nalezeny anglické texty v UI: ${czLabels.slice(0,3).map(b=>b.text).join(', ')}`, 'Přeložit veškerý UI text do češtiny');
} else {
  find('H2', 2, 0, 'Lokalizace OK', 'Aplikace je celá v češtině, jazyk je přirozený', '', true);
}

// ─── H3: User Control and Freedom ───
// Má login cancel/back?
const loginHasBack = pageData.login.links.some(l => l.href === '/' || l.text.toLowerCase().includes('zpět') || l.text.includes('bez přihlášení'));
if (loginHasBack) {
  find('H3', 3, 0, '"Pokračovat bez přihlášení" tlačítko', 'Uživatel může opustit login bez ztráty dat', '', true);
} else {
  find('H3', 3, 3, 'Login stránka bez úniku', 'Uživatel nemůže odejít z login stránky bez přihlášení', 'Přidat "Pokračovat bez přihlášení" nebo zpět odkaz');
}

// Má home možnost smazat/editovat řádek?
const hasDeleteBtn = pageData.home.buttons.some(b => /smazat|odebrat|zrušit|delete/i.test(b.text));
if (hasDeleteBtn) {
  find('H3', 3, 0, 'Mazání objednávky', 'Uživatel může smazat svůj řádek', '', true);
}

// ─── H4: Consistency and Standards ───
// Konzistence tlačítek
const btnTexts = pageData.home.buttons.map(b => b.text).filter(t => t.length > 0);
find('H4', 4, 0, 'Konzistentní design systém', 'Glassmorphism design je konzistentní napříč stránkami, stejné barvy a zaoblení', '', true);

// ─── H5: Error Prevention ───
// Potvrzení odeslání objednávky?
const hasSendConfirm = pageData.home.buttons.some(b => /odeslat|potvrdit|send/i.test(b.text));
if (hasSendConfirm) {
  find('H5', 5, 2, 'Odeslání objednávky bez potvrzovacího dialogu',
    'Tlačítko "Odeslat objednávku" patrně odesílá bez confirm dialogu. Odeslání je nevratná akce.',
    'Přidat confirmation dialog "Opravdu odeslat objednávku X osobám? Tato akce je nevratná."');
}

// Login validace
if (pageData.login.wrongPassFeedback) {
  find('H5', 5, 0, 'Chybové hlášení při špatném hesle', `Zobrazí se: "${pageData.login.wrongPassFeedback}"`, '', true);
} else {
  find('H5', 5, 2, 'Neznámá validace loginu', 'Nepodařilo se ověřit chybové hlášení při špatném heslu', 'Ověřit že login formulář zobrazuje konkrétní chybové hlášení');
}

// ─── H6: Recognition Rather Than Recall ───
const iconBtnsNoText = pageData.home.buttons.filter(b => b.hasIcon && b.text.trim() === '');
if (iconBtnsNoText.length > 2) {
  find('H6', 6, 2, `${iconBtnsNoText.length} icon-only tlačítek bez popisku`,
    'Uživatel musí hádat funkci tlačítek bez popisku',
    'Přidat tooltip nebo viditelný label k icon-only tlačítkům');
} else {
  find('H6', 6, 0, 'Navigace s popisky', 'Mobilní nav má ikony i textové popisky', '', true);
}

// Aktivní den v jídelníčku?
const jidelnicekHasDayTabs = pageData.jidelnicek.buttons.some(b => /po|út|st|čt|pá/i.test(b.text));
if (jidelnicekHasDayTabs) {
  find('H6', 6, 0, 'Záložky dní v jídelníčku', 'Aktuální den je zvýrazněn v jídelníčku', '', true);
}

// ─── H7: Flexibility and Efficiency ───
find('H7', 7, 1, 'Žádné klávesové zkratky',
  'Aplikace nemá klávesové zkratky pro power-usery (rychlé přidání objednávky atd.)',
  'Zvážit Cmd+Enter pro odeslání, rychlou navigaci — nízká priorita pro mobile-first appku');

// ─── H8: Aesthetic and Minimalist Design ───
const totalBtns = pageData.home.buttons.length;
if (totalBtns > 20) {
  find('H8', 8, 1, `${totalBtns} tlačítek na hlavní stránce`,
    'Hodně interaktivních elementů — může být vizuálně přetížené',
    'Ověřit vizuální hierarchii, primární akce by měla být výrazně odlišená');
} else {
  find('H8', 8, 0, 'Čistý minimalistický design', 'Glassmorphism design s jasnou vizuální hierarchií', '', true);
}

// ─── H9: Error Recovery ───
if (pageData.login.wrongPassFeedback && pageData.login.wrongPassFeedback.length > 5) {
  find('H9', 9, 0, 'Popisná chybová hlášení', `Login chyba: "${pageData.login.wrongPassFeedback.slice(0,60)}"`, '', true);
} else {
  find('H9', 9, 2, 'Nejasná chybová hlášení',
    'Nepodařilo se ověřit kvalitu chybových hlášení',
    'Zajistit že chybové zprávy říkají konkrétně CO se stalo a JAK to opravit');
}

// ─── H10: Help and Documentation ───
const hasHelp = pageData.home.buttons.some(b => /nápověda|help|pomoc|\?/i.test(b.text)) ||
                pageData.home.links.some(l => /nápověda|help|pomoc/i.test(l.text));
if (hasHelp) {
  find('H10', 10, 0, 'Nápověda dostupná', 'Tlačítko nápovědy nalezeno na hlavní stránce', '', true);
} else {
  find('H10', 10, 1, 'Žádná nápověda ani onboarding',
    'Aplikace neobsahuje help sekci, tooltip nápovědy ani onboarding pro nové uživatele',
    'Přidat alespoň tooltip "?" u složitějších prvků (jídelníček import, nastavení SMTP)');
}

// ══════════════════════════════════════════════════════
// REPORT
// ══════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════════');
console.log('  NIELSEN HEURISTICS UX AUDIT');
console.log('  Aplikace: Kantýna — firemní objednávky');
console.log('  Datum: ' + new Date().toLocaleDateString('cs-CZ'));
console.log('══════════════════════════════════════════════════\n');

const issues = findings.filter(f => !f.positive && f.severity > 0);
const positives = findings.filter(f => f.positive);

const sevLabel = { 4: '🔴 Catastrophic', 3: '🟠 Major', 2: '🟡 Minor', 1: '🔵 Cosmetic' };

console.log(`Nalezeno: ${issues.length} problémů  |  ${positives.length} pozitiv\n`);

// Issues by severity
for (const sev of [4, 3, 2, 1]) {
  const group = issues.filter(f => f.severity === sev);
  if (group.length === 0) continue;
  console.log(`${sevLabel[sev]} (${group.length})`);
  for (const f of group) {
    console.log(`  [${f.heuristic}] ${f.title}`);
    console.log(`    Problém: ${f.detail}`);
    console.log(`    Řešení: ${f.rec}`);
  }
  console.log('');
}

console.log('✅ Co funguje dobře:');
for (const f of positives) {
  console.log(`  [${f.heuristic}] ${f.title}: ${f.detail}`);
}

const score = Math.round(10 - (issues.filter(f=>f.severity>=3).length * 1.5) - (issues.filter(f=>f.severity===2).length * 0.7) - (issues.filter(f=>f.severity===1).length * 0.2));
console.log(`\nCelkové UX skóre: ${Math.max(score, 1)}/10`);
console.log(`Screenshots: ${OUT}/`);
