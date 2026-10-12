import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { AuthSession } from './auth-session';
import { safeReturnUrl } from './return-url';

export const LOGIN_PATH = '/admin/login';

/**
 * Lets only a signed-in admin into the admin area; everyone else goes to the login page, which brings them back here
 * afterwards. Used as canActivateChild on the AdminLayout route, so it runs on every admin navigation, not only on
 * entering the area: the session is cached, so that costs no requests, and a session cleared mid-visit (expired, or
 * signed out) is caught on the next click.
 */
export const requireAdmin: CanActivateChildFn = async (_childRoute, state) => {
  // Both injected before the first await: inject() only works synchronously inside the guard's injection context.
  const session = inject(AuthSession);
  const router = inject(Router);
  const user = await session.ensureLoaded();
  if (user?.role === 'ADMIN') {
    return true;
  }
  // state.url is the page being opened, query string included, so /admin/contact?tab=unread survives the detour.
  return router.createUrlTree([LOGIN_PATH], { queryParams: { returnUrl: state.url } });
};

/**
 * On the login route: an admin who is already signed in has nothing to do there, so they go straight on, to the same
 * place a fresh sign-in would take them. Anyone else (including when /me failed) sees the login page.
 */
export const redirectIfSignedIn: CanActivateFn = async (route) => {
  const session = inject(AuthSession);
  const router = inject(Router);
  const user = await session.ensureLoaded();
  if (user?.role === 'ADMIN') {
    return router.parseUrl(safeReturnUrl(route.queryParamMap.get('returnUrl')));
  }
  return true;
};
