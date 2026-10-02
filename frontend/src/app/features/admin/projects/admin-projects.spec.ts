import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminProject } from './admin-project';
import { AdminProjects } from './admin-projects';

const LIST = '/api/v1/admin/projects';

describe('AdminProjects', () => {
  let fixture: ComponentFixture<AdminProjects>;
  let http: HttpTestingController;

  const draft: AdminProject = {
    id: 2,
    title: 'Draft idea',
    description: null,
    url: null,
    imageUrl: null,
    displayOrder: 0,
    published: false,
    createdAt: '2026-10-01T12:00:00Z',
  };
  const hub: AdminProject = {
    id: 1,
    title: 'Portfolio Hub',
    description: 'A modular monolith',
    url: 'https://example.com',
    imageUrl: null,
    displayOrder: 1,
    published: true,
    createdAt: '2026-09-30T12:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminProjects);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function text(selector: string): string {
    return host().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  function rows(): string[][] {
    return Array.from(host().querySelectorAll('tbody tr')).map((row) =>
      Array.from(row.querySelectorAll('th, td'))
        .slice(0, 4)
        .map((cell) => cell.textContent?.replace(/\s+/g, ' ').trim() ?? ''),
    );
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

  async function load(projects: AdminProject[]): Promise<void> {
    http.expectOne(LIST).flush(projects);
    await fixture.whenStable();
  }

  async function click(name: string): Promise<void> {
    button(name).click();
    await fixture.whenStable();
  }

  /** The list reloads after a change; wait for that request to be sent, answer it, then let the page settle. */
  async function answerReload(projects: AdminProject[]): Promise<void> {
    const reload = await vi.waitFor(() => http.expectOne(LIST));
    reload.flush(projects);
    await fixture.whenStable();
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

  async function type(label: string, value: string): Promise<void> {
    const control = field(label);
    control.value = value;
    control.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  function openForm(): HTMLFormElement | null {
    return host().querySelector('form');
  }

  it('shows a loading message while projects load', () => {
    const request = http.expectOne(LIST);

    expect(text('[role="status"]')).toBe('Loading projects…');

    request.flush([]);
  });

  it('lists all projects including drafts, in the order returned', async () => {
    await load([draft, hub]);

    expect(rows()).toEqual([
      ['Draft idea', '0', 'Draft', 'Oct 1, 2026'],
      ['Portfolio Hub', '1', 'Published', 'Sep 30, 2026'],
    ]);
  });

  it('says so when there are no projects yet', async () => {
    await load([]);

    expect(host().querySelector('table')).toBeNull();
    expect(text('[role="status"]')).toBe('No projects yet.');
  });

  it('explains that sign-in is required when the API answers 401', async () => {
    http.expectOne(LIST).flush(null, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();

    expect(text('[role="status"]')).toBe(
      'You need to sign in to manage projects. Sign-in arrives in a later release.',
    );
  });

  it('explains when the signed-in user is not allowed to manage projects', async () => {
    http.expectOne(LIST).flush(null, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();

    expect(text('[role="status"]')).toBe("You don't have permission to manage projects.");
  });

  it('shows a general error when projects fail to load for another reason', async () => {
    http.expectOne(LIST).flush(null, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(text('[role="status"]')).toBe("Projects couldn't be loaded. Please try again.");
  });

  it('names the project in each delete button for screen readers', async () => {
    await load([hub]);

    expect(button('Delete Portfolio Hub')).toBeTruthy();
  });

  it('asks for confirmation and sends nothing when the delete is cancelled', async () => {
    await load([hub]);

    await click('Delete Portfolio Hub');
    expect(text('tbody tr')).toContain('Delete Portfolio Hub?');
    await click('Cancel');

    http.expectNone({ method: 'DELETE' });
    expect(button('Delete Portfolio Hub')).toBeTruthy();
  });

  it('deletes a project after confirmation and refreshes the list', async () => {
    await load([draft, hub]);

    await click('Delete Portfolio Hub');
    button('Confirm delete').click(); // DELETE is sent synchronously; don't wait for stability yet
    const request = http.expectOne(`${LIST}/1`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });

    await answerReload([draft]);
    expect(rows().map(([title]) => title)).toEqual(['Draft idea']);
  });

  it('reports a failed delete and keeps the project listed', async () => {
    await load([hub]);

    await click('Delete Portfolio Hub');
    button('Confirm delete').click(); // DELETE is sent synchronously; don't wait for stability yet
    http.expectOne(`${LIST}/1`).flush(null, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(text('[role="alert"]')).toBe('Portfolio Hub could not be deleted. Please try again.');
    expect(rows().map(([title]) => title)).toEqual(['Portfolio Hub']);
  });

  it('refreshes the list when the project was already deleted elsewhere', async () => {
    await load([hub]);

    await click('Delete Portfolio Hub');
    button('Confirm delete').click(); // DELETE is sent synchronously; don't wait for stability yet
    http
      .expectOne(`${LIST}/1`)
      .flush({ status: 404, code: 'project-not-found' }, { status: 404, statusText: 'Not Found' });

    await answerReload([]);
    expect(text('[role="alert"]')).toBe('Portfolio Hub had already been deleted.');
  });

  it('creates a project from the list and refreshes it', async () => {
    await load([hub]);

    await click('New project');
    expect(openForm()?.querySelector('h2')?.textContent?.trim()).toBe('New project');
    await type('Title', 'Side project');
    await type('Display order', '2');

    button('Create project').click(); // POST is sent synchronously; don't wait for stability yet
    const create = http.expectOne({ method: 'POST', url: LIST });
    expect(create.request.body).toEqual(
      expect.objectContaining({ title: 'Side project', displayOrder: 2 }),
    );
    const created: AdminProject = { ...draft, id: 3, title: 'Side project', displayOrder: 2 };
    create.flush(created);

    await answerReload([hub, created]);
    expect(openForm()).toBeNull();
    expect(rows().map(([title]) => title)).toEqual(['Portfolio Hub', 'Side project']);
    expect(text('[role="status"]')).toBe('Saved Side project.');
    expect(document.activeElement).toBe(button('New project'));
  });

  it('edits a project from its row via a full replace', async () => {
    await load([draft, hub]);

    await click('Edit Portfolio Hub');
    expect(openForm()?.querySelector('h2')?.textContent?.trim()).toBe('Edit Portfolio Hub');
    expect(field('Title').value).toBe('Portfolio Hub');
    await type('Title', 'Portfolio Hub v2');

    button('Save changes').click(); // PUT is sent synchronously; don't wait for stability yet
    const replace = http.expectOne(`${LIST}/1`);
    expect(replace.request.method).toBe('PUT');
    expect(replace.request.body).toEqual({
      title: 'Portfolio Hub v2',
      description: 'A modular monolith',
      url: 'https://example.com',
      imageUrl: '',
      displayOrder: 1,
      published: true,
    });
    const updated: AdminProject = { ...hub, title: 'Portfolio Hub v2' };
    replace.flush(updated);

    await answerReload([draft, updated]);
    expect(openForm()).toBeNull();
    expect(rows().map(([title]) => title)).toEqual(['Draft idea', 'Portfolio Hub v2']);
    expect(text('[role="status"]')).toBe('Saved Portfolio Hub v2.');
    // Focus returns to the row's Edit button, whose accessible name now carries the new title.
    expect(document.activeElement).toBe(button('Edit Portfolio Hub v2'));
  });

  it('closes the form without saving when cancelled', async () => {
    await load([hub]);

    await click('New project');
    await type('Title', 'Never mind');
    await click('Cancel');

    http.expectNone({ method: 'POST', url: LIST });
    expect(openForm()).toBeNull();
    expect(rows().map(([title]) => title)).toEqual(['Portfolio Hub']);
    expect(document.activeElement).toBe(button('New project'));
  });
});
