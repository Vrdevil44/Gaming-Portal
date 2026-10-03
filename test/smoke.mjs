// Scene 9 smoke: Hideout v2 — off-origin requests, console errors, 404s.
// Run: node smoke.mjs [baseUrl]
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://localhost:8901/';
const origin = new URL(base).origin;
const offOrigin = [], errors = [], bad = [];

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('requestfailed', r => bad.push('FAILED ' + r.url()));
page.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
page.on('request', r => { if (!r.url().startsWith(origin) && !r.url().startsWith('data:')) offOrigin.push(r.url()); });
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
page.on('pageerror', e => errors.push('PAGEERROR ' + String(e).slice(0, 120)));

await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

// open each game panel and close it
for (const id of ['hx-play-snake', 'hx-play-pong', 'hx-play-tetris', 'hx-play-breakout', 'hx-play-2048']) {
  const btn = await page.$(`#${id}`);
  if (!btn) { bad.push('MISSING BUTTON ' + id); continue; }
  await btn.click();
  await page.waitForTimeout(1200);
  const esc = await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
}
// quiz run: answer 5 questions with first options
const quizBtn = await page.$('#hx-quiz');
if (quizBtn) {
  await quizBtn.click();
  await page.waitForTimeout(600);
  for (let i = 0; i < 5; i++) {
    const opts = await page.$$('.hx-quiz-opt');
    if (!opts.length) break;
    await opts[0].click();
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(600);
  await page.keyboard.press('Escape');
}
// modal open/close
const join = await page.$('#myBtn');
if (join) { await join.click(); await page.waitForTimeout(800); await page.keyboard.press('Escape'); }

await browser.close();
console.log('off-origin requests:', offOrigin.length ? offOrigin : 'NONE');
console.log('console/page errors:', errors.length ? errors : 'NONE');
console.log('failed/4xx:', bad.length ? bad : 'NONE');
process.exit(offOrigin.length || errors.length || bad.length ? 1 : 0);
