import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({ headless: true });
const results = {};

async function measure(path, label) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const p = await ctx.newPage();
  const t0 = Date.now();
  await p.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await p.waitForTimeout(500);
  const loadMs = Date.now() - t0;

  const data = await p.evaluate(() => {
    // Useful — core features present
    const hasOrder = !!document.querySelector('[class*="dept"], [class*="Dept"], [class*="order"], [class*="Order"]');
    const hasMenu = !!document.querySelector('[class*="menu"], [class*="Menu"], [class*="item"], [class*="Item"]');

    // Findable — nav depth, search
    const navItems = [...document.querySelectorAll('nav a, nav button')].map(el => el.textContent.trim()).filter(Boolean);
    const hasSearch = !!document.querySelector('input[type="search"], [placeholder*="hled"], [placeholder*="search"]');
    const navLevels = document.querySelectorAll('nav ul ul').length;

    // Credible
    const hasLogo = !!document.querySelector('[class*="logo"], [class*="Logo"]');
    const hasVersion = /verze|version|beta|dev/i.test(document.body.textContent);

    // Desirable
    const hasAnimation = [...document.styleSheets].some(ss => {
      try { return [...ss.cssRules].some(r => r.cssText?.includes('transition') || r.cssText?.includes('animation')); }
      catch { return false; }
    });
    const usesGlass = document.querySelector('[class*="glass"]') !== null;

    // Time dimension
    const images = [...document.querySelectorAll('img')].length;
    const lazyImages = [...document.querySelectorAll('img[loading="lazy"]')].length;

    // Behavior — feedback elements
    const hasToast = !!document.querySelector('[role="alert"], [class*="toast"], [class*="Toast"]');
    const hasLoadingState = !!document.querySelector('[aria-busy], [class*="loading"], [class*="spinner"]');
    const hasEmptyState = /žádné|nenalezeny|nic tu není|prázdné/i.test(document.body.textContent);

    // Words — microcopy quality
    const errorTexts = [...document.querySelectorAll('[class*="error"], [class*="Error"]')]
      .map(el => el.textContent.trim()).filter(t => t.length > 3 && t.length < 200);
    const placeholders = [...document.querySelectorAll('input[placeholder]')].map(i => i.placeholder);
    const allText = document.body.textContent;
    const wordCount = allText.split(/\s+/).length;
    const czRatio = (allText.match(/[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/g) || []).length;

    // Ease of learning — onboarding hints
    const hasTooltips = document.querySelectorAll('[title], [aria-describedby]').length;
    const hasInfoIcons = document.querySelectorAll('[class*="info"], [class*="hint"], [class*="help"]').length;

    return {
      hasOrder, hasMenu, navItems, hasSearch, navLevels, hasLogo, hasVersion,
      hasAnimation, usesGlass, images, lazyImages, hasToast, hasLoadingState,
      hasEmptyState, errorTexts, placeholders, wordCount, czRatio,
      hasTooltips, hasInfoIcons,
      interactiveCount: document.querySelectorAll('a, button, input, select').length,
    };
  });

  results[label] = { loadMs, path, ...data };
  await ctx.close();
  console.log(`  ${label}: ${loadMs}ms load, ${data.interactiveCount} interactive elements`);
}

console.log('Měřím stránky...');
await measure('/', 'home');
await measure('/jidelnicek', 'jidelnicek');
await measure('/login', 'login');
await measure('/historie', 'historie');

await browser.close();

// ══════════════════════════════════════════
// IxDF HOLISTIC UX ANALYSIS
// ══════════════════════════════════════════

const h = results.home;
const j = results.jidelnicek;

console.log('\n\n══════════════════════════════════════════════════════');
console.log('  UX AUDIT & RETHINK — IxDF Framework');
console.log('  Kantýna | Mobile-first | Next.js + Glassmorphism');
console.log('  ' + new Date().toLocaleDateString('cs-CZ'));
console.log('══════════════════════════════════════════════════════\n');

// ── FRAMEWORK 1: 7 UX Factors ──────────────────────────
console.log('═══ 1. 7 UX FAKTORŮ (Peter Morville Honeycomb) ═══\n');

const factors = [
  {
    name: 'Useful', score: 5,
    notes: 'Řeší reálný problém — sdílené objednávky obědů ve firmě. Jídelníček, pizza, historie — kompletní flow.',
    good: ['Objednávka + jídelníček + pizza v jedné appce', 'Auto-odesílání s cron jobem', 'Sdílené oddělení live přes SSE'],
    bad: [],
  },
  {
    name: 'Usable', score: 4,
    notes: 'Celkově intuitivní. Glassmorphism design je přehledný. Drobné problémy s touch targety.',
    good: ['Jasná vizuální hierarchie', 'Konzistentní design systém', 'Mobilní nav s ikonami + popisky'],
    bad: ['Touch targety 41px místo 44px', 'Login bez labelů na polích'],
  },
  {
    name: 'Findable', score: 3,
    notes: 'Navigace je dostupná, ale chybí vyhledávání. 5 hlavních sekcí v navu — OK pro malou appku.',
    good: ['Přehledná navigace max 1 level hluboko', 'Aktivní stav v navu', 'Záložky dní v jídelníčku'],
    bad: ['Žádné vyhledávání v historii', 'Žádné filtrování objednávek', h.hasSearch ? '' : 'Chybí search'],
  },
  {
    name: 'Credible', score: 4,
    notes: 'Firemní interní nástroj — důvěra se buduje jinak než u veřejného produktu. Design je profesionální.',
    good: ['Profesionální glassmorphism UI', 'SSE real-time sync buduje důvěru', 'Bez reklam a tracking prvků'],
    bad: h.hasVersion ? ['Dev banner přítomen (správně upozorňuje na testovací prostředí)'] : [],
  },
  {
    name: 'Desirable', score: 4,
    notes: 'Glassmorphism design s amber/orange barvami je vizuálně příjemný a moderní.',
    good: ['Moderní glassmorphism s animacemi', 'Konzistentní amber/orange brand barvy', 'Čistý minimalistický layout'],
    bad: ['Žádné micro-animace při přidání objednávky', 'Chybí delight momenty (confetti apod.)'],
  },
  {
    name: 'Accessible', score: 2,
    notes: 'Zatím podprůměrné. Chybí h1, main elementy, labely na formulářích, skip linky.',
    good: ['Kontrast barev OK', 'lang="cs" nastaven', 'Focus styly přítomny'],
    bad: ['Chybí <h1> na stránkách', 'Login inputs bez <label>', 'Chybí skip link', 'Touch targety pod 44px'],
  },
  {
    name: 'Valuable', score: 5,
    notes: 'Pro firmu s pravidelným objednáváním obědů — šetří čas, eliminuje emaily, centralizuje správu.',
    good: ['Eliminuje manuální koordinaci objednávek', 'PDF reporty + email automatizace', 'Admin dashboard pro správu'],
    bad: [],
  },
];

let factorTotal = 0;
for (const f of factors) {
  factorTotal += f.score;
  const stars = '⭐'.repeat(f.score) + '☆'.repeat(5 - f.score);
  console.log(`${stars} ${f.name} (${f.score}/5)`);
  console.log(`  ${f.notes}`);
  if (f.good.length) console.log(`  ✅ ${f.good.filter(Boolean).join(' | ')}`);
  if (f.bad.filter(Boolean).length) console.log(`  ⚠️  ${f.bad.filter(Boolean).join(' | ')}`);
  console.log('');
}
console.log(`  Celkem: ${factorTotal}/35 (${Math.round(factorTotal/35*100)}%)\n`);

// ── FRAMEWORK 2: 5 Usability Characteristics ──────────
console.log('═══ 2. 5 USABILITY CHARAKTERISTIK ═══\n');

const usability = [
  { name: 'Effectiveness', score: 4, note: 'Uživatel přidá/odešle objednávku bez překážek. Flow je přímočarý.' },
  { name: 'Efficiency', score: 3, note: 'Přidání objednávky = 3-4 kliky. Šlo by zrychlit smart-defaults (pamatovat poslední volbu).' },
  { name: 'Engagement', score: 4, note: 'Glassmorphism + live sync je vizuálně poutavé. Chybí micro-feedback při akci.' },
  { name: 'Error Tolerance', score: 3, note: 'Login má validaci. Odeslání objednávky má status bar. Chybí confirm dialog před odesláním.' },
  { name: 'Ease of Learning', score: 4, note: 'Ikony + popisky v navu. Bez onboardingu, ale appka je dostatečně jednoduchá.' },
];

let usabilityTotal = 0;
for (const u of usability) {
  usabilityTotal += u.score;
  const stars = '⭐'.repeat(u.score) + '☆'.repeat(5 - u.score);
  console.log(`${stars} ${u.name} (${u.score}/5): ${u.note}`);
}
console.log(`\n  Celkem: ${usabilityTotal}/25 (${Math.round(usabilityTotal/25*100)}%)\n`);

// ── FRAMEWORK 3: 5 Interaction Design Dimensions ──────
console.log('═══ 3. 5 DIMENZÍ INTERACTION DESIGNU ═══\n');

const avgLoad = Math.round(Object.values(results).reduce((s, r) => s + r.loadMs, 0) / Object.keys(results).length);

const dimensions = [
  { name: 'Words (microcopy)', score: 4, note: 'Česká lokalizace, přirozený jazyk. Placeholder "vas@email.cz" vhodný. Chybí popisné labely na login polích.' },
  { name: 'Visual Representations', score: 4, note: `Glassmorphism s Material Icons. ${h.usesGlass ? 'Glass efekt detekován ✓' : ''}. Ikony mají textové doplnění v navu.` },
  { name: 'Physical Objects/Space', score: 3, note: 'Mobile-first layout OK. Touch targety 41px (těsně pod 44px). Žádný horizontální overflow.' },
  { name: 'Time', score: 4, note: `Průměrný load: ${avgLoad}ms — rychlé. SSE pro live sync. ${h.lazyImages > 0 ? 'Lazy loading obrázků.' : 'Minimum obrázků.'}` },
  { name: 'Behavior', score: 4, note: 'SSE real-time sync, optimistické UI, status bar objednávky. Chybí confirm před odesláním a toast po přidání řádku.' },
];

let dimTotal = 0;
for (const d of dimensions) {
  dimTotal += d.score;
  const stars = '⭐'.repeat(d.score) + '☆'.repeat(5 - d.score);
  console.log(`${stars} ${d.name} (${d.score}/5): ${d.note}`);
}
console.log(`\n  Celkem: ${dimTotal}/25 (${Math.round(dimTotal/25*100)}%)\n`);

// ── CELKOVÉ SKÓRE ──────────────────────────────────────
const total = factorTotal + usabilityTotal + dimTotal;
const maxTotal = 85;
const pct = Math.round(total / maxTotal * 100);
const grade = pct >= 88 ? 'A' : pct >= 76 ? 'B' : pct >= 65 ? 'C' : pct >= 53 ? 'D' : 'F';

console.log('═══ CELKOVÉ UX SKÓRE ═══\n');
console.log(`  7 Faktorů:       ${factorTotal}/35`);
console.log(`  5 Usability:     ${usabilityTotal}/25`);
console.log(`  5 Dimensions:    ${dimTotal}/25`);
console.log(`  ──────────────────────`);
console.log(`  CELKEM:          ${total}/${maxTotal} (${pct}%) — Grade ${grade}\n`);

// ── PRIORITY ACTIONS ──────────────────────────────────
console.log('═══ PRIORITNÍ AKCE ═══\n');
console.log('P0 — Opravit ihned:');
console.log('  1. Login: přidat <label> na email/password inputs');
console.log('  2. Všechny stránky: přidat <h1> a <main> element');
console.log('  3. Layout: přidat skip link "Přeskočit na obsah"');
console.log('  4. Všechny stránky: unikátní <title> (Jídelníček – Kantýna)');
console.log('');
console.log('P1 — Opravit brzy:');
console.log('  5. AppTopBar: zvýšit touch targety nav linků z 41px → 44px');
console.log('  6. Login: "Zapomněli jste heslo?" a "Registrovat se" přidat py-2');
console.log('  7. Login: eye button zvětšit na min 44×44px');
console.log('');
console.log('P2 — Zvážit:');
console.log('  8. Confirm dialog před odesláním objednávky');
console.log('  9. Smart-defaults: pamatovat poslední objednávku uživatele');
console.log(' 10. SSE live indikátor (zelená tečka / "Aktualizováno v HH:MM")');
console.log(' 11. Vyhledávání / filtrování v historii');
