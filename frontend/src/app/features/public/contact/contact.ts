import { HttpErrorResponse } from '@angular/common/http';
import { Component, PendingTasks, computed, inject, signal } from '@angular/core';
import {
  FormField,
  ReadonlyFieldTree,
  SchemaPathTree,
  TreeValidationResult,
  ValidationError,
  form,
  maxLength,
  submit,
  validate,
} from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { isValidationProblem } from '../../../core/validation-problem';
import { ContactApi, ContactRequest } from './contact-api';

type ContactFormModel = ContactRequest;

const EMPTY: ContactFormModel = { name: '', email: '', message: '', website: '' };

const SEND_FAILED = "Your message couldn't be sent. Please try again.";

/**
 * The backend requires `@Email` plus a dot in the domain (`.+@.+\..+`). This is at least as strict, so anything it
 * accepts the server accepts too; the server re-checks regardless.
 */
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Mirrors the backend's Bean Validation. Blank checks use the trimmed value because the server strips whitespace
 * before validating. `website` (the honeypot) has no rules on purpose: the client never hints at what a bot did wrong.
 */
function contactSchema(path: SchemaPathTree<ContactFormModel>): void {
  validate(path.name, ({ value }) =>
    value().trim() === '' ? { kind: 'required', message: 'Enter your name.' } : null,
  );
  maxLength(path.name, 200, { message: 'Keep your name to 200 characters or fewer.' });
  validate(path.email, ({ value }) => {
    const email = value().trim();
    if (email === '') {
      return { kind: 'required', message: 'Enter your email address.' };
    }
    return EMAIL_FORMAT.test(email)
      ? null
      : { kind: 'email', message: 'Enter a valid email address, like name@example.com.' };
  });
  maxLength(path.email, 254, { message: 'Keep your email address to 254 characters or fewer.' });
  validate(path.message, ({ value }) =>
    value().trim() === '' ? { kind: 'required', message: 'Enter a message.' } : null,
  );
  maxLength(path.message, 5000, { message: 'Keep your message to 5000 characters or fewer.' });
}

/** The public contact form. Sends to POST /api/v1/contact; the admin reads messages in the admin inbox. */
@Component({
  selector: 'app-contact',
  imports: [FormField],
  templateUrl: './contact.html',
  styleUrl: './contact.css',
})
export class Contact {
  private readonly api = inject(ContactApi);
  private readonly pendingTasks = inject(PendingTasks);

  private readonly model = signal<ContactFormModel>(EMPTY);
  /**
   * Signal Forms owns each control's name attribute (`<root>.<key>`). A fixed root keeps them stable, so the honeypot
   * renders as name="contact.website": a field name bots expect to fill, rather than a generated "ng.form0.website".
   */
  protected readonly form = form(this.model, contactSchema, { name: 'contact' });

  private readonly sent = signal(false);
  /**
   * The confirmation stays until the visitor starts another message. reset() leaves the form pristine, so the first
   * edit (which makes it dirty) is what hides it; no effect needed.
   */
  protected readonly showSent = computed(() => this.sent() && !this.form().dirty());

  /** Server field names mapped to the controls that show their errors (see ProjectForm for why a Map). */
  private readonly fieldsByServerName: ReadonlyMap<string, ReadonlyFieldTree<unknown>> = new Map<
    string,
    ReadonlyFieldTree<unknown>
  >([
    ['name', this.form.name],
    ['email', this.form.email],
    ['message', this.form.message],
  ]);

  /** Errors are shown once a field has been touched, which submit() does for every field. */
  protected showErrors(field: ReadonlyFieldTree<unknown>): boolean {
    return field().touched() && field().errors().length > 0;
  }

  protected async send(event: Event): Promise<void> {
    event.preventDefault();
    this.sent.set(false);
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
    try {
      // No defaultValue: a 202 emits one null body. Completing without a response must not count as "sent".
      await firstValueFrom(this.api.send(this.model()));
      // Sets the empty value and clears touched/dirty, so the cleared fields don't show "required" errors.
      this.form().reset(EMPTY);
      this.sent.set(true);
      return null;
    } catch (error) {
      return this.toSubmissionErrors(error);
    }
  }

  /**
   * Field errors from a 400 go next to their field; anything else becomes a form-level error, so nothing the server
   * says is silently dropped. What the visitor typed is kept in every failure case.
   */
  private toSubmissionErrors(error: unknown): ValidationError.WithOptionalFieldTree[] {
    if (
      error instanceof HttpErrorResponse &&
      error.status === 400 &&
      isValidationProblem(error.error)
    ) {
      return error.error.errors.map(({ field, message }) => {
        const fieldTree = this.fieldsByServerName.get(field);
        return fieldTree
          ? { kind: 'server', message, fieldTree }
          : { kind: 'server', message: `${field}: ${message}` };
      });
    }
    return [{ kind: 'server', message: SEND_FAILED }];
  }
}
