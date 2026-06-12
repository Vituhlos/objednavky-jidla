import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const PAGES = [
  { path: '/', label: 'Hlavní stránka' },
  { path: '/jidelnicek', label: 'Jídelníček' },
  { path: '/login', label: 'Login' },
  { path: '/historie', label: 'Historie' },
];

const browser = await chromium.launch({ headless: true });
const allAxe = [];
const perfResults = [];
const consoleErrors = [];

for (const pg of PAGES) {
  console.log(`\nAudituju: ${pg.label}`);
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const p = await ctx.newPage();

  const pageErrors = [];
  const pageWarnings = [];
  p.on('console', msg => {
    if (msg.type() === 'error') pageErrors.push(msg.text().slice(0, 120));
    if (msg.type() === 'warning') pageWarnings.push(msg.text().slice(0, 120));
  });
  p.on('pageerror', err => pageErrors.push('JS ERROR: ' + err.message.slice(0, 120)));

  await p.goto(BASE + pg.path, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await p.waitForTimeout(1000);

  // ── Performance ──
  const perf = await p.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paint = performance.getEntriesByType('paint');
    const lcp = performance.getEntriesByType('largest-contentful-paint').slice(-1)[0];
    const fcp = paint.find(p => p.name === 'first-contentful-paint');
    return {
      domLoad: Math.round(nav?.domContentLoadedEventEnd || 0),
      fullLoad: Math.round(nav?.loadEventEnd || 0),
      fcp: Math.round(fcp?.startTime || 0),
      lcp: Math.round(lcp?.startTime || 0),
      transferSize: Math.round((nav?.transferSize || 0) / 1024),
    };
  });
  perfResults.push({ label: pg.label, path: pg.path, ...perf });
  console.log(`  FCP: ${perf.fcp}ms | LCP: ${perf.lcp}ms | Load: ${perf.fullLoad}ms | Transfer: ${perf.transferSize}KB`);

  // ── axe-core ──
  await p.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.9.1/axe.min.js' });
  await p.waitForTimeout(500);

  const axeResult = await p.evaluate(async () => {
    const results = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }
    });
    return results.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      nodes: v.nodes.length,
      help: v.help,
      helpUrl: v.helpUrl,
      nodeExamples: v.nodes.slice(0, 2).map(n => n.failureSummary?.split('\n')[0] || n.html?.slice(0, 80)),
    }));
  });

  if (axeResult.length > 0) {
    console.log(`  axe-core: ${axeResult.length} porušení`);
    axeResult.forEach(v => console.log(`    [${v.impact}] ${v.id}: ${v.help} (${v.nodes} element${v.nodes > 1 ? 'ů' : ''})`));
  } else {
    console.log(`  axe-core: ✅ 0 porušení`);
  }
  allAxe.push({ label: pg.label, violations: axeResult });

  // Console errors
  if (pageErrors.length > 0) {
    console.log(`  ⚠️  Console errors: ${pageErrors.join(' | ')}`);
    consoleErrors.push({ label: pg.label, errors: pageErrors, warnings: pageWarnings });
  }

  await ctx.close();
}

await browser.close();

// ── REPORT ──
console.log('\n\n══════════════════════════════════════════════════════');
console.log('  UX AUDIT — Automated gates (axe-core + performance)');
console.log('══════════════════════════════════════════════════════\n');

// Performance summary
console.log('── Performance ──');
for (const r of perfResults) {
  const lcpStatus = r.lcp > 4000 ? '🔴' : r.lcp > 2500 ? '🟡' : '✅';
  const fcpStatus = r.fcp > 1800 ? '🟡' : '✅';
  console.log(`  ${r.label}: FCP ${fcpStatus}${r.fcp}ms | LCP ${lcpStatus}${r.lcp}ms | ${r.transferSize}KB`);
}

// axe-core summary
console.log('\n── axe-core WCAG Violations ──');
const criticalAxe = allAxe.flatMap(p => p.violations.filter(v => v.impact === 'critical').map(v => ({ ...v, page: p.label })));
const seriousAxe = allAxe.flatMap(p => p.violations.filter(v => v.impact === 'serious').map(v => ({ ...v, page: p.label })));
const moderateAxe = allAxe.flatMap(p => p.violations.filter(v => v.impact === 'moderate').map(v => ({ ...v, page: p.label })));
const minorAxe = allAxe.flatMap(p => p.violations.filter(v => v.impact === 'minor').map(v => ({ ...v, page: p.label })));

if (criticalAxe.length === 0 && seriousAxe.length === 0) {
  console.log('  ✅ Žádné Critical ani Serious axe-core porušení — hard gates zelené');
}

for (const [label, items] of [['🔴 Critical', criticalAxe], ['🟠 Serious', seriousAxe], ['🟡 Moderate', moderateAxe], ['🔵 Minor', minorAxe]]) {
  if (items.length === 0) continue;
  console.log(`\n  ${label} (${items.length}):`);
  // Deduplicate by id
  const seen = new Set();
  for (const v of items) {
    const key = v.id;
    if (seen.has(key)) continue;
    seen.add(key);
    const pages = items.filter(i => i.id === v.id).map(i => i.page).join(', ');
    console.log(`    [${v.id}] ${v.help}`);
    console.log(`      Stránky: ${pages}`);
    if (v.nodeExamples?.[0]) console.log(`      Příklad: ${v.nodeExamples[0]}`);
  }
}

// Console errors
if (consoleErrors.length > 0) {
  console.log('\n── Console Errors ──');
  for (const c of consoleErrors) {
    console.log(`  ${c.label}: ${c.errors.join(' | ')}`);
  }
} else {
  console.log('\n── Console Errors: ✅ žádné ──');
}

// Hard gates verdict
const hasAxeCritical = criticalAxe.length > 0;
const hasAxeSerious = seriousAxe.length > 0;
const hasConsoleErrors = consoleErrors.length > 0;
const hasLcpFail = perfResults.some(r => r.lcp > 4000);

console.log('\n── Hard Gates ──');
console.log(`  axe Critical:    ${hasAxeCritical ? '🔴 FAIL' : '✅ OK'} (${criticalAxe.length})`);
console.log(`  axe Serious:     ${hasAxeSerious ? '🟠 FAIL' : '✅ OK'} (${seriousAxe.length})`);
console.log(`  Console errors:  ${hasConsoleErrors ? '🔴 FAIL' : '✅ OK'}`);
console.log(`  LCP > 4s:        ${hasLcpFail ? '🔴 FAIL' : '✅ OK'}`);

const verdict = (hasAxeCritical || hasConsoleErrors || hasLcpFail) ? 'FAIL' :
                (hasAxeSerious) ? 'CONDITIONAL FAIL' : 'PASS (automated gates)';
console.log(`\n  Verdict: ${verdict}`);
console.log('  (Plný interaktivní audit vyžaduje Chrome MCP nebo Playwright MCP)');
