import { Page, expect, test } from '@playwright/test';

const ADMIN = { email: 'admin@example.com', role: 'ADMIN' };
const PASSWORD = 'correct horse battery staple';

/**
 * The admin sign-in journey against a stubbed API. The real session is an HttpOnly cookie the stubs cannot create,
 * so a flag here plays the server's part: /me answers 401 until a correct sign-in, and again after sign-out. The
 * backend's own behaviour (cookie, CSRF, throttling) is covered by its AuthenticationFlowTests.
 */
test.describe('admin sign-in', () => {
  let signedIn: boolean;
  let logoutRequests: number;

  test.beforeEach(async ({ page }) => {
    signedIn = false;
    logoutRequests = 0;

    await page.route('**/api/v1/auth/me', (route) =>
      signedIn
        ? route.fulfill({ json: ADMIN })
        : route.fulfill({ status: 401, json: { status: 401, code: 'unauthorized' } }),
    );
    await page.route('**/api/v1/auth/login', (route) => {
      const { email, password } = route.request().postDataJSON() as {
        email: string;
        password: string;
      };
      if (email === ADMIN.email && password === PASSWORD) {
        signedIn = true;
        return route.fulfill({ json: ADMIN });
      }
      return route.fulfill({ status: 401, json: { status: 401, code: 'invalid-credentials' } });
    });
    await page.route('**/api/v1/auth/logout', (route) => {
      logoutRequests++;
      signedIn = false;
      // What the backend answers: 204 with no body.
      return route.fulfill({ status: 204 });
    });
    // The two admin screens this journey opens, both empty.
    await page.route('**/api/v1/admin/contact', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/v1/admin/projects', (route) => route.fulfill({ json: [] }));
  });

  function returnUrlOf(page: Page): string | null {
    return new URL(page.url()).searchParams.get('returnUrl');
  }

  async function signIn(page: Page, password: string): Promise<void> {
    await page.getByLabel('Email').fill(ADMIN.email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
  }

  test('admin signs in, lands where they were headed, and signs out', async ({ page }) => {
    // (a) A signed-out visitor asking for an admin page is sent to sign in, remembering the page.
    await page.goto('/admin/contact');
    await expect(page).toHaveURL('/admin/login?returnUrl=%2Fadmin%2Fcontact');
    expect(returnUrlOf(page)).toBe('/admin/contact');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sign in');

    // (b) A wrong password gets one message that names neither field, and nothing moves.
    await signIn(page, 'wrong password');
    await expect(page.getByRole('alert')).toHaveText('The email or password is incorrect.');
    expect(returnUrlOf(page)).toBe('/admin/contact');

    // (c) The right password goes back to the page that was asked for.
    await signIn(page, PASSWORD);
    await expect(page).toHaveURL('/admin/contact');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Contact messages');
    await expect(page.getByRole('banner')).toContainText('Signed in as admin@example.com');

    // (d) Signing out lands on the sign-in page, saying so.
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL('/admin/login?signedOut=1');
    await expect(page.getByRole('status')).toHaveText("You've signed out.");
    expect(logoutRequests).toBe(1);

    // And the session is really gone in the app, not just on screen: going Back to the admin page, an in-app
    // navigation without a reload, is stopped by the guard and sent to sign in again.
    await page.goBack();
    await expect(page).toHaveURL('/admin/login?returnUrl=%2Fadmin%2Fcontact');
    expect(returnUrlOf(page)).toBe('/admin/contact');
  });

  test('a hostile return address is ignored after signing in', async ({ page }) => {
    // (e) //evil.example could be read as another origin; signing in goes to the admin projects page instead.
    await page.goto('/admin/login?returnUrl=%2F%2Fevil.example');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sign in');

    await signIn(page, PASSWORD);

    await expect(page).toHaveURL('/admin/projects');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Projects');
  });
});
