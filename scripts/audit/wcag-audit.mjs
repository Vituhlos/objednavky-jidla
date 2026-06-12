import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3000';

const PAGES = [
  { path: '/',           name: 'Hlavní stránka' },
  { path: '/jidelnicek', name: 'Jídelníček' },
  { path: '/pizza',      name: 'Pizza' },
  { path: '/historie',   name: 'Historie' },
  { path: '/login',      name: 'Login' },
];

const issues = [];
function addIssue(page, level, criterion, severity, detail, recommendation) {
  issues.push({ page, level, criterion, severity, detail, recommendation });
}

const browser = await chromium.launch({ headless: true });

for (const pg of PAGES) {
  console.log(`\nAudituju: ${pg.name} (${pg.path})`);
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const p = await ctx.newPage();
  try {
    await p.goto(BASE_URL + pg.path, { waitUntil: 'networkidle', timeout: 15000 });
  } catch {
    await p.goto(BASE_URL + pg.path, { waitUntil: 'domcontentloaded', timeout: 10000 });
  }
  await p.waitForTimeout(500);

  // ── 3.1.1 Language of Page ──
  const lang = await p.evaluate(() => document.documentElement.lang);
  if (!lang || lang.trim() === '') {
    addIssue(pg.name, 'A', '3.1.1 Language of Page', 'Critical',
      'Chybí lang atribut na <html>',
      'Přidat <html lang="cs"> do root layoutu');
  }

  // ── 2.4.2 Page Titled ──
  const title = await p.title();
  if (!title || title.trim() === '') {
    addIssue(pg.name, 'A', '2.4.2 Page Titled', 'Serious',
      'Stránka nemá <title>',
      'Přidat unikátní popisný title do každé stránky');
  } else {
    console.log(`  title: "${title}"`);
  }

  // ── 1.1.1 Non-text Content — images without alt ──
  const imgsNoAlt = await p.evaluate(() => {
    const imgs = [...document.querySelectorAll('img')];
    return imgs.filter(i => !i.hasAttribute('alt')).map(i => i.src || i.className);
  });
  if (imgsNoAlt.length > 0) {
    addIssue(pg.name, 'A', '1.1.1 Non-text Content', 'Serious',
      `${imgsNoAlt.length} obrázek(y) bez alt atributu: ${imgsNoAlt.slice(0,3).join(', ')}`,
      'Přidat popisný alt text, nebo alt="" pro dekorativní obrázky');
  }

  // ── Icon buttons without accessible name ──
  const iconBtnsNoLabel = await p.evaluate(() => {
    const btns = [...document.querySelectorAll('button, [role="button"]')];
    return btns.filter(b => {
      const hasText = b.textContent.trim().length > 0;
      const hasLabel = b.hasAttribute('aria-label') || b.hasAttribute('aria-labelledby') || b.hasAttribute('title');
      const hasSvgTitle = b.querySelector('title') !== null;
      return !hasText && !hasLabel && !hasSvgTitle;
    }).map(b => b.className.toString().slice(0, 60));
  });
  if (iconBtnsNoLabel.length > 0) {
    addIssue(pg.name, 'A', '4.1.2 Name, Role, Value', 'Serious',
      `${iconBtnsNoLabel.length} tlačítko(a) bez přístupného názvu: ${iconBtnsNoLabel.slice(0,3).join(' | ')}`,
      'Přidat aria-label nebo viditelný text ke každému tlačítku');
  }

  // ── 1.3.1 Heading hierarchy ──
  const headings = await p.evaluate(() => {
    const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')];
    return hs.map(h => ({ tag: h.tagName, text: h.textContent.trim().slice(0,40) }));
  });
  const h1count = headings.filter(h => h.tag === 'H1').length;
  if (h1count === 0) {
    addIssue(pg.name, 'A', '1.3.1 Info and Relationships', 'Moderate',
      'Stránka neobsahuje žádný <h1>',
      'Přidat hlavní nadpis h1 pro strukturu stránky');
  } else if (h1count > 1) {
    addIssue(pg.name, 'A', '1.3.1 Info and Relationships', 'Minor',
      `Stránka obsahuje ${h1count}× <h1>`,
      'Každá stránka by měla mít právě jeden h1');
  }

  // ── 2.4.1 Bypass Blocks — skip link ──
  const hasSkipLink = await p.evaluate(() => {
    const links = [...document.querySelectorAll('a[href^="#"]')];
    return links.some(l => /skip|přeskočit|obsah/i.test(l.textContent));
  });
  if (!hasSkipLink) {
    addIssue(pg.name, 'A', '2.4.1 Bypass Blocks', 'Moderate',
      'Chybí "Přeskočit na hlavní obsah" link',
      'Přidat skip link jako první fokusovatelný element stránky');
  }

  // ── 2.4.7 Focus Visible ──
  const focusIssues = await p.evaluate(() => {
    const focusable = [...document.querySelectorAll('a, button, input, select, textarea, [tabindex]')].filter(el => {
      const ti = el.getAttribute('tabindex');
      return ti === null || parseInt(ti) >= 0;
    });
    const noOutline = [];
    focusable.slice(0, 15).forEach(el => {
      const style = getComputedStyle(el);
      const outline = style.outline;
      const outlineWidth = style.outlineWidth;
      const boxShadow = style.boxShadow;
      if ((outline === 'none' || outlineWidth === '0px') && boxShadow === 'none') {
        const text = (el.textContent || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim().slice(0, 25);
        noOutline.push(`${el.tagName.toLowerCase()}${text ? ` "${text}"` : ''}`);
      }
    });
    return noOutline;
  });
  if (focusIssues.length > 0) {
    addIssue(pg.name, 'AA', '2.4.7 Focus Visible', 'Serious',
      `Elementy bez viditelného focus stylu: ${focusIssues.slice(0,4).join(', ')}`,
      'Přidat outline nebo box-shadow focus styl — nikdy nepoužívat outline: none bez náhrady');
  }

  // ── 2.5.8 Target Size (WCAG 2.2) — min 24×24px ──
  const smallTargets24 = await p.evaluate(() => {
    const els = [...document.querySelectorAll('a, button, [role="button"], input[type="checkbox"], input[type="radio"]')];
    return els.filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && (r.width < 24 || r.height < 24);
    }).map(el => {
      const r = el.getBoundingClientRect();
      const text = (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 25);
      return `${el.tagName.toLowerCase()} "${text}" (${Math.round(r.width)}×${Math.round(r.height)}px)`;
    });
  });
  if (smallTargets24.length > 0) {
    addIssue(pg.name, 'AA', '2.5.8 Target Size (WCAG 2.2)', 'Moderate',
      `Elementy pod 24×24px: ${smallTargets24.slice(0,4).join('; ')}`,
      'Zvětšit minimálně na 24×24px (WCAG 2.2), ideálně 44×44px');
  }

  // ── Form labels ──
  const unlabeledInputs = await p.evaluate(() => {
    const inputs = [...document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea')];
    return inputs.filter(inp => {
      const id = inp.id;
      const hasLabel = id && document.querySelector(`label[for="${id}"]`);
      const hasAriaLabel = inp.hasAttribute('aria-label') || inp.hasAttribute('aria-labelledby');
      const hasPlaceholder = inp.hasAttribute('placeholder');
      const wrappedInLabel = inp.closest('label') !== null;
      return !hasLabel && !hasAriaLabel && !wrappedInLabel;
    }).map(inp => `${inp.type || inp.tagName} placeholder="${inp.placeholder || ''}"`);
  });
  if (unlabeledInputs.length > 0) {
    addIssue(pg.name, 'A', '3.3.2 Labels or Instructions', 'Serious',
      `${unlabeledInputs.length} vstupní pole bez labelu: ${unlabeledInputs.slice(0,3).join(', ')}`,
      'Přidat <label for="id"> nebo aria-label ke každému input poli');
  }

  // ── ARIA roles validity ──
  const badAria = await p.evaluate(() => {
    const issues = [];
    document.querySelectorAll('[aria-label=""]').forEach(el => {
      issues.push(`Prázdný aria-label: ${el.tagName.toLowerCase()}.${el.className.toString().slice(0,30)}`);
    });
    document.querySelectorAll('[role]').forEach(el => {
      const role = el.getAttribute('role');
      const validRoles = ['button','link','navigation','main','banner','contentinfo','complementary','region','dialog','alert','status','tab','tablist','tabpanel','menu','menuitem','list','listitem','grid','gridcell','row','columnheader','rowheader','checkbox','radio','combobox','listbox','option','slider','spinbutton','textbox','tree','treeitem','img','figure','heading','none','presentation','search','form','article','group','separator'];
      if (!validRoles.includes(role)) {
        issues.push(`Neznámý role="${role}" na ${el.tagName.toLowerCase()}`);
      }
    });
    return issues.slice(0, 5);
  });
  if (badAria.length > 0) {
    addIssue(pg.name, 'A', '4.1.2 Name, Role, Value', 'Moderate',
      `ARIA problémy: ${badAria.join('; ')}`,
      'Opravit nebo odebrat neplatné ARIA atributy');
  }

  // ── Landmark regions ──
  const landmarks = await p.evaluate(() => {
    return {
      hasMain: !!document.querySelector('main, [role="main"]'),
      hasNav: !!document.querySelector('nav, [role="navigation"]'),
      hasHeader: !!document.querySelector('header, [role="banner"]'),
    };
  });
  if (!landmarks.hasMain) {
    addIssue(pg.name, 'A', '1.3.1 Info and Relationships', 'Moderate',
      'Chybí element <main> pro hlavní obsah',
      'Obalit hlavní obsah stránky do <main> elementu');
  }

  // ── Color contrast — test specific known colors ──
  // stone-400 (#a8a29e) on white (#f3efe6 --paper) = approx 2.8:1 (FAIL for normal text)
  const contrastIssues = await p.evaluate(() => {
    const issues = [];
    // Check text elements with muted colors
    const els = [...document.querySelectorAll('p, span, div, label')].filter(el => {
      const style = getComputedStyle(el);
      const color = style.color;
      const children = el.children.length;
      const text = el.textContent.trim();
      return text.length > 0 && text.length < 100 && children === 0 && color;
    });
    // Sample up to 20 elements
    const sample = els.slice(0, 20);
    const rgbToHex = (r, g, b) => '#' + [r,g,b].map(x => x.toString(16).padStart(2,'0')).join('');
    const getLuminance = (r, g, b) => {
      const [rs, gs, bs] = [r,g,b].map(c => {
        c /= 255;
        return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4);
      });
      return 0.2126*rs + 0.0722*bs + 0.0715*gs;
    };
    const getContrastRatio = (l1, l2) => {
      const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
      return (lighter + 0.05) / (darker + 0.05);
    };
    sample.forEach(el => {
      const style = getComputedStyle(el);
      const fg = style.color.match(/\d+/g);
      const bg = style.backgroundColor.match(/\d+/g);
      if (!fg || !bg) return;
      const [fr, fg2, fb] = fg.map(Number);
      const [br, bg2, bb] = bg.map(Number);
      if (br === 0 && bg2 === 0 && bb === 0 && bg[3] === '0') return; // transparent bg
      const fgL = getLuminance(fr, fg2, fb);
      const bgL = getLuminance(br, bg2, bb);
      const ratio = getContrastRatio(fgL, bgL);
      const fontSize = parseFloat(style.fontSize);
      const fontWeight = style.fontWeight;
      const isLargeText = fontSize >= 18 || (fontSize >= 14 && (fontWeight === 'bold' || parseInt(fontWeight) >= 700));
      const required = isLargeText ? 3.0 : 4.5;
      if (ratio < required && ratio > 1) {
        const text = el.textContent.trim().slice(0, 30);
        issues.push({
          text,
          ratio: ratio.toFixed(2),
          required,
          fg: rgbToHex(fr, fg2, fb),
          bg: rgbToHex(br, bg2, bb),
          fontSize: Math.round(fontSize)
        });
      }
    });
    return issues.slice(0, 5);
  });
  if (contrastIssues.length > 0) {
    const details = contrastIssues.map(i => `"${i.text}" ${i.fg} na ${i.bg} = ${i.ratio}:1 (min ${i.required}:1)`).join(' | ');
    addIssue(pg.name, 'AA', '1.4.3 Contrast (Minimum)', 'Serious',
      `Nedostatečný kontrast: ${details}`,
      'Ztmavit barvu textu nebo zesvětlit pozadí na min 4.5:1 (3:1 pro velký text)');
  }

  await ctx.close();
}

await browser.close();

// ══════════════════════════════════════════
console.log('\n\n══════════════════════════════════════════');
console.log('  WCAG 2.2 ACCESSIBILITY AUDIT REPORT');
console.log('  Úroveň: AA  |  Datum: ' + new Date().toLocaleDateString('cs-CZ'));
console.log('══════════════════════════════════════════\n');

if (issues.length === 0) {
  console.log('✅ Žádné problémy nalezeny!\n');
} else {
  const grouped = {};
  for (const i of issues) {
    if (!grouped[i.criterion]) grouped[i.criterion] = [];
    grouped[i.criterion].push(i);
  }

  const severityOrder = { Critical: 0, Serious: 1, Moderate: 2, Minor: 3 };
  const sevIcon = { Critical: '🔴', Serious: '🟠', Moderate: '🟡', Minor: '🔵' };

  const sorted = Object.entries(grouped).sort((a, b) => {
    const aMin = Math.min(...a[1].map(i => severityOrder[i.severity] ?? 4));
    const bMin = Math.min(...b[1].map(i => severityOrder[i.severity] ?? 4));
    return aMin - bMin;
  });

  for (const [criterion, items] of sorted) {
    const topSev = items.reduce((a, b) => severityOrder[a.severity] < severityOrder[b.severity] ? a : b);
    console.log(`${sevIcon[topSev.severity]} [${topSev.level}] ${criterion}`);
    for (const i of items) {
      console.log(`  • ${i.page}: ${i.detail}`);
      console.log(`    → ${i.recommendation}`);
    }
    console.log('');
  }
}

const bySev = { Critical: 0, Serious: 0, Moderate: 0, Minor: 0 };
for (const i of issues) bySev[i.severity] = (bySev[i.severity] || 0) + 1;
console.log('══════════════════════════════════════════');
console.log(`Celkem: ${issues.length} problémů`);
console.log(`🔴 Critical: ${bySev.Critical}  🟠 Serious: ${bySev.Serious}  🟡 Moderate: ${bySev.Moderate}  🔵 Minor: ${bySev.Minor}`);
