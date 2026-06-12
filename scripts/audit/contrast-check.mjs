import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { createRequire } from 'module';

// Serve axe-core locally to avoid redirect issue
const require = createRequire(import.meta.url);
let axeSource;
try {
  const axePath = require.resolve('axe-core/axe.min.js');
  axeSource = readFileSync(axePath, 'utf8');
} catch {
  axeSource = readFileSync('./node_modules/axe-core/axe.min.js', 'utf8');
}

const server = createServer((req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.end(axeSource);
});
await new Promise(r => server.listen(9999, r));

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({ headless: true });

for (const [path, label] of [['/', 'Hlavní stránka'], ['/jidelnicek', 'Jídelníček']]) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const p = await ctx.newPage();
  await p.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await p.waitForTimeout(800);
  await p.addScriptTag({ url: 'http://localhost:9999/axe.js' });
  await p.waitForTimeout(300);

  const violations = await p.evaluate(async () => {
    const results = await window.axe.run(document, {
      runOnly: { type: 'rule', values: ['color-contrast'] }
    });
    return results.violations.flatMap(v =>
      v.nodes.map(n => ({
        html: n.html?.slice(0, 100),
        summary: n.failureSummary?.slice(0, 150),
        target: n.target?.[0],
      }))
    );
  });

  console.log(`\n${label} — kontrast porušení (${violations.length}):`);
  violations.forEach((v, i) => {
    console.log(`  ${i+1}. ${v.html}`);
    console.log(`     ${v.summary}`);
  });

  await ctx.close();
}

await browser.close();
server.close();
