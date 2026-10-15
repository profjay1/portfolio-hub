import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke tests against a running stack, with no API stubs: every request goes through the real proxy to the real
 * backend. Opt-in (`npm run e2e:stack`), not part of the regular e2e run, because they need the stack up first.
 *
 * HUB_STACK_URL picks the stack (default: the local Compose stack). HUB_ADMIN_EMAIL and HUB_ADMIN_PASSWORD must
 * be the admin credentials that stack was bootstrapped with.
 */
export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: process.env['HUB_STACK_URL'] ?? 'http://localhost:8081',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
