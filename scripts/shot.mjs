// Screenshots the running app at phone size: node scripts/shot.mjs <url> <out.png> [width] [height]
// Example: npx vite --port 5199 & node scripts/shot.mjs 'http://localhost:5199/#/dial' /tmp/dial.png
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const root = join(homedir(), '.cache/ms-playwright');
const dir = readdirSync(root).filter((d) => d.startsWith('chromium_headless_shell-')).sort().pop();
const sub = readdirSync(join(root, dir)).find((d) => d.startsWith('chrome-'));
const executablePath = join(root, dir, sub, 'chrome-headless-shell');

const [url, out, w = '390', h = '844'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.screenshot({ path: out });
await browser.close();
if (errors.length) console.log('page errors:\n' + errors.join('\n'));
console.log('saved', out);
