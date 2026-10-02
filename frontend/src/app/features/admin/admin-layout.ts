import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

interface AdminLink {
  readonly path: string;
  readonly label: string;
}

/**
 * Shell for every admin screen. Later admin areas (resume, contact messages) add a link here and a child route in
 * admin.routes.ts. Not guarded yet: the auth guard arrives with the login slice.
 */
@Component({
  selector: 'app-admin-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css',
})
export class AdminLayout {
  protected readonly links: readonly AdminLink[] = [{ path: '/admin/projects', label: 'Projects' }];
}
