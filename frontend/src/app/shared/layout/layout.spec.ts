import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Layout } from './layout';

describe('Layout', () => {
  async function render(): Promise<HTMLElement> {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Layout);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders a primary nav link to each of the six public pages', async () => {
    const host = await render();

    const links = Array.from(
      host.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Primary"] a'),
    ).map((a) => [a.textContent?.trim(), a.getAttribute('href')]);

    expect(links).toEqual([
      ['Home', '/'],
      ['About', '/about'],
      ['Skills', '/skills'],
      ['Projects', '/projects'],
      ['Resume', '/resume'],
      ['Contact', '/contact'],
    ]);
  });

  it('offers a skip link that targets the main content', async () => {
    const host = await render();

    expect(host.querySelector('a.skip-link')?.getAttribute('href')).toBe('#main');
    expect(host.querySelector('main#main')).not.toBeNull();
  });
});
