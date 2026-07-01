const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }]
  ],
  timeout: 90000,
  expect: { timeout: 20000 },
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  }
});
