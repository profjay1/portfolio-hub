import {
  HttpClient,
  HttpErrorResponse,
  HttpXsrfTokenExtractor,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { csrfRetryInterceptor } from './csrf-retry.interceptor';

/** Stands in for the XSRF-TOKEN cookie: empty on a cold visit, set by the backend's 403. */
class FakeCookieJar extends HttpXsrfTokenExtractor {
  token: string | null = null;

  getToken(): string | null {
    return this.token;
  }
}

const CSRF_REJECTION = { status: 403, code: 'invalid-csrf-token' };

describe('csrfRetryInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let cookies: FakeCookieJar;

  beforeEach(() => {
    cookies = new FakeCookieJar();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([csrfRetryInterceptor])),
        provideHttpClientTesting(),
        { provide: HttpXsrfTokenExtractor, useValue: cookies },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  /** The backend's answer to a missing token: 403, and a fresh cookie on the same response. */
  function rejectForCsrfAndIssueCookie(token = 'fresh-token'): void {
    const first = backend.expectOne('/api/v1/contact');
    expect(first.request.headers.has('X-XSRF-TOKEN')).toBe(false);
    cookies.token = token;
    first.flush(CSRF_REJECTION, { status: 403, statusText: 'Forbidden' });
  }

  it('retries a cold-visit POST once with the token the 403 just issued', async () => {
    const result = firstValueFrom(http.post('/api/v1/contact', { name: 'Ada' }));

    rejectForCsrfAndIssueCookie();
    const retry = backend.expectOne('/api/v1/contact');
    expect(retry.request.headers.get('X-XSRF-TOKEN')).toBe('fresh-token');
    expect(retry.request.body).toEqual({ name: 'Ada' });
    retry.flush(null, { status: 202, statusText: 'Accepted' });

    await expect(result).resolves.toBeNull();
  });

  it('gives up after one retry so a persistent CSRF failure reaches the caller', async () => {
    const result = firstValueFrom(http.post('/api/v1/contact', {}));

    rejectForCsrfAndIssueCookie();
    backend
      .expectOne('/api/v1/contact')
      .flush(CSRF_REJECTION, { status: 403, statusText: 'Forbidden' });

    await expect(result).rejects.toMatchObject({ status: 403 });
    backend.expectNone('/api/v1/contact');
  });

  it('does not retry a 403 that is a real permission problem', async () => {
    const result = firstValueFrom(http.post('/api/v1/contact', {}));

    backend
      .expectOne('/api/v1/contact')
      .flush({ status: 403, code: 'forbidden' }, { status: 403, statusText: 'Forbidden' });

    await expect(result).rejects.toBeInstanceOf(HttpErrorResponse);
    backend.expectNone('/api/v1/contact');
  });

  it('does not retry safe requests, which are never CSRF-checked', async () => {
    cookies.token = 'fresh-token';
    const result = firstValueFrom(http.get('/api/v1/contact'));

    backend
      .expectOne('/api/v1/contact')
      .flush(CSRF_REJECTION, { status: 403, statusText: 'Forbidden' });

    await expect(result).rejects.toMatchObject({ status: 403 });
    backend.expectNone('/api/v1/contact');
  });

  it('never sends the token to another origin', async () => {
    cookies.token = 'fresh-token';
    const url = 'https://other.example/api';
    const result = firstValueFrom(http.post(url, {}));

    backend.expectOne(url).flush(CSRF_REJECTION, { status: 403, statusText: 'Forbidden' });

    await expect(result).rejects.toMatchObject({ status: 403 });
    backend.expectNone(url);
  });

  it('surfaces the original error when the 403 did not leave a token to retry with', async () => {
    const result = firstValueFrom(http.post('/api/v1/contact', {}));

    backend
      .expectOne('/api/v1/contact')
      .flush(CSRF_REJECTION, { status: 403, statusText: 'Forbidden' });

    await expect(result).rejects.toMatchObject({ status: 403 });
    backend.expectNone('/api/v1/contact');
  });

  it('passes other failures through untouched', async () => {
    const result = firstValueFrom(http.post('/api/v1/contact', {}));

    backend.expectOne('/api/v1/contact').flush(null, { status: 500, statusText: 'Server Error' });

    await expect(result).rejects.toMatchObject({ status: 500 });
  });
});
