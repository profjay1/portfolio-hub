import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthSession, CurrentUser } from '../../core/auth/auth-session';
import { AdminLayout } from './admin-layout';

const ME = '/api/v1/auth/me';
const LOGOUT = '/api/v1/auth/logout';

describe('AdminLayout', () => {
  let fixture: ComponentFixture<AdminLayout>;
  let http: HttpTestingController;
  let session: AuthSession;
  let navigate: ReturnType<typeof vi.spyOn>;

  const admin: CurrentUser = { email: 'admin@example.com', role: 'ADMIN' };

  /** Renders the layout as the guard leaves it: with the session already loaded. */
  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(AuthSession);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const loaded = session.ensureLoaded();
    http.expectOne(ME).flush(admin);
    await loaded;
    fixture = TestBed.createComponent(AdminLayout);
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function squash(value: string | null | undefined): string {
    return value?.replace(/\s+/g, ' ').trim() ?? '';
  }

  function signOutButton(): HTMLButtonElement {
    const button = host().querySelector<HTMLButtonElement>('header button');
    if (!button) {
      throw new Error('No sign-out button');
    }
    return button;
  }

  function alertText(): string {
    return squash(host().querySelector('[role="alert"]')?.textContent);
  }

  /** Clicks Sign out without waiting for stability: a request in flight keeps the app unstable on purpose. */
  function signOut(): TestRequest {
    signOutButton().click();
    fixture.detectChanges();
    return http.expectOne({ method: 'POST', url: LOGOUT });
  }

  it('links to each admin area from the admin nav', () => {
    const links = Array.from(
      host().querySelectorAll<HTMLAnchorElement>('nav[aria-label="Admin"] a'),
    ).map((a) => [a.textContent?.trim(), a.getAttribute('href')]);

    expect(links).toEqual([
      ['Projects', '/admin/projects'],
      ['Resume', '/admin/resume'],
      ['Contact', '/admin/contact'],
    ]);
  });

  it('offers a way back to the public site', () => {
    const back = Array.from(host().querySelectorAll<HTMLAnchorElement>('header a')).find(
      (a) => a.textContent?.trim() === 'View site',
    );
    expect(back?.getAttribute('href')).toBe('/');
  });

  it('renders admin pages inside a main landmark', () => {
    expect(host().querySelector('main#main router-outlet')).not.toBeNull();
  });

  it('shows who is signed in', () => {
    expect(squash(host().querySelector('header .signed-in')?.textContent)).toBe(
      'Signed in as admin@example.com',
    );
  });

  it('signs out, then goes to the sign-in page saying so', async () => {
    const request = signOut();
    expect(request.request.body).toBeNull();
    expect(squash(signOutButton().textContent)).toBe('Signing out…');
    expect(signOutButton().disabled).toBe(true);

    // Exactly what the backend answers: 204 with no body.
    request.flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(session.user()).toBeNull();
    expect(navigate).toHaveBeenCalledExactlyOnceWith(['/admin/login'], {
      queryParams: { signedOut: 1 },
    });
    expect(alertText()).toBe('');
  });

  it.each([
    [
      'the server fails',
      (r: TestRequest) => r.flush(null, { status: 500, statusText: 'Server Error' }),
    ],
    ['the network is down', (r: TestRequest) => r.error(new ProgressEvent('error'))],
  ])('stays signed in and says so when %s', async (_case, fail) => {
    fail(signOut());
    await fixture.whenStable();

    expect(alertText()).toBe("Couldn't sign out. Please try again.");
    expect(session.user()).toEqual(admin);
    expect(squash(host().querySelector('header .signed-in')?.textContent)).toBe(
      'Signed in as admin@example.com',
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(squash(signOutButton().textContent)).toBe('Sign out');
    expect(signOutButton().disabled).toBe(false);
  });

  it('clears the earlier error when the admin tries again', async () => {
    signOut().flush(null, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    expect(alertText()).toBe("Couldn't sign out. Please try again.");

    const retry = signOut();
    expect(alertText()).toBe('');

    retry.flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledOnce();
  });
});
