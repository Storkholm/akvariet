// Renders public/icon.svg to the PNG sizes the manifest and iOS need. Usage: node scripts/render-icons.mjs
// (needs Chromium: set CHROMIUM_PATH, or it uses Playwright's own browser).
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8');
const sizes = { 'icon-192.png': 192, 'icon-512.png': 512, 'icon-maskable-512.png': 512, 'apple-touch-icon.png': 180 };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
for (const [file, size] of Object.entries(sizes)) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:#0b5aa6}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  writeFileSync(new URL(`../public/icons/${file}`, import.meta.url), await page.screenshot({ type: 'png' }));
}
await browser.close();
console.log('icons written');
