/**
 * Playwright configuration for AI Translate Plugin E2E tests.
 *
 * Usage:
 *   npx playwright test --config=tests/playwright.config.js
 *   npx playwright test --config=tests/playwright.config.js --headed
 */
// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: 'e2e.spec.js',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    // Use MS Edge or Chromium — both support Chrome extension APIs
    channel: 'msedge',   // Use 'chromium' if you don't have Edge installed
    headless: false,      // Extensions require headed mode in many environments
    serviceWorkers: 'allow',
    permissions: ['clipboard-read', 'clipboard-write'],
    args: [
      `--disable-extensions-except=${__dirname}/..`,
      `--load-extension=${__dirname}/..`,
      '--disable-component-extensions-with-background-pages=false',
    ],
  },
  projects: [
    {
      name: 'extension-e2e',
      use: {
        browserName: 'chromium',
        channel: 'msedge',
      },
    },
  ],
  reporter: [
    ['list'],
    ['html', { outputFolder: 'test-report' }],
  ],
});
