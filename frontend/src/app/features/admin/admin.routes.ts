import { Routes } from '@angular/router';
import { AdminLayout } from './admin-layout';
import { AdminProjects } from './projects/admin-projects';

/**
 * Loaded lazily from app.routes.ts, so everything here stays out of the public bundle. Later admin areas (resume,
 * contact messages) become siblings of `projects`. No guard yet: it arrives with the login slice.
 */
export const adminRoutes: Routes = [
  {
    path: '',
    component: AdminLayout,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'projects' },
      { path: 'projects', component: AdminProjects, title: 'Projects · Admin' },
    ],
  },
];
