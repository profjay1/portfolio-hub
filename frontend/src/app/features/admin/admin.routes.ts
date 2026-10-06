import { Routes } from '@angular/router';
import { AdminLayout } from './admin-layout';
import { AdminProjects } from './projects/admin-projects';
import { AdminResume } from './resume/admin-resume';

/**
 * Loaded lazily from app.routes.ts, so everything here stays out of the public bundle. Later admin areas (contact
 * messages) become siblings of `projects` and `resume`. No guard yet: it arrives with the login slice.
 */
export const adminRoutes: Routes = [
  {
    path: '',
    component: AdminLayout,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'projects' },
      { path: 'projects', component: AdminProjects, title: 'Projects · Admin' },
      { path: 'resume', component: AdminResume, title: 'Resume · Admin' },
    ],
  },
];
