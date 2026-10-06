import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminResume } from './admin-resume';
import { ResumeUpload } from './resume-upload';

const URL = '/api/v1/admin/resume';

describe('AdminResume', () => {
  let fixture: ComponentFixture<AdminResume>;
  let http: HttpTestingController;

  const current: ResumeUpload = {
    id: 2,
    filename: 'cv-2026.pdf',
    uploadedAt: '2026-10-05T14:30:00Z',
    active: true,
  };
  const previous: ResumeUpload = {
    id: 1,
    filename: 'cv-2025.pdf',
    uploadedAt: '2025-03-01T09:05:00Z',
    active: false,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminResume);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function squash(value: string | null | undefined): string {
    return value?.replace(/\s+/g, ' ').trim() ?? '';
  }

  function text(selector: string): string {
    return squash(host().querySelector(selector)?.textContent);
  }

  /** The upload section's live region; the history section has its own. */
  function uploadStatus(): string {
    return text('.upload [role="status"]');
  }

  function historyStatus(): string {
    return text('section[aria-labelledby="history-heading"] [role="status"]');
  }

  function rows(): string[][] {
    return Array.from(host().querySelectorAll('tbody tr')).map((row) =>
      Array.from(row.querySelectorAll('th, td')).map((cell) => squash(cell.textContent)),
    );
  }

  function fileInput(): HTMLInputElement {
    const label = Array.from(host().querySelectorAll('label')).find(
      (l) => squash(l.textContent) === 'Resume PDF',
    );
    const input = label && host().querySelector<HTMLInputElement>(`#${label.htmlFor}`);
    if (!input) {
      throw new Error('No control labelled "Resume PDF"');
    }
    return input;
  }

  function pdf(name = 'cv.pdf', size?: number): File {
    const file = new File(['%PDF-1.7'], name, { type: 'application/pdf' });
    if (size !== undefined) {
      // Avoids allocating megabytes just to test the limit.
      Object.defineProperty(file, 'size', { value: size });
    }
    return file;
  }

  /** A file input's FileList cannot be built in a test, so stand in for the one property the component reads. */
  async function choose(file: File): Promise<void> {
    const input = fileInput();
    Object.defineProperty(input, 'files', { value: { item: () => file }, configurable: true });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  }

  /** Submits without waiting for stability: an upload in flight keeps the app unstable on purpose. */
  function submit(): void {
    host()
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
  }

  async function load(history: ResumeUpload[]): Promise<void> {
    http.expectOne(URL).flush(history);
    await fixture.whenStable();
  }

  async function answerReload(history: ResumeUpload[]): Promise<void> {
    const reload = await vi.waitFor(() => http.expectOne({ method: 'GET', url: URL }));
    reload.flush(history);
    await fixture.whenStable();
  }

  // --- History ---

  it('shows a loading message while the history loads', () => {
    const request = http.expectOne(URL);

    expect(historyStatus()).toBe('Loading upload history…');

    request.flush([]);
  });

  it('lists every upload newest first, marking the active one', async () => {
    await load([current, previous]);

    expect(rows()).toEqual([
      ['cv-2026.pdf', 'Oct 5, 2026, 2:30 PM UTC', 'Active'],
      ['cv-2025.pdf', 'Mar 1, 2025, 9:05 AM UTC', 'Previous'],
    ]);
    expect(host().querySelector('time')?.getAttribute('datetime')).toBe('2026-10-05T14:30:00Z');
  });

  it('explains that visitors have nothing to download before the first upload', async () => {
    await load([]);

    expect(host().querySelector('table')).toBeNull();
    expect(historyStatus()).toBe(
      "No resume uploaded yet. Visitors can't download one until you upload a PDF.",
    );
  });

  it('explains that sign-in is required when the API answers 401', async () => {
    http.expectOne(URL).flush(null, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();

    expect(historyStatus()).toBe(
      'You need to sign in to manage the resume. Sign-in arrives in a later release.',
    );
  });

  it('shows a general error when the history fails to load for another reason', async () => {
    http.expectOne(URL).flush(null, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(historyStatus()).toBe("The upload history couldn't be loaded. Please try again.");
  });

  // --- Uploading ---

  it('accepts only PDFs in the file picker', async () => {
    await load([]);

    expect(fileInput().accept).toBe('application/pdf,.pdf');
  });

  it('uploads the chosen PDF as multipart, shows progress, then refreshes the history', async () => {
    await load([previous]);
    const file = pdf('Jane Doe CV.pdf');
    await choose(file);

    submit();
    const request = http.expectOne({ method: 'POST', url: URL });
    // FormData stores a copy of the File, so compare what the server receives rather than identity.
    const part = (request.request.body as FormData).get('file');
    expect(part).toBeInstanceOf(File);
    expect((part as File).name).toBe('Jane Doe CV.pdf');
    expect((part as File).type).toBe('application/pdf');
    expect(await (part as File).text()).toBe(await file.text());

    request.event({ type: HttpEventType.UploadProgress, loaded: 40, total: 100 });
    fixture.detectChanges();
    expect(uploadStatus()).toBe('Uploading Jane Doe CV.pdf…');
    expect(host().querySelector('progress')?.value).toBe(40);
    expect(host().querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);

    request.event({ type: HttpEventType.UploadProgress, loaded: 100, total: 100 });
    fixture.detectChanges();
    expect(uploadStatus()).toBe('Saving…');

    request.flush(
      { ...current, filename: 'Jane Doe CV.pdf' },
      { status: 201, statusText: 'Created' },
    );
    await answerReload([{ ...current, filename: 'Jane Doe CV.pdf' }, previous]);

    expect(uploadStatus()).toBe('Uploaded Jane Doe CV.pdf. It is now the public resume.');
    expect(host().querySelector('progress')).toBeNull();
    expect(rows().map(([name, , status]) => [name, status])).toEqual([
      ['Jane Doe CV.pdf', 'Active'],
      ['cv-2025.pdf', 'Previous'],
    ]);
    expect(fileInput().value).toBe('');
  });

  it('asks for a file when Upload is pressed with none chosen', async () => {
    await load([]);

    submit();
    await fixture.whenStable();

    http.expectNone({ method: 'POST' });
    expect(text('[role="alert"]')).toBe('Choose a PDF file to upload.');
  });

  it('rejects a file that is not a PDF without uploading it', async () => {
    await load([]);
    await choose(new File(['hello'], 'notes.txt', { type: 'text/plain' }));

    submit();
    await fixture.whenStable();

    http.expectNone({ method: 'POST' });
    expect(text('[role="alert"]')).toBe('Only PDF files can be uploaded. Choose a .pdf file.');
  });

  it('rejects a PDF over 10 MB without uploading it', async () => {
    await load([]);
    await choose(pdf('huge.pdf', 10 * 1024 * 1024 + 1));

    submit();
    await fixture.whenStable();

    http.expectNone({ method: 'POST' });
    expect(text('[role="alert"]')).toBe('The file is larger than 10 MB. Choose a smaller PDF.');
  });

  it.each([
    [400, 'resume-not-pdf', 'Only PDF files can be uploaded. Choose a .pdf file.'],
    [400, 'resume-empty', 'The file is empty. Choose a different PDF.'],
    [413, 'resume-too-large', 'The file is larger than 10 MB. Choose a smaller PDF.'],
    [413, 'file-too-large', 'The file is larger than 10 MB. Choose a smaller PDF.'],
    [413, null, 'The file is larger than 10 MB. Choose a smaller PDF.'],
    [
      401,
      'unauthorized',
      'You need to sign in to upload a resume. Sign-in arrives in a later release.',
    ],
    [403, 'forbidden', "You don't have permission to upload a resume."],
    [500, 'internal-error', "The resume couldn't be uploaded. Please try again."],
  ])(
    'explains a %i (%s) from the server and keeps the history unchanged',
    async (status, code, message) => {
      await load([previous]);
      await choose(pdf());

      submit();
      http
        .expectOne({ method: 'POST', url: URL })
        .flush(code === null ? null : { status, code }, { status, statusText: 'Error' });
      await fixture.whenStable();

      expect(text('[role="alert"]')).toBe(message);
      expect(uploadStatus()).toBe('');
      expect(rows().map(([name]) => name)).toEqual(['cv-2025.pdf']);
      expect(host().querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(
        false,
      );
    },
  );

  it('clears an earlier error when a different file is chosen', async () => {
    await load([]);
    await choose(new File(['hello'], 'notes.txt', { type: 'text/plain' }));
    submit();
    await fixture.whenStable();

    await choose(pdf());

    expect(host().querySelector('[role="alert"]')).toBeNull();
  });
});
