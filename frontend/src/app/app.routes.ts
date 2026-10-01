import { Routes } from '@angular/router';
import { About } from './features/public/about/about';
import { Contact } from './features/public/contact/contact';
import { Home } from './features/public/home/home';
import { Projects } from './features/public/projects/projects';
import { Resume } from './features/public/resume/resume';
import { Skills } from './features/public/skills/skills';
import { Layout } from './shared/layout/layout';

const SITE = 'Saheed Omotola';

export const routes: Routes = [
  {
    // Public pages are eager: they are the first thing a visitor sees and are small.
    path: '',
    component: Layout,
    children: [
      { path: '', component: Home, title: `${SITE} · Software Engineer` },
      { path: 'about', component: About, title: `About · ${SITE}` },
      { path: 'skills', component: Skills, title: `Skills · ${SITE}` },
      { path: 'projects', component: Projects, title: `Projects · ${SITE}` },
      { path: 'resume', component: Resume, title: `Resume · ${SITE}` },
      { path: 'contact', component: Contact, title: `Contact · ${SITE}` },
    ],
  },
  {
    // Lazy so visitors never download admin code. The auth guard arrives with the login slice.
    path: 'admin',
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.adminRoutes),
  },
  { path: '**', redirectTo: '' },
];
