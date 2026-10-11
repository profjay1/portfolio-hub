import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export const AUTH_URL = '/api/v1/auth';

/** Matches the backend's Role enum. Hand-typed until the OpenAPI client is generated into api/generated. */
export type Role = 'ADMIN';

/** Body of GET /api/v1/auth/me and of a successful POST /api/v1/auth/login. */
export interface CurrentUser {
  readonly email: string;
  readonly role: Role;
}

/** Body of POST /api/v1/auth/login. */
export interface LoginRequest {
  readonly email: string;
  readonly password: string;
}

/**
 * Who is signed in, for any component that needs to know, from one GET /api/v1/auth/me. The session itself is the
 * HttpOnly cookie (ADR 0006), which no script can read; this only mirrors what the server says about it.
 *
 * Loaded lazily, when the admin area first asks, rather than at app start: public pages never need it, and every
 * visitor would otherwise send a /me request that answers 401. Imported only from admin code, it stays in the lazy
 * admin chunk.
 */
@Injectable({ providedIn: 'root' })
export class AuthSession {
  private readonly http = inject(HttpClient);

  /** undefined: not asked yet (or the last check failed for a reason other than 401). null: nobody is signed in. */
  private readonly current = signal<CurrentUser | null | undefined>(undefined);
  readonly user = this.current.asReadonly();
  readonly isAdmin = computed(() => this.current()?.role === 'ADMIN');

  /** The /me request in flight, shared so that callers arriving together cause one request, not one each. */
  private loading: Promise<CurrentUser | null> | null = null;

  /** Resolves to the signed-in user or null. Asks the server at most once until the answer is known. */
  ensureLoaded(): Promise<CurrentUser | null> {
    const known = this.current();
    if (known !== undefined) {
      return Promise.resolve(known);
    }
    this.loading ??= this.fetchMe().finally(() => {
      this.loading = null;
    });
    return this.loading;
  }

  /** Signs in. The response already says who signed in, so no follow-up /me request is needed. Errors propagate. */
  async login(request: LoginRequest): Promise<CurrentUser> {
    const user = await firstValueFrom(this.http.post<CurrentUser>(`${AUTH_URL}/login`, request));
    this.current.set(user);
    return user;
  }

  /** Forgets the user locally, for when the server has said the session is gone. */
  clear(): void {
    this.current.set(null);
  }

  private async fetchMe(): Promise<CurrentUser | null> {
    try {
      const user = await firstValueFrom(this.http.get<CurrentUser>(`${AUTH_URL}/me`));
      return this.settle(user);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        return this.settle(null);
      }
      // Fail closed for this caller, but don't remember it: a network blip must not count as "signed out" for good.
      return null;
    }
  }

  /** A login that finished while /me was in flight is newer than /me's answer, so it wins. */
  private settle(user: CurrentUser | null): CurrentUser | null {
    const known = this.current();
    if (known !== undefined) {
      return known;
    }
    this.current.set(user);
    return user;
  }
}
