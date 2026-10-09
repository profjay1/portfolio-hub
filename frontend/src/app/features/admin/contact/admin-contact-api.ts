import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export const ADMIN_CONTACT_URL = '/api/v1/admin/contact';

/**
 * Writes to the admin contact API; the inbox is read through httpResource in the component. Relative URL keeps the
 * request same-origin, so HttpClient attaches the X-XSRF-TOKEN header the backend requires (ADR 0006).
 */
@Injectable({ providedIn: 'root' })
export class AdminContactApi {
  private readonly http = inject(HttpClient);

  /** Idempotent on the server: marking an already-read message again is a 204, not an error. */
  markRead(id: number): Observable<void> {
    return this.http.patch<void>(`${ADMIN_CONTACT_URL}/${id}/read`, null);
  }
}
