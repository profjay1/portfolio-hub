import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PublicProject } from './project';
import { Projects } from './projects';

describe('Projects', () => {
  let fixture: ComponentFixture<Projects>;
  let http: HttpTestingController;

  const hub: PublicProject = {
    id: 1,
    title: 'Portfolio Hub',
    description: 'A modular monolith with an Angular front end.',
    url: 'https://example.com/hub',
    imageUrl: 'https://example.com/hub.png',
    displayOrder: 0,
  };
  const bare: PublicProject = {
    id: 2,
    title: 'Side project',
    description: null,
    url: null,
    imageUrl: null,
    displayOrder: 1,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Projects);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function status(): string {
    return host().querySelector('[role="status"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  async function respondWith(projects: PublicProject[]): Promise<void> {
    http.expectOne('/api/v1/projects').flush(projects);
    await fixture.whenStable();
  }

  it('shows a loading message while projects load', () => {
    const request = http.expectOne('/api/v1/projects');

    expect(status()).toBe('Loading projects…');

    request.flush([]);
  });

  it('renders published projects as cards in the returned order', async () => {
    await respondWith([bare, hub]);

    const titles = Array.from(host().querySelectorAll('article h2')).map((h) =>
      h.textContent?.trim(),
    );
    expect(titles).toEqual(['Side project', 'Portfolio Hub']);
    expect(status()).toBe('');
  });

  it('shows the description, link and image only when present', async () => {
    await respondWith([hub, bare]);

    const [full, minimal] = Array.from(host().querySelectorAll('article'));
    expect(full.textContent).toContain('A modular monolith with an Angular front end.');
    expect(full.querySelector('a')?.getAttribute('href')).toBe('https://example.com/hub');
    expect(full.querySelector('a')?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(full.querySelector('img')?.getAttribute('src')).toBe('https://example.com/hub.png');
    expect(full.querySelector('img')?.getAttribute('alt')).toBe('Portfolio Hub preview');

    expect(minimal.querySelector('p')).toBeNull();
    expect(minimal.querySelector('a')).toBeNull();
    expect(minimal.querySelector('img')).toBeNull();
  });

  it('shows a friendly message when nothing is published', async () => {
    await respondWith([]);

    expect(host().querySelector('article')).toBeNull();
    expect(status()).toBe('No projects are published yet. Check back soon.');
  });

  it('shows an error message when projects fail to load', async () => {
    http
      .expectOne('/api/v1/projects')
      .flush(null, { status: 503, statusText: 'Service Unavailable' });
    await fixture.whenStable();

    expect(host().querySelector('article')).toBeNull();
    expect(status()).toBe("Projects couldn't be loaded right now. Please try again later.");
  });
});
