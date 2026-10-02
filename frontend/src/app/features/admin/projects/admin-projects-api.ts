import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export const ADMIN_PROJECTS_URL = '/api/v1/admin/projects';

/**
 * Writes to the admin projects API. Reads go through httpResource in the component instead. Relative URLs keep
 * requests same-origin, so HttpClient attaches the X-XSRF-TOKEN header the backend requires (ADR 0006).
 */
@Injectable({ providedIn: 'root' })
export class AdminProjectsApi {
  private readonly http = inject(HttpClient);

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${ADMIN_PROJECTS_URL}/${id}`);
  }
}
