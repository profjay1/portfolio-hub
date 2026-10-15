import { Cookie, expect, test } from '@playwright/test';

const SESSION_COOKIE = '__Host-hub_session';
const XSRF_COOKIE = 'XSRF-TOKEN';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set to the credentials the stack was started with`);
  }
  return value;
}

function find(cookies: Cookie[], name: string): Cookie | undefined {
  return cookies.find((cookie) => cookie.name === name);
}

/**
 * The admin session end to end, in a real browser against the real stack. What the stubbed admin-auth spec cannot
 * show: the backend's cookies survive the proxy with their attributes intact, the browser echoes the XSRF cookie
 * as a header on the same-origin login, and signing out really ends the session on the server.
 */
test('admin signs in through the real form and the session lives only in the expected cookies', async ({
  page,
  context,
  baseURL,
}) => {
  const email = requiredEnv('HUB_ADMIN_EMAIL');
  const password = requiredEnv('HUB_ADMIN_PASSWORD');
  const host = new URL(baseURL ?? '').hostname;

  await page.goto('/admin/login');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sign in');

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  const loginRequest = page.waitForRequest('**/api/v1/auth/login');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL('/admin/projects');
  await expect(page.getByRole('banner')).toContainText(`Signed in as ${email}`);

  const cookies = await context.cookies();
  const session = find(cookies, SESSION_COOKIE);
  const xsrf = find(cookies, XSRF_COOKIE);

  // The session: unreadable by scripts, HTTPS-only, never sent cross-site, host-only (the __Host- prefix rules).
  expect(session).toMatchObject({
    domain: host,
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
  });
  // Persistent with the backend's one-hour lifetime, not a browser-session cookie.
  const nowSeconds = Date.now() / 1000;
  expect(session?.expires).toBeGreaterThan(nowSeconds + 3500);
  expect(session?.expires).toBeLessThanOrEqual(nowSeconds + 3600 + 60);

  // The CSRF token: readable by the app on purpose (HttpOnly would defeat the double submit), host-only.
  expect(xsrf).toMatchObject({ domain: host, path: '/', httpOnly: false });
  // The browser sent the double submit: the header the app copied from the cookie matched it.
  expect((await loginRequest).headers()['x-xsrf-token']).toBe(xsrf?.value);

  // Signing out clears the session cookie, and the server no longer recognises the browser.
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('/admin/login?signedOut=1');
  expect(find(await context.cookies(), SESSION_COOKIE)).toBeUndefined();
  expect((await page.request.get('/api/v1/auth/me')).status()).toBe(401);
});
