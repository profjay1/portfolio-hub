import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthSession, CurrentUser } from './auth-session';

const ME = '/api/v1/auth/me';
const LOGIN = '/api/v1/auth/login';

describe('AuthSession', () => {
  let session: AuthSession;
  let http: HttpTestingController;

  const admin: CurrentUser = { email: 'admin@example.com', role: 'ADMIN' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    session = TestBed.inject(AuthSession);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('knows nothing until asked, and asks nothing on its own', () => {
    http.expectNone(ME);
    expect(session.user()).toBeUndefined();
    expect(session.isAdmin()).toBe(false);
  });

  it('asks the server who is signed in and remembers the answer', async () => {
    const loaded = session.ensureLoaded();
    http.expectOne({ method: 'GET', url: ME }).flush(admin);

    expect(await loaded).toEqual(admin);
    expect(session.user()).toEqual(admin);
    expect(session.isAdmin()).toBe(true);

    expect(await session.ensureLoaded()).toEqual(admin);
    http.expectNone(ME); // answered from memory
  });

  it('sends one request when several callers ask at once', async () => {
    const first = session.ensureLoaded();
    const second = session.ensureLoaded();

    http.expectOne(ME).flush(admin);

    expect(await first).toEqual(admin);
    expect(await second).toEqual(admin);
  });

  it('treats 401 as nobody signed in, and remembers that', async () => {
    const loaded = session.ensureLoaded();
    http.expectOne(ME).flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(await loaded).toBeNull();
    expect(session.user()).toBeNull();
    expect(session.isAdmin()).toBe(false);

    expect(await session.ensureLoaded()).toBeNull();
    http.expectNone(ME);
  });

  it('fails closed on other errors without remembering them, so the next check asks again', async () => {
    const loaded = session.ensureLoaded();
    http.expectOne(ME).flush(null, { status: 500, statusText: 'Server Error' });

    expect(await loaded).toBeNull();
    expect(session.user()).toBeUndefined();

    const retried = session.ensureLoaded();
    http.expectOne(ME).flush(admin);
    expect(await retried).toEqual(admin);
  });

  it('signs in and knows who signed in without another request', async () => {
    const signedIn = session.login({ email: 'admin@example.com', password: 'correct horse' });
    const request = http.expectOne({ method: 'POST', url: LOGIN });
    expect(request.request.body).toEqual({ email: 'admin@example.com', password: 'correct horse' });
    request.flush(admin);

    expect(await signedIn).toEqual(admin);
    expect(session.user()).toEqual(admin);
    expect(await session.ensureLoaded()).toEqual(admin);
    http.expectNone(ME);
  });

  it('lets a failed sign-in reach the caller and changes nothing', async () => {
    const signedIn = session.login({ email: 'admin@example.com', password: 'wrong' });
    http.expectOne(LOGIN).flush(null, { status: 401, statusText: 'Unauthorized' });

    await expect(signedIn).rejects.toMatchObject({ status: 401 });
    expect(session.user()).toBeUndefined();
  });

  it('keeps a sign-in that finished while an older /me answer was still on its way', async () => {
    const loaded = session.ensureLoaded();
    const meRequest = http.expectOne(ME);
    const signedIn = session.login({ email: 'admin@example.com', password: 'correct horse' });
    http.expectOne(LOGIN).flush(admin);
    await signedIn;

    meRequest.flush(null, { status: 401, statusText: 'Unauthorized' }); // sent before the sign-in

    expect(await loaded).toEqual(admin);
    expect(session.user()).toEqual(admin);
  });

  it('forgets the user when cleared', async () => {
    const loaded = session.ensureLoaded();
    http.expectOne(ME).flush(admin);
    await loaded;

    session.clear();

    expect(session.user()).toBeNull();
    expect(session.isAdmin()).toBe(false);
  });
});
