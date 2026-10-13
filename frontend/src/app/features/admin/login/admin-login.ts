import { HttpErrorResponse } from '@angular/common/http';
import { Component, PendingTasks, computed, inject, input, signal } from '@angular/core';
import {
  FormField,
  ReadonlyFieldTree,
  SchemaPathTree,
  TreeValidationResult,
  ValidationError,
  form,
  submit,
  validate,
} from '@angular/forms/signals';
import { Router } from '@angular/router';
import { AuthSession } from '../../../core/auth/auth-session';
import { safeReturnUrl } from '../../../core/auth/return-url';
import { isValidationProblem } from '../../../core/validation-problem';

interface LoginFormModel {
  email: string;
  password: string;
}

const EMPTY: LoginFormModel = { email: '', password: '' };

/** One message for a wrong password and an unknown email alike, as the backend does: it names no field. */
const INVALID_CREDENTIALS = 'The email or password is incorrect.';
/** The backend's own wording (LoginThrottledException), kept here rather than rendering text from the response. */
const THROTTLED = 'Too many failed sign-in attempts. Try again later.';
const SIGN_IN_FAILED = 'Sign-in failed. Please try again.';

/**
 * As lenient as the backend's plain `@Email`, which accepts `admin@localhost`: the admin's address comes from
 * configuration, and a stricter client rule (Contact's dotted domain) could lock a real admin out.
 */
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+$/;

function loginSchema(path: SchemaPathTree<LoginFormModel>): void {
  validate(path.email, ({ value }) => {
    const email = value().trim();
    if (email === '') {
      return { kind: 'required', message: 'Enter your email address.' };
    }
    return EMAIL_FORMAT.test(email)
      ? null
      : { kind: 'email', message: 'Enter a valid email address.' };
  });
  // Not trimmed: spaces can be part of a password.
  validate(path.password, ({ value }) =>
    value() === '' ? { kind: 'required', message: 'Enter your password.' } : null,
  );
}

/** The admin sign-in page. Lives outside AdminLayout, so nothing of the admin area shows before signing in. */
@Component({
  selector: 'app-admin-login',
  imports: [FormField],
  templateUrl: './admin-login.html',
  styleUrls: ['../admin-shared.css', './admin-login.css'],
})
export class AdminLogin {
  private readonly session = inject(AuthSession);
  private readonly router = inject(Router);
  private readonly pendingTasks = inject(PendingTasks);

  /** Bound from the ?returnUrl= query parameter (withComponentInputBinding); set by the guard when it redirects here. */
  readonly returnUrl = input<string>();
  /** Bound from ?signedOut=1, which AdminLayout adds after a successful sign-out. */
  readonly signedOut = input<string>();

  private readonly model = signal<LoginFormModel>(EMPTY);
  /** A fixed root name, so the controls render as name="login.email" and name="login.password" (see Contact). */
  protected readonly form = form(this.model, loginSchema, { name: 'login' });

  /**
   * Stays while the admin is on this page; a successful sign-in navigates away. Hidden while a sign-in error shows,
   * so the page never says "You've signed out" and "The email or password is incorrect" at once.
   */
  protected readonly showSignedOut = computed(
    () => !!this.signedOut() && this.form().errors().length === 0,
  );

  /** Server field names mapped to the controls that show their errors (see ProjectForm for why a Map). */
  private readonly fieldsByServerName: ReadonlyMap<string, ReadonlyFieldTree<unknown>> = new Map<
    string,
    ReadonlyFieldTree<unknown>
  >([
    ['email', this.form.email],
    ['password', this.form.password],
  ]);

  /** Errors are shown once a field has been touched, which submit() does for every field. */
  protected showErrors(field: ReadonlyFieldTree<unknown>): boolean {
    return field().touched() && field().errors().length > 0;
  }

  protected async signIn(event: Event): Promise<void> {
    event.preventDefault();
    // Wraps the whole submit(), not just the HTTP call: Signal Forms applies returned errors after the action
    // resolves, and tests (whenStable) and, later, SSR must wait for that too. Same pattern as ProjectForm.
    const done = this.pendingTasks.add();
    try {
      await submit(this.form, () => this.post());
    } finally {
      done();
    }
  }

  /** Runs only when the client-side rules pass. Returns errors for Signal Forms to attach, or nothing on success. */
  private async post(): Promise<TreeValidationResult> {
    const { email, password } = this.model();
    try {
      // The email is trimmed here because the backend's LoginRequest does not trim (unlike ContactRequest).
      await this.session.login({ email: email.trim(), password });
    } catch (error) {
      return this.toSubmissionErrors(error);
    }
    await this.router.navigateByUrl(safeReturnUrl(this.returnUrl()));
    return null;
  }

  private toSubmissionErrors(error: unknown): ValidationError.WithOptionalFieldTree[] {
    const status = error instanceof HttpErrorResponse ? error.status : 0;
    if (status === 401) {
      // Cleared and made pristine, so the next attempt starts blank without an instant "Enter your password." error.
      this.form.password().reset('');
      // Form-level on purpose: attaching it to either field would hint at which one was wrong.
      return [{ kind: 'server', message: INVALID_CREDENTIALS }];
    }
    if (status === 429) {
      return [{ kind: 'server', message: THROTTLED }];
    }
    if (status === 400 && error instanceof HttpErrorResponse && isValidationProblem(error.error)) {
      return error.error.errors.map(({ field, message }) => {
        const fieldTree = this.fieldsByServerName.get(field);
        return fieldTree
          ? { kind: 'server', message, fieldTree }
          : { kind: 'server', message: `${field}: ${message}` };
      });
    }
    return [{ kind: 'server', message: SIGN_IN_FAILED }];
  }
}
