import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const isCI = process.env['CI'] !== undefined;

/** End-to-end tests run against the production build served by `vite preview`. */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${String(PORT)}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port ${String(PORT)}`,
    url: `http://127.0.0.1:${String(PORT)}`,
    reuseExistingServer: !isCI,
    timeout: 60_000,
  },
});
