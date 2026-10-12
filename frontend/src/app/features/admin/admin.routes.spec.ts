import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthSession, CurrentUser } from '../../core/auth/auth-session';
import { redirectIfSignedIn, requireAdmin } from '../../core/auth/auth.guard';
import { adminRoutes } from './admin.routes';

const ME = '/api/v1/auth/me';
const ADMIN_PROJECTS = '/api/v1/admin/projects';

/**
 * The real admin routes, mounted under /admin as app.routes.ts mounts them, with the real screens. The guards and the
 * interceptor have their own specs; these tests prove they are attached where the admin area actually uses them.
 */
describe('adminRoutes', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let router: Router;
  let session: AuthSession;

  const admin: CurrentUser = { email: 'admin@example.com', role: 'ADMIN' };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'admin', children: adminRoutes }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    session = TestBed.inject(AuthSession);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => http.verify());

  /** Navigates, answering the guard's /me request when one is expected. */
  async function navigate(url: string, me?: CurrentUser | null): Promise<void> {
    const navigation = harness.navigateByUrl(url);
    if (me !== undefined) {
      const request = await vi.waitFor(() => http.expectOne(ME));
      if (me === null) {
        request.flush(null, { status: 401, statusText: 'Unauthorized' });
      } else {
        request.flush(me);
      }
    }
    await navigation;
  }

  function heading(): string {
    return harness.routeNativeElement?.querySelector('h1')?.textContent?.trim() ?? '';
  }

  it('guards every admin page and leaves the login page reachable', () => {
    const login = adminRoutes.find((route) => route.path === 'login');
    const layout = adminRoutes.find((route) => route.path === '');

    expect(login?.canActivate).toEqual([redirectIfSignedIn]);
    expect(login?.canActivateChild).toBeUndefined();
    expect(layout?.canActivateChild).toEqual([requireAdmin]);
  });

  it('sends a signed-out visitor from an admin page to the sign-in page', async () => {
    await navigate('/admin/contact', null);

    expect(router.url).toBe('/admin/login?returnUrl=%2Fadmin%2Fcontact');
    expect(heading()).toBe('Sign in');
  });

  it('opens the admin area for a signed-in admin', async () => {
    await navigate('/admin', admin);

    expect(router.url).toBe('/admin/projects');
    http.expectOne(ADMIN_PROJECTS).flush([]);
    await harness.fixture.whenStable();
    expect(heading()).toBe('Projects');
  });

  it('sends the admin to sign in when an admin screen finds the session has expired', async () => {
    await navigate('/admin/projects', admin);

    // The projects screen's own request, through the admin routes' HttpClient and its interceptor.
    http.expectOne(ADMIN_PROJECTS).flush(null, { status: 401, statusText: 'Unauthorized' });
    await harness.fixture.whenStable();

    expect(session.user()).toBeNull();
    expect(router.url).toBe('/admin/login?returnUrl=%2Fadmin%2Fprojects');
    expect(heading()).toBe('Sign in');
  });

  it('keeps the expired-session check off the app-wide HttpClient', async () => {
    // Signed in, so a misplaced interceptor would have a session to clear (it ignores 401s once the session is null).
    await navigate('/admin/projects', admin);
    http.expectOne(ADMIN_PROJECTS).flush([]);
    await harness.fixture.whenStable();
    const routerNavigate = vi.spyOn(router, 'navigate');

    // A 401 on the app's own client, outside the admin layout's injector: nothing should react.
    TestBed.inject(HttpClient)
      .get(ADMIN_PROJECTS)
      .subscribe({ error: () => undefined });
    http.expectOne(ADMIN_PROJECTS).flush(null, { status: 401, statusText: 'Unauthorized' });
    await harness.fixture.whenStable();

    expect(routerNavigate).not.toHaveBeenCalled();
    expect(session.user()).toEqual(admin);
    expect(router.url).toBe('/admin/projects');
  });
});
