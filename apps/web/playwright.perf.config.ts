import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const isCI = process.env['CI'] !== undefined;

/**
 * The browser measurements of the performance budgets
 * (docs/architecture/engine/quality.md#what-eng-15-decided), against the production build served
 * by `vite preview`: one test at a time, so that no other test shares the machine, and no retry,
 * so that a failed check is never hidden. Each test writes its measurement to perf-results/.
 */
export default defineConfig({
  testDir: './tests/perf',
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  retries: 0,
  reporter: 'list',
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
