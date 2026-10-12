import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { firstValueFrom } from 'rxjs';
import { AuthSession, CurrentUser } from './auth-session';
import { sessionExpiredInterceptor } from './session-expired.interceptor';

const ME = '/api/v1/auth/me';
const ADMIN_CONTACT = '/api/v1/admin/contact';
const CURRENT_PAGE = '/admin/contact?tab=unread';

/** Stands in for every page: these tests are about where navigation ends up, not what renders there. */
@Component({ template: '' })
class Page {}

describe('sessionExpiredInterceptor', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let client: HttpClient;
  let router: Router;
  let session: AuthSession;

  const admin: CurrentUser = { email: 'admin@example.com', role: 'ADMIN' };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        // Registered app-wide here on purpose, so AuthSession's own /auth requests pass through it too: that is what
        // proves the path check, not just the admin-only registration, keeps them out.
        provideHttpClient(withInterceptors([sessionExpiredInterceptor])),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'admin/contact', component: Page },
          { path: 'admin/login', component: Page },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
    router = TestBed.inject(Router);
    session = TestBed.inject(AuthSession);
    harness = await RouterTestingHarness.create(CURRENT_PAGE);
  });

  afterEach(() => http.verify());

  async function signIn(): Promise<void> {
    const loaded = session.ensureLoaded();
    http.expectOne(ME).flush(admin);
    await loaded;
  }

  /** Sends a request and settles with whatever it ends in, so a test can inspect an error without try/catch. */
  function send(method: string, url: string): Promise<unknown> {
    return firstValueFrom(client.request(method, url)).catch((error: unknown) => error);
  }

  async function settle(): Promise<void> {
    await harness.fixture.whenStable();
  }

  it('sends the admin to sign in, back to the current page, when an admin request answers 401', async () => {
    await signIn();

    const result = send('GET', ADMIN_CONTACT);
    http.expectOne(ADMIN_CONTACT).flush(null, { status: 401, statusText: 'Unauthorized' });
    await settle();

    expect(session.user()).toBeNull();
    expect(router.url).toBe('/admin/login?returnUrl=%2Fadmin%2Fcontact%3Ftab%3Dunread');
    // The caller still gets the error, so the screen can say why for the moment before navigation.
    expect(await result).toMatchObject({ status: 401 });
  });

  it('redirects once when several admin requests fail together', async () => {
    await signIn();
    const navigate = vi.spyOn(router, 'navigate');

    const first = send('GET', ADMIN_CONTACT);
    const second = send('GET', '/api/v1/admin/projects');
    http.expectOne(ADMIN_CONTACT).flush(null, { status: 401, statusText: 'Unauthorized' });
    http
      .expectOne('/api/v1/admin/projects')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    await settle();

    expect(navigate).toHaveBeenCalledOnce();
    expect(await first).toMatchObject({ status: 401 });
    expect(await second).toMatchObject({ status: 401 });
  });

  it.each([
    ['a wrong password at sign-in', 'POST', '/api/v1/auth/login'],
    ['the "not signed in" answer from /me', 'GET', ME],
    ['a public endpoint', 'GET', '/api/v1/projects'],
  ])('ignores a 401 from %s', async (_case, method, url) => {
    await signIn();

    const result = send(method, url);
    http.expectOne(url).flush(null, { status: 401, statusText: 'Unauthorized' });
    await settle();

    expect(session.user()).toEqual(admin);
    expect(router.url).toBe(CURRENT_PAGE);
    expect(await result).toMatchObject({ status: 401 });
  });

  it.each([
    [403, 'Forbidden'],
    [500, 'Server Error'],
  ])('ignores a %i from the admin API', async (status, statusText) => {
    await signIn();

    const result = send('GET', ADMIN_CONTACT);
    http.expectOne(ADMIN_CONTACT).flush(null, { status, statusText });
    await settle();

    expect(session.user()).toEqual(admin);
    expect(router.url).toBe(CURRENT_PAGE);
    expect(await result).toMatchObject({ status });
  });

  it('passes successful admin responses through untouched', async () => {
    await signIn();

    const result = send('GET', ADMIN_CONTACT);
    http.expectOne(ADMIN_CONTACT).flush([]);
    await settle();

    expect(await result).toEqual([]);
    expect(session.user()).toEqual(admin);
    expect(router.url).toBe(CURRENT_PAGE);
  });
});
