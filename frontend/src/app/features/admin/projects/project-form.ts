import { HttpErrorResponse } from '@angular/common/http';
import { Component, PendingTasks, inject, input, linkedSignal, output } from '@angular/core';
import {
  FormField,
  ReadonlyFieldTree,
  SchemaPathTree,
  TreeValidationResult,
  ValidationError,
  form,
  maxLength,
  min,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { AdminProject, ProjectRequest } from './admin-project';
import { AdminProjectsApi } from './admin-projects-api';

/** What the inputs edit. displayOrder is nullable because an emptied number input reports null. */
interface ProjectFormModel {
  title: string;
  description: string;
  url: string;
  imageUrl: string;
  displayOrder: number | null;
  published: boolean;
}

const LINK_MESSAGE = 'Enter a full link starting with http:// or https://.';
const SAVE_FAILED = "The project couldn't be saved. Please try again.";

/** Mirrors the backend rule (HttpUrls): absolute, http or https, with a host. The server re-checks regardless. */
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== '';
  } catch {
    return false;
  }
}

/** Client-side rules match the backend's Bean Validation, so most mistakes never cost a round trip. */
function projectSchema(path: SchemaPathTree<ProjectFormModel>): void {
  validate(path.title, ({ value }) =>
    value().trim() === '' ? { kind: 'required', message: 'Enter a title.' } : null,
  );
  maxLength(path.title, 200, { message: 'Keep the title to 200 characters or fewer.' });
  maxLength(path.description, 5000, {
    message: 'Keep the description to 5000 characters or fewer.',
  });
  required(path.displayOrder, { message: 'Enter a display order.' });
  min(path.displayOrder, 0, { message: 'Use 0 or a positive number.' });
  validate(path.url, ({ value }) =>
    value() !== '' && !isHttpUrl(value()) ? { kind: 'url', message: LINK_MESSAGE } : null,
  );
  validate(path.imageUrl, ({ value }) =>
    value() !== '' && !isHttpUrl(value()) ? { kind: 'url', message: LINK_MESSAGE } : null,
  );
}

function toModel(project: AdminProject | null): ProjectFormModel {
  return {
    title: project?.title ?? '',
    description: project?.description ?? '',
    url: project?.url ?? '',
    imageUrl: project?.imageUrl ?? '',
    displayOrder: project?.displayOrder ?? 0,
    published: project?.published ?? false,
  };
}

/** Problem Details body for a 400 from the backend's validation (see ProblemDetailsAdvice). */
interface ValidationProblem {
  readonly errors: readonly { readonly field: string; readonly message: string }[];
}

function isValidationProblem(body: unknown): body is ValidationProblem {
  return (
    typeof body === 'object' &&
    body !== null &&
    Array.isArray((body as { errors?: unknown }).errors)
  );
}

/** Create (project is null) or edit (full replace) a project. Emits the server's saved copy. */
@Component({
  selector: 'app-project-form',
  imports: [FormField],
  templateUrl: './project-form.html',
  styleUrl: './project-form.css',
})
export class ProjectForm {
  private readonly api = inject(AdminProjectsApi);
  private readonly pendingTasks = inject(PendingTasks);

  readonly project = input<AdminProject | null>(null);
  readonly saved = output<AdminProject>();
  readonly cancelled = output<void>();

  /** Resets whenever a different project is passed in. */
  private readonly model = linkedSignal(() => toModel(this.project()));
  protected readonly form = form(this.model, projectSchema);

  /**
   * Server field names (the request DTO's) mapped to the controls that show their errors. A Map, not an object
   * literal: get() returns undefined for unknown names, and inherited keys such as "constructor" never match.
   */
  private readonly fieldsByServerName: ReadonlyMap<string, ReadonlyFieldTree<unknown>> = new Map<
    string,
    ReadonlyFieldTree<unknown>
  >([
    ['title', this.form.title],
    ['description', this.form.description],
    ['url', this.form.url],
    ['imageUrl', this.form.imageUrl],
    ['displayOrder', this.form.displayOrder],
    ['published', this.form.published],
  ]);

  /** Errors are shown once a field has been touched, which submit() does for every field. */
  protected showErrors(field: ReadonlyFieldTree<unknown>): boolean {
    return field().touched() && field().errors().length > 0;
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    // Wraps the whole submit(), not just the HTTP call: Signal Forms applies returned errors to the fields after the
    // action resolves, and tests (whenStable) and, later, SSR must wait for that too. Same pattern as AdminProjects.
    const done = this.pendingTasks.add();
    try {
      await submit(this.form, () => this.send());
    } finally {
      done();
    }
  }

  protected cancel(): void {
    this.cancelled.emit();
  }

  /** Runs only when the client-side rules pass. Returns errors for Signal Forms to attach, or nothing on success. */
  private async send(): Promise<TreeValidationResult> {
    const value = this.model();
    const body: ProjectRequest = {
      title: value.title,
      description: value.description,
      url: value.url,
      imageUrl: value.imageUrl,
      // required() has already rejected null by the time send() runs; ?? only satisfies the type.
      displayOrder: value.displayOrder ?? 0,
      published: value.published,
    };
    const project = this.project();
    try {
      const savedProject = await firstValueFrom(
        project ? this.api.replace(project.id, body) : this.api.create(body),
      );
      this.saved.emit(savedProject);
      return null;
    } catch (error) {
      return this.toSubmissionErrors(error);
    }
  }

  /**
   * Field errors from a 400 go next to their field; anything without a matching field becomes a form-level error
   * (an error with no fieldTree attaches to the submitted root), so nothing the server says is silently dropped.
   */
  private toSubmissionErrors(error: unknown): ValidationError.WithOptionalFieldTree[] {
    if (!(error instanceof HttpErrorResponse)) {
      return [{ kind: 'server', message: SAVE_FAILED }];
    }
    if (error.status === 400 && isValidationProblem(error.error)) {
      return error.error.errors.map(({ field, message }) => {
        const fieldTree = this.fieldsByServerName.get(field);
        return fieldTree
          ? { kind: 'server', message, fieldTree }
          : { kind: 'server', message: `${field}: ${message}` };
      });
    }
    if (error.status === 401) {
      return [
        {
          kind: 'server',
          message: 'You need to sign in to save projects. Sign-in arrives in a later release.',
        },
      ];
    }
    if (error.status === 404 && this.project()) {
      return [
        { kind: 'server', message: 'This project no longer exists. It may have been deleted.' },
      ];
    }
    return [{ kind: 'server', message: SAVE_FAILED }];
  }
}
