import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthSession, CurrentUser } from './auth-session';
import { redirectIfSignedIn, requireAdmin } from './auth.guard';

const ME = '/api/v1/auth/me';

/** Stands in for every page: these tests are about where navigation ends up, not what renders there. */
@Component({ template: '' })
class Page {}

describe('auth guards', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let router: Router;

  const admin: CurrentUser = { email: 'admin@example.com', role: 'ADMIN' };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // The same shape as the real admin routes: login beside the guarded area, not inside it.
        provideRouter([
          { path: '', component: Page },
          { path: 'admin/login', component: Page, canActivate: [redirectIfSignedIn] },
          {
            path: 'admin',
            canActivateChild: [requireAdmin],
            children: [
              { path: 'projects', component: Page },
              { path: 'contact', component: Page },
            ],
          },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => http.verify());

  /** Navigates, answering the /me request the guard makes; omit `me` when no request is expected. */
  async function navigate(
    url: string,
    me?: { body: CurrentUser | null; status: number; statusText: string },
  ): Promise<void> {
    const navigation = harness.navigateByUrl(url);
    if (me) {
      // The guard sends /me after the navigation starts, so wait for the request rather than expecting it at once.
      const request = await vi.waitFor(() => http.expectOne({ method: 'GET', url: ME }));
      request.flush(me.body, { status: me.status, statusText: me.statusText });
    }
    await navigation;
  }

  const SIGNED_IN = { body: admin, status: 200, statusText: 'OK' };
  const SIGNED_OUT = { body: null, status: 401, statusText: 'Unauthorized' };
  const ME_FAILS = { body: null, status: 500, statusText: 'Server Error' };

  function path(): string {
    return (
      router
        .parseUrl(router.url)
        .root.children['primary']?.segments.map((s) => s.path)
        .join('/') ?? ''
    );
  }

  function returnUrl(): string | undefined {
    return router.parseUrl(router.url).queryParams['returnUrl'];
  }

  describe('requireAdmin', () => {
    it('sends a signed-out visitor to the login page, remembering the page and its query', async () => {
      await navigate('/admin/contact?tab=unread', SIGNED_OUT);

      expect(path()).toBe('admin/login');
      expect(returnUrl()).toBe('/admin/contact?tab=unread');
      expect(router.url).toBe('/admin/login?returnUrl=%2Fadmin%2Fcontact%3Ftab%3Dunread');
    });

    it('lets a signed-in admin through', async () => {
      await navigate('/admin/contact', SIGNED_IN);

      expect(router.url).toBe('/admin/contact');
    });

    it('fails closed when the session cannot be checked', async () => {
      const navigation = harness.navigateByUrl('/admin/contact');
      // requireAdmin asks /me (500, not remembered), then redirectIfSignedIn on the login page asks again.
      (await vi.waitFor(() => http.expectOne(ME))).flush(null, {
        status: 500,
        statusText: 'Server Error',
      });
      (await vi.waitFor(() => http.expectOne(ME))).flush(null, {
        status: 500,
        statusText: 'Server Error',
      });
      await navigation;

      expect(path()).toBe('admin/login');
      expect(returnUrl()).toBe('/admin/contact');
    });

    it('checks with the server once, then moves between admin pages without asking again', async () => {
      await navigate('/admin/contact', SIGNED_IN);

      await navigate('/admin/projects');

      http.expectNone(ME);
      expect(router.url).toBe('/admin/projects');
    });

    it('catches a session that ended mid-visit on the next admin navigation', async () => {
      await navigate('/admin/contact', SIGNED_IN);
      TestBed.inject(AuthSession).clear();

      await navigate('/admin/projects');

      http.expectNone(ME);
      expect(path()).toBe('admin/login');
      expect(returnUrl()).toBe('/admin/projects');
    });

    it('leaves public pages alone', async () => {
      await navigate('/');

      http.expectNone(ME);
      expect(router.url).toBe('/');
    });
  });

  describe('redirectIfSignedIn', () => {
    it('shows the login page to a signed-out visitor', async () => {
      await navigate('/admin/login?returnUrl=%2Fadmin%2Fcontact', SIGNED_OUT);

      expect(path()).toBe('admin/login');
      expect(returnUrl()).toBe('/admin/contact');
    });

    it('shows the login page when the session cannot be checked', async () => {
      await navigate('/admin/login', ME_FAILS);

      expect(router.url).toBe('/admin/login');
    });

    it('sends a signed-in admin on to the projects page by default', async () => {
      await navigate('/admin/login', SIGNED_IN);

      expect(router.url).toBe('/admin/projects');
    });

    it('sends a signed-in admin on to a safe return page', async () => {
      await navigate('/admin/login?returnUrl=%2Fadmin%2Fcontact', SIGNED_IN);

      expect(router.url).toBe('/admin/contact');
    });

    it.each([
      ['a protocol-relative URL', '//evil.example/admin/'],
      ['a public page', '/projects'],
      ['the login page itself', '/admin/login'],
    ])('ignores %s as a return page', async (_case, unsafe) => {
      await navigate(`/admin/login?returnUrl=${encodeURIComponent(unsafe)}`, SIGNED_IN);

      expect(router.url).toBe('/admin/projects');
    });
  });
});
