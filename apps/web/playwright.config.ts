import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const isCI = process.env['CI'] !== undefined;
/** The visual baselines are Linux images, made and compared where CI renders them. */
const isLinux = process.platform === 'linux';

/** End-to-end tests run against the production build served by `vite preview`. */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  // The visual baselines (ADR 0012, decision 17; docs/architecture/engine/quality.md#visual-baselines):
  // captures with every animation finished and no caret, at one image pixel per CSS pixel unless a
  // test asks for the device's, compared at Playwright's default threshold with no differing pixel
  // allowed. Only CI's generation run writes a baseline, by `--update-snapshots=all`; any other run
  // compares, and off Linux the visual assertions neither compare nor write.
  expect: { toHaveScreenshot: { animations: 'disabled', caret: 'hide', scale: 'css' } },
  updateSnapshots: 'none',
  ignoreSnapshots: !isLinux,
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
