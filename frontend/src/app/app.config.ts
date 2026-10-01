import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // Fetch backend keeps the client ready for SSR later; requests stay relative (same-origin) so the
    // XSRF cookie is echoed automatically (ADR 0006).
    provideHttpClient(withFetch()),
  ],
};
