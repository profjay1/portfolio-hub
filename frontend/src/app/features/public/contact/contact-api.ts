import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export const CONTACT_URL = '/api/v1/contact';

/**
 * Body of POST /api/v1/contact. Hand-typed until the OpenAPI client is generated into api/generated. `website` is the
 * honeypot: sent exactly as typed (normally empty) so the server alone decides what a filled one means.
 */
export interface ContactRequest {
  readonly name: string;
  readonly email: string;
  readonly message: string;
  readonly website: string;
}

/**
 * Sends contact messages. Relative URL keeps the request same-origin, so HttpClient attaches the X-XSRF-TOKEN header
 * the backend requires (ADR 0006), and a cold first visit is covered by the CSRF retry interceptor.
 */
@Injectable({ providedIn: 'root' })
export class ContactApi {
  private readonly http = inject(HttpClient);

  /** The server answers 202 with no body for every valid submission, so there is nothing to return. */
  send(request: ContactRequest): Observable<void> {
    return this.http.post<void>(CONTACT_URL, request);
  }
}
