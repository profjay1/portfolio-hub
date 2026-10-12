import {
  provideHttpClient,
  withInterceptors,
  withRequestsMadeViaParent,
} from '@angular/common/http';
import { Routes } from '@angular/router';
import { redirectIfSignedIn, requireAdmin } from '../../core/auth/auth.guard';
import { sessionExpiredInterceptor } from '../../core/auth/session-expired.interceptor';
import { AdminLayout } from './admin-layout';
import { AdminContact } from './contact/admin-contact';
import { AdminLogin } from './login/admin-login';
import { AdminProjects } from './projects/admin-projects';
import { AdminResume } from './resume/admin-resume';

/**
 * Loaded lazily from app.routes.ts, so everything here stays out of the public bundle. Each admin area is a child
 * route here and a link in AdminLayout. The login page sits beside AdminLayout, not inside it, so no admin navigation
 * shows before signing in.
 */
export const adminRoutes: Routes = [
  {
    path: 'login',
    component: AdminLogin,
    title: 'Sign in · Admin',
    canActivate: [redirectIfSignedIn],
  },
  {
    path: '',
    component: AdminLayout,
    // canActivateChild, not canActivate: it runs on every admin navigation, so a session that ended mid-visit is
    // caught on the next click. The session is cached, so this costs no requests.
    canActivateChild: [requireAdmin],
    providers: [
      // The admin screens get their own HttpClient that adds the expired-session check, then hands each request to
      // the app's client (CSRF retry, Fetch backend). Registering it here rather than in app.config keeps the
      // interceptor and AuthSession out of the public bundle, and keeps AuthSession's own /auth requests, which use
      // the app's client, from ever passing through it.
      provideHttpClient(withInterceptors([sessionExpiredInterceptor]), withRequestsMadeViaParent()),
    ],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'projects' },
      { path: 'projects', component: AdminProjects, title: 'Projects · Admin' },
      { path: 'resume', component: AdminResume, title: 'Resume · Admin' },
      { path: 'contact', component: AdminContact, title: 'Contact · Admin' },
    ],
  },
];
