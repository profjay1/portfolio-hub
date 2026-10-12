import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthSession } from './auth-session';
import { LOGIN_PATH } from './auth.guard';

const ADMIN_API = '/api/v1/admin/';

/**
 * Inside the guarded admin area, a 401 from the admin API can only mean the session ended (the 1-hour token expired,
 * ADR 0006). Forget the user and send them to sign in, coming back to the page they were on.
 *
 * Only /api/v1/admin/ counts. A 401 from /api/v1/auth/login is a wrong password, and one from /api/v1/auth/me is the
 * ordinary "not signed in" answer; treating either as an expired session would be wrong. The admin routes register
 * this on their own HttpClient (withRequestsMadeViaParent), so AuthSession's requests never pass through it; the path
 * check is the second line of defence, and what keeps it correct if it is ever registered app-wide.
 *
 * The error still reaches the caller, whose screen shows "Your session has ended" for the moment before navigation.
 */
export const sessionExpiredInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(AuthSession);
  const router = inject(Router);
  return next(request).pipe(
    catchError((error: unknown) => {
      const expired =
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        request.url.startsWith(ADMIN_API);
      // Already null means an earlier 401 has handled it: parallel requests failing together redirect once.
      if (expired && session.user() !== null) {
        session.clear();
        void router.navigate([LOGIN_PATH], { queryParams: { returnUrl: router.url } });
      }
      return throwError(() => error);
    }),
  );
};
