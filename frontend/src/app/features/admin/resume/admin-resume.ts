import { HttpErrorResponse, HttpEventType, httpResource } from '@angular/common/http';
import {
  Component,
  ElementRef,
  PendingTasks,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { filter, lastValueFrom, map, tap } from 'rxjs';
import { ADMIN_RESUME_URL, AdminResumeApi } from './admin-resume-api';
import { ResumeUpload } from './resume-upload';

/** Mirrors the backend limit (hub.resume.max-size). The server re-checks regardless. */
const MAX_BYTES = 10 * 1024 * 1024;

const NOT_PDF = 'Only PDF files can be uploaded. Choose a .pdf file.';
const TOO_LARGE = 'The file is larger than 10 MB. Choose a smaller PDF.';
const EMPTY = 'The file is empty. Choose a different PDF.';
const UPLOAD_FAILED = "The resume couldn't be uploaded. Please try again.";

/** Server Problem Details codes (see InvalidResumeException and ProblemDetailsAdvice) mapped to what the admin reads. */
const MESSAGES_BY_CODE: ReadonlyMap<string, string> = new Map([
  ['resume-not-pdf', NOT_PDF],
  ['resume-too-large', TOO_LARGE],
  ['file-too-large', TOO_LARGE],
  ['resume-empty', EMPTY],
]);

/** Shown in UTC, labelled as such: uploads can happen several times a day, and the server stores UTC. */
const uploadedAt = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

/** Catches the common mistakes before spending an upload on them; mirrors the backend's rules. */
function clientProblem(file: File): string | null {
  if (file.type !== 'application/pdf') {
    return NOT_PDF;
  }
  if (file.size === 0) {
    return EMPTY;
  }
  if (file.size > MAX_BYTES) {
    return TOO_LARGE;
  }
  return null;
}

function codeOf(body: unknown): string | null {
  if (typeof body === 'object' && body !== null) {
    const code = (body as { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
  }
  return null;
}

/** An upload in flight. `percent` is null when the browser cannot tell the total size. */
interface Upload {
  readonly filename: string;
  readonly percent: number | null;
}

/**
 * Upload history plus the upload form. A plain file input rather than Signal Forms: Signal Forms binds values, and a
 * file input's value cannot be set from code, so there is nothing for a form model to hold besides the File itself.
 */
@Component({
  selector: 'app-admin-resume',
  templateUrl: './admin-resume.html',
  styleUrls: ['../admin-shared.css', './admin-resume.css'],
})
export class AdminResume {
  private readonly api = inject(AdminResumeApi);
  private readonly pendingTasks = inject(PendingTasks);
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  protected readonly history = httpResource<ResumeUpload[]>(() => ADMIN_RESUME_URL);

  protected readonly selected = signal<File | null>(null);
  protected readonly upload = signal<Upload | null>(null);
  protected readonly uploadError = signal<string | null>(null);
  protected readonly uploadedMessage = signal<string | null>(null);

  /** Bytes all sent but no response yet: the server is validating and storing the file. */
  protected readonly saving = computed(() => this.upload()?.percent === 100);

  protected readonly loadError = computed(() => {
    const error = this.history.error();
    if (!error) {
      return null;
    }
    const status = error instanceof HttpErrorResponse ? error.status : 0;
    // No auth guard yet (login slice): until then the API answers 401 and the page says why.
    if (status === 401) {
      return 'You need to sign in to manage the resume. Sign-in arrives in a later release.';
    }
    if (status === 403) {
      return "You don't have permission to manage the resume.";
    }
    return "The upload history couldn't be loaded. Please try again.";
  });

  protected formatUploaded(iso: string): string {
    return `${uploadedAt.format(new Date(iso))} UTC`;
  }

  protected onFileChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selected.set(input.files?.item(0) ?? null);
    this.uploadError.set(null);
    this.uploadedMessage.set(null);
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.uploadError.set(null);
    this.uploadedMessage.set(null);
    const file = this.selected();
    if (!file) {
      this.uploadError.set('Choose a PDF file to upload.');
      return;
    }
    const problem = clientProblem(file);
    if (problem) {
      this.uploadError.set(problem);
      return;
    }

    // Zoneless Angular cannot see this promise chain; registering it keeps the app "unstable" until the outcome is
    // rendered, which is what tests (whenStable) and, later, SSR wait for. Same pattern as AdminProjects.
    const done = this.pendingTasks.add();
    this.upload.set({ filename: file.name, percent: 0 });
    try {
      const saved = await lastValueFrom(
        this.api.upload(file).pipe(
          tap((event) => {
            if (event.type === HttpEventType.UploadProgress) {
              const percent = event.total ? Math.round((event.loaded / event.total) * 100) : null;
              this.upload.set({ filename: file.name, percent });
            }
          }),
          filter((event) => event.type === HttpEventType.Response),
          map((response) => response.body),
        ),
      );
      this.uploadedMessage.set(
        `Uploaded ${saved?.filename ?? file.name}. It is now the public resume.`,
      );
      this.selected.set(null);
      this.fileInput().nativeElement.value = '';
      this.history.reload();
    } catch (error) {
      this.uploadError.set(this.messageFor(error));
    } finally {
      this.upload.set(null);
      done();
    }
  }

  private messageFor(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return UPLOAD_FAILED;
    }
    const byCode = MESSAGES_BY_CODE.get(codeOf(error.error) ?? '');
    if (byCode) {
      return byCode;
    }
    if (error.status === 413) {
      // A proxy in front of the backend may reject the body before it has a chance to answer with a code.
      return TOO_LARGE;
    }
    if (error.status === 401) {
      return 'You need to sign in to upload a resume. Sign-in arrives in a later release.';
    }
    if (error.status === 403) {
      return "You don't have permission to upload a resume.";
    }
    return UPLOAD_FAILED;
  }
}
