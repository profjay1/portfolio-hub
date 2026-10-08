import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
  HttpXsrfTokenExtractor,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

/** Must match the backend's CookieCsrfTokenRepository and Angular's default XSRF header (ADR 0006). */
const XSRF_HEADER = 'X-XSRF-TOKEN';

const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']);

/** Only same-origin (relative) URLs ever carry the token, mirroring Angular's own XSRF interceptor. */
function isUnsafeSameOrigin(request: HttpRequest<unknown>): boolean {
  return !SAFE_METHODS.has(request.method) && !/^[a-z][a-z\d+.-]*:\/\//i.test(request.url);
}

function isCsrfRejection(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse) || error.status !== 403) {
    return false;
  }
  const body: unknown = error.error;
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as { code?: unknown }).code === 'invalid-csrf-token'
  );
}

/**
 * The backend issues the XSRF-TOKEN cookie on API responses, so a visitor who lands straight on a page that POSTs
 * (the contact form, later the login form) has no token for that first request and gets 403 invalid-csrf-token. That
 * 403 sets a fresh cookie, so retrying once succeeds. The token is set here explicitly because the retry does not pass
 * back through Angular's XSRF interceptor. Exactly one retry: a second CSRF failure is a real problem and surfaces.
 */
export const csrfRetryInterceptor: HttpInterceptorFn = (request, next) => {
  const tokens = inject(HttpXsrfTokenExtractor);
  return next(request).pipe(
    catchError((error: unknown) => {
      if (!isUnsafeSameOrigin(request) || !isCsrfRejection(error)) {
        return throwError(() => error);
      }
      const token = tokens.getToken();
      if (token === null) {
        return throwError(() => error);
      }
      return next(request.clone({ setHeaders: { [XSRF_HEADER]: token } }));
    }),
  );
};
