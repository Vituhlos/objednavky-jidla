import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';
const OUT_DIR = 'docs/audit/screenshots/responsiveness';
fs.mkdirSync(OUT_DIR, { recursive: true });

const BREAKPOINTS = [
  { width: 320,  label: '320_iphone-se' },
  { width: 375,  label: '375_iphone-14' },
  { width: 768,  label: '768_tablet' },
  { width: 1024, label: '1024_tablet-landscape' },
  { width: 1280, label: '1280_laptop' },
  { width: 1440, label: '1440_desktop' },
];

const PAGES = [
  { path: '/',           name: 'home' },
  { path: '/jidelnicek', name: 'jidelnicek' },
  { path: '/pizza',      name: 'pizza' },
  { path: '/historie',   name: 'historie' },
  { path: '/nastaveni',  name: 'nastaveni' },
];

const issues = [];

function addIssue(page, bp, severity, check, detail) {
  issues.push({ page, bp, severity, check, detail });
}

async function checkOverflow(page) {
  return page.evaluate(() => {
    const body = document.body;
    const html = document.documentElement;
    const bodyW = Math.max(body.scrollWidth, body.offsetWidth, html.clientWidth, html.scrollWidth, html.offsetWidth);
    const vw = window.innerWidth;
    const overflowing = [];
    document.querySelectorAll('*').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.right > vw + 2) {
        overflowing.push(`${el.tagName.toLowerCase()}${el.className ? '.' + el.className.toString().split(' ').slice(0,2).join('.') : ''} (right: ${Math.round(rect.right)}px, vw: ${vw}px)`);
      }
    });
    return { hasOverflow: bodyW > vw + 2, bodyW, vw, overflowing: overflowing.slice(0, 5) };
  });
}

async function checkTouchTargets(page, width) {
  if (width > 768) return [];
  return page.evaluate(() => {
    const small = [];
    document.querySelectorAll('a, button, [role="button"], input, select').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)) {
        const text = (el.textContent || el.getAttribute('aria-label') || el.getAttribute('name') || '').trim().slice(0, 30);
        small.push(`${el.tagName.toLowerCase()} "${text}" (${Math.round(rect.width)}×${Math.round(rect.height)}px)`);
      }
    });
    return small.slice(0, 8);
  });
}

async function checkNavbar(page, width) {
  return page.evaluate((w) => {
    const mobileNav = document.querySelector('nav[aria-label="Navigace"]');
    const sidebar = document.querySelector('aside');
    return {
      mobileNavVisible: mobileNav ? getComputedStyle(mobileNav).display !== 'none' : false,
      sidebarVisible: sidebar ? getComputedStyle(sidebar).display !== 'none' : false,
    };
  }, width);
}

async function checkLastContentHidden(page) {
  return page.evaluate(() => {
    // Check if last meaningful element is hidden under the navbar
    const scrollArea = document.querySelector('.overflow-y-auto, [class*="overflow-y"]');
    if (!scrollArea) return null;
    const lastChild = scrollArea.lastElementChild;
    if (!lastChild) return null;
    const rect = lastChild.getBoundingClientRect();
    const nav = document.querySelector('nav[aria-label="Navigace"]');
    const navRect = nav ? nav.getBoundingClientRect() : null;
    if (navRect && rect.bottom > navRect.top - 10) {
      return `Poslední element zasahuje do nav oblasti (bottom: ${Math.round(rect.bottom)}px, nav top: ${Math.round(navRect.top)}px)`;
    }
    return null;
  });
}

const browser = await chromium.launch({ headless: true });

for (const pg of PAGES) {
  console.log(`\n== Testuju stránku: ${pg.name} ==`);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const browserPage = await context.newPage();

  try {
    await browserPage.goto(BASE_URL + pg.path, { waitUntil: 'networkidle', timeout: 15000 });
  } catch {
    await browserPage.goto(BASE_URL + pg.path, { waitUntil: 'domcontentloaded', timeout: 15000 });
  }

  for (const bp of BREAKPOINTS) {
    console.log(`  ${bp.width}px...`);
    await browserPage.setViewportSize({ width: bp.width, height: 900 });
    await browserPage.waitForTimeout(400);

    // Screenshot
    const screenshotPath = path.join(OUT_DIR, `${pg.name}_${bp.label}.png`);
    await browserPage.screenshot({ path: screenshotPath, fullPage: false });

    // Checks
    const overflow = await checkOverflow(browserPage);
    if (overflow.hasOverflow) {
      const detail = overflow.overflowing.length > 0
        ? `Overflow elementy: ${overflow.overflowing.join('; ')}`
        : `Body width ${overflow.bodyW}px > viewport ${overflow.vw}px`;
      addIssue(pg.name, bp.width, bp.width <= 768 ? 'High' : 'Medium', 'Horizontal overflow', detail);
    }

    if (bp.width <= 768) {
      const smallTargets = await checkTouchTargets(browserPage, bp.width);
      if (smallTargets.length > 0) {
        addIssue(pg.name, bp.width, 'Medium', 'Touch targets < 44px', smallTargets.join('; '));
      }

      const hidden = await checkLastContentHidden(browserPage);
      if (hidden) {
        addIssue(pg.name, bp.width, 'High', 'Obsah skrytý pod navbarem', hidden);
      }
    }

    const nav = await checkNavbar(browserPage, bp.width);
    if (bp.width < 768 && nav.sidebarVisible) {
      addIssue(pg.name, bp.width, 'High', 'Nav transition', 'Sidebar je viditelný na mobile viewportu (< 768px)');
    }
    if (bp.width >= 768 && nav.mobileNavVisible) {
      addIssue(pg.name, bp.width, 'Medium', 'Nav transition', 'Mobile bottom nav je viditelný na desktop viewportu (>= 768px)');
    }
  }

  await context.close();
}

await browser.close();

// Print report
console.log('\n\n══════════════════════════════════════════');
console.log('  RESPONSIVENESS CHECK REPORT');
console.log('══════════════════════════════════════════\n');

if (issues.length === 0) {
  console.log('✅ Žádné problémy nalezeny!\n');
} else {
  const bySeverity = { Critical: [], High: [], Medium: [], Low: [] };
  for (const i of issues) {
    bySeverity[i.severity]?.push(i);
  }

  for (const [sev, items] of Object.entries(bySeverity)) {
    if (items.length === 0) continue;
    const icon = sev === 'Critical' ? '🔴' : sev === 'High' ? '🟠' : sev === 'Medium' ? '🟡' : '🔵';
    console.log(`${icon} ${sev.toUpperCase()} (${items.length})`);
    for (const i of items) {
      console.log(`  [${i.page} @ ${i.bp}px] ${i.check}`);
      console.log(`    → ${i.detail}`);
    }
    console.log('');
  }
}

console.log(`Screenshots uloženy v: ${OUT_DIR}/`);
console.log(`Celkem nalezeno problémů: ${issues.length}`);
