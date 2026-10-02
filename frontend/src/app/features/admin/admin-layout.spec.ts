import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminLayout } from './admin-layout';

describe('AdminLayout', () => {
  async function render(): Promise<HTMLElement> {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(AdminLayout);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('links to each admin area from the admin nav', async () => {
    const host = await render();

    const links = Array.from(
      host.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Admin"] a'),
    ).map((a) => [a.textContent?.trim(), a.getAttribute('href')]);

    expect(links).toEqual([['Projects', '/admin/projects']]);
  });

  it('offers a way back to the public site', async () => {
    const host = await render();

    const back = Array.from(host.querySelectorAll<HTMLAnchorElement>('header a')).find(
      (a) => a.textContent?.trim() === 'View site',
    );
    expect(back?.getAttribute('href')).toBe('/');
  });

  it('renders admin pages inside a main landmark', async () => {
    const host = await render();

    expect(host.querySelector('main#main router-outlet')).not.toBeNull();
  });
});
