import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminProject } from './admin-project';
import { ProjectForm } from './project-form';

const LIST = '/api/v1/admin/projects';

describe('ProjectForm', () => {
  let fixture: ComponentFixture<ProjectForm>;
  let http: HttpTestingController;
  let saved: AdminProject[];
  let cancelled: number;

  const hub: AdminProject = {
    id: 1,
    title: 'Portfolio Hub',
    description: 'A modular monolith',
    url: 'https://example.com',
    imageUrl: null,
    displayOrder: 3,
    published: false,
    createdAt: '2026-09-30T12:00:00Z',
  };

  async function render(project: AdminProject | null): Promise<void> {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProjectForm);
    fixture.componentRef.setInput('project', project);
    saved = [];
    cancelled = 0;
    fixture.componentInstance.saved.subscribe((p) => saved.push(p));
    fixture.componentInstance.cancelled.subscribe(() => cancelled++);
    await fixture.whenStable();
  }

  afterEach(() => http.verify());

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  /** Finds a control the way assistive technology does: through its <label>. */
  function field(label: string): HTMLInputElement | HTMLTextAreaElement {
    const labelEl = Array.from(host().querySelectorAll('label')).find(
      (l) => l.textContent?.replace(/\s+/g, ' ').trim() === label,
    );
    const control = labelEl && host().querySelector<HTMLInputElement>(`#${labelEl.htmlFor}`);
    if (!control) {
      throw new Error(`No control labelled "${label}"`);
    }
    return control;
  }

  /** The error text announced for a field: whatever its aria-describedby points at. */
  function errorFor(label: string): string {
    const ids = field(label).getAttribute('aria-describedby') ?? '';
    return ids
      .split(' ')
      .filter((id) => id.length > 0) // no aria-describedby → no ids, not one empty id
      .map((id) => host().querySelector(`#${id}`)?.textContent?.replace(/\s+/g, ' ').trim() ?? '')
      .filter((text) => text.length > 0)
      .join(' ');
  }

  function button(name: string): HTMLButtonElement {
    const match = Array.from(host().querySelectorAll('button')).find(
      (b) => b.textContent?.replace(/\s+/g, ' ').trim() === name,
    );
    if (!match) {
      throw new Error(`No button named "${name}"`);
    }
    return match;
  }

  function formError(): string {
    return host().querySelector('[role="alert"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  async function type(label: string, value: string): Promise<void> {
    const control = field(label);
    control.value = value;
    control.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function fillValidProject(): Promise<void> {
    await type('Title', 'Portfolio Hub');
    await type('Description', 'A modular monolith');
    await type('Project link', 'https://example.com');
    await type('Display order', '2');
  }

  describe('creating', () => {
    beforeEach(() => render(null));

    it('starts empty, unpublished, at display order 0', () => {
      expect(host().querySelector('h2')?.textContent?.trim()).toBe('New project');
      expect(field('Title').value).toBe('');
      expect(field('Display order').value).toBe('0');
      expect((field('Published') as HTMLInputElement).checked).toBe(false);
    });

    it('sends the form values and reports the saved project', async () => {
      await fillValidProject();

      button('Create project').click(); // POST is sent synchronously; don't wait for stability yet
      const request = http.expectOne(LIST);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({
        title: 'Portfolio Hub',
        description: 'A modular monolith',
        url: 'https://example.com',
        imageUrl: '',
        displayOrder: 2,
        published: false,
      });
      request.flush({ ...hub, displayOrder: 2 });
      await fixture.whenStable();

      expect(saved).toEqual([{ ...hub, displayOrder: 2 }]);
    });

    it('blocks the save and explains why while required fields are missing', async () => {
      await type('Display order', '');

      button('Create project').click();
      await fixture.whenStable();

      http.expectNone(LIST);
      expect(errorFor('Title')).toBe('Enter a title.');
      expect(errorFor('Display order')).toBe('Enter a display order.');
      expect(field('Title').getAttribute('aria-invalid')).toBe('true');
      expect(saved).toEqual([]);
    });

    it('treats a title of only spaces as missing', async () => {
      await type('Title', '   ');

      button('Create project').click();
      await fixture.whenStable();

      http.expectNone(LIST);
      expect(errorFor('Title')).toBe('Enter a title.');
    });

    it('rejects a negative display order', async () => {
      await fillValidProject();
      await type('Display order', '-1');

      button('Create project').click();
      await fixture.whenStable();

      http.expectNone(LIST);
      expect(errorFor('Display order')).toBe('Use 0 or a positive number.');
    });

    it('rejects links that are not full http(s) addresses', async () => {
      await fillValidProject();
      await type('Project link', 'javascript:alert(1)');
      await type('Image link', 'example.com/hub.png');

      button('Create project').click();
      await fixture.whenStable();

      http.expectNone(LIST);
      expect(errorFor('Project link')).toBe('Enter a full link starting with http:// or https://.');
      expect(errorFor('Image link')).toBe('Enter a full link starting with http:// or https://.');
    });

    it('shows server validation errors next to the matching fields', async () => {
      await fillValidProject();

      button('Create project').click();
      http.expectOne(LIST).flush(
        {
          status: 400,
          code: 'validation-failed',
          errors: [
            { field: 'title', message: 'size must be between 0 and 200' },
            { field: 'url', message: 'must be an absolute http(s) URL' },
          ],
        },
        { status: 400, statusText: 'Bad Request' },
      );
      await fixture.whenStable();

      expect(errorFor('Title')).toBe('size must be between 0 and 200');
      expect(errorFor('Project link')).toBe('must be an absolute http(s) URL');
      expect(errorFor('Description')).toBe('');
      expect(formError()).toBe('');
      expect(saved).toEqual([]);
    });

    it('clears a server error once that field is edited', async () => {
      await fillValidProject();
      button('Create project').click();
      http
        .expectOne(LIST)
        .flush(
          { status: 400, errors: [{ field: 'title', message: 'size must be between 0 and 200' }] },
          { status: 400, statusText: 'Bad Request' },
        );
      await fixture.whenStable();

      expect(errorFor('Title')).toBe('size must be between 0 and 200'); // present first…
      await type('Title', 'Portfolio Hub (short)');

      expect(errorFor('Title')).toBe(''); // …then gone after the edit
    });

    it('shows server errors for unknown fields as a form-level message', async () => {
      await fillValidProject();

      button('Create project').click();
      http
        .expectOne(LIST)
        .flush(
          { status: 400, errors: [{ field: 'somethingNew', message: 'is not allowed' }] },
          { status: 400, statusText: 'Bad Request' },
        );
      await fixture.whenStable();

      expect(formError()).toBe('somethingNew: is not allowed');
    });

    it('explains that sign-in is required when the API answers 401', async () => {
      await fillValidProject();

      button('Create project').click();
      http.expectOne(LIST).flush(null, { status: 401, statusText: 'Unauthorized' });
      await fixture.whenStable();

      expect(formError()).toBe(
        'You need to sign in to save projects. Sign-in arrives in a later release.',
      );
    });

    it('keeps what was typed and says so when saving fails unexpectedly', async () => {
      await fillValidProject();

      button('Create project').click();
      http.expectOne(LIST).flush(null, { status: 500, statusText: 'Server Error' });
      await fixture.whenStable();

      expect(formError()).toBe("The project couldn't be saved. Please try again.");
      expect(field('Title').value).toBe('Portfolio Hub');
      expect(saved).toEqual([]);
    });

    it('disables saving while a save is in progress', async () => {
      await fillValidProject();

      button('Create project').click();
      fixture.detectChanges();
      expect(button('Saving…').disabled).toBe(true);

      http.expectOne(LIST).flush(hub);
      await fixture.whenStable();
    });

    it('cancels without sending anything', async () => {
      await type('Title', 'Never mind');

      button('Cancel').click();
      await fixture.whenStable();

      http.expectNone(LIST);
      expect(cancelled).toBe(1);
    });
  });

  describe('editing', () => {
    beforeEach(() => render(hub));

    it('starts from the existing project', () => {
      expect(host().querySelector('h2')?.textContent?.trim()).toBe('Edit Portfolio Hub');
      expect(field('Title').value).toBe('Portfolio Hub');
      expect(field('Description').value).toBe('A modular monolith');
      expect(field('Project link').value).toBe('https://example.com');
      expect(field('Image link').value).toBe('');
      expect(field('Display order').value).toBe('3');
    });

    it('saves as a full replace of that project', async () => {
      await type('Title', 'Portfolio Hub v2');
      (field('Published') as HTMLInputElement).click();
      await fixture.whenStable();

      button('Save changes').click();
      const request = http.expectOne(`${LIST}/1`);
      expect(request.request.method).toBe('PUT');
      expect(request.request.body).toEqual({
        title: 'Portfolio Hub v2',
        description: 'A modular monolith',
        url: 'https://example.com',
        imageUrl: '',
        displayOrder: 3,
        published: true,
      });
      request.flush({ ...hub, title: 'Portfolio Hub v2', published: true });
      await fixture.whenStable();

      expect(saved).toEqual([{ ...hub, title: 'Portfolio Hub v2', published: true }]);
    });

    it('says so when the project was deleted elsewhere', async () => {
      button('Save changes').click();
      http
        .expectOne(`${LIST}/1`)
        .flush(
          { status: 404, code: 'project-not-found' },
          { status: 404, statusText: 'Not Found' },
        );
      await fixture.whenStable();

      expect(formError()).toBe('This project no longer exists. It may have been deleted.');
    });
  });
});
