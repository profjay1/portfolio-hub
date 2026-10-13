import { Component, PendingTasks, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthSession } from '../../core/auth/auth-session';
import { LOGIN_PATH } from '../../core/auth/auth.guard';

interface AdminLink {
  readonly path: string;
  readonly label: string;
}

const SIGN_OUT_FAILED = "Couldn't sign out. Please try again.";

/**
 * Shell for every admin screen. Each admin area adds a link here and a child route in admin.routes.ts, where the
 * route guard keeps it to signed-in admins. Also shows who is signed in and offers sign-out.
 */
@Component({
  selector: 'app-admin-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-layout.html',
  styleUrls: ['./admin-shared.css', './admin-layout.css'],
})
export class AdminLayout {
  private readonly session = inject(AuthSession);
  private readonly router = inject(Router);
  private readonly pendingTasks = inject(PendingTasks);

  protected readonly links: readonly AdminLink[] = [
    { path: '/admin/projects', label: 'Projects' },
    { path: '/admin/resume', label: 'Resume' },
    { path: '/admin/contact', label: 'Contact' },
  ];

  /** Always known inside the guarded area: the guard loaded the session before this layout rendered. */
  protected readonly email = computed(() => this.session.user()?.email ?? null);
  protected readonly signingOut = signal(false);
  protected readonly signOutError = signal<string | null>(null);

  protected async signOut(): Promise<void> {
    this.signOutError.set(null);
    // Zoneless Angular cannot see this promise chain; registering it keeps the app "unstable" until the outcome is
    // rendered, which is what tests (whenStable) and, later, SSR wait for. Same pattern as the admin screens.
    const done = this.pendingTasks.add();
    this.signingOut.set(true);
    try {
      await this.session.logout();
    } catch {
      // AuthSession has kept the session (the cookie is still valid), so the admin stays here and can retry.
      this.signOutError.set(SIGN_OUT_FAILED);
      return;
    } finally {
      this.signingOut.set(false);
      done();
    }
    // Outside the try: a navigation problem must not be reported as a failed sign-out, because the sign-out worked.
    await this.router.navigate([LOGIN_PATH], { queryParams: { signedOut: 1 } });
  }
}
