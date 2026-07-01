const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const EXTENSION_PATH = path.resolve(__dirname, '..');

async function createExtensionContext(headless = false) {
  const context = await chromium.launchPersistentContext('', {
    headless,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-web-security'
    ]
  });

  await context.waitForEvent('serviceworker', { timeout: 20000 });

  const sw = context.serviceWorkers[0];
  if (!sw) {
    throw new Error('Service Worker not found - extension may not have loaded correctly');
  }
  const url = new URL(sw.url());
  const extensionId = url.hostname;

  console.log(`[Setup] Extension ID: ${extensionId}`);
  console.log(`[Setup] SW URL: ${sw.url()}`);

  return { context, extensionId };
}

async function openPopupPage(context, extensionId) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`, {
    waitUntil: 'domcontentloaded'
  });
  await page.waitForTimeout(500);
  return page;
}

async function openOptionsPage(context, extensionId) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`, {
    waitUntil: 'domcontentloaded'
  });
  await page.waitForTimeout(500);
  return page;
}

function createTestHtml() {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>E2E Test</title></head>
<body style="padding:40px;font-family:sans-serif;">
  <h1>AI Translate E2E Test</h1>
  <p id="p1">Artificial intelligence is transforming technology interaction.</p>
  <p id="p2">Machine learning breakthroughs are helping solve challenges.</p>
  <p id="p3">Este es un texto en español para probar la traducción.</p>
  <p id="p4">这是一段中文测试文本，用于验证翻译功能。</p>
  <div id="target" style="margin-top:30px;padding:20px;border:1px solid #ccc;">
    <p><strong>Select this text to test the floating translate icon.</strong></p>
    <p>More text here for selection testing purposes.</p>
  </div>
  <div style="height:2000px"></div>
</body>
</html>`;
}

function readManifest() {
  const mp = path.resolve(EXTENSION_PATH, 'manifest.json');
  return JSON.parse(fs.readFileSync(mp, 'utf-8'));
}

function fileExists(...segments) {
  return fs.existsSync(path.resolve(EXTENSION_PATH, ...segments));
}

async function selectText(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }, selector);
}

module.exports = {
  EXTENSION_PATH,
  createExtensionContext,
  openPopupPage,
  openOptionsPage,
  createTestHtml,
  readManifest,
  fileExists,
  selectText
};
