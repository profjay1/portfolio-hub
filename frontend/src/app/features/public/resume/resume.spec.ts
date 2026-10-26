import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Resume } from './resume';

describe('Resume', () => {
  async function render(): Promise<HTMLElement> {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Resume);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function linkContaining(host: HTMLElement, text: string): HTMLAnchorElement {
    const link = Array.from(host.querySelectorAll('a')).find((a) => a.textContent?.includes(text));
    if (!link) {
      throw new Error(`No link containing "${text}"`);
    }
    return link;
  }

  function downloadLink(host: HTMLElement): HTMLAnchorElement {
    return linkContaining(host, 'Download resume');
  }

  it('links straight to the resume download endpoint', async () => {
    const host = await render();

    expect(downloadLink(host).getAttribute('href')).toBe('/api/v1/resume/download');
  });

  it('asks the browser to download the file rather than navigate to it', async () => {
    const host = await render();

    expect(downloadLink(host).hasAttribute('download')).toBe(true);
  });

  it('tells visitors the file format before they download it', async () => {
    const host = await render();

    expect(downloadLink(host).textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Download resume (PDF)',
    );
  });

  it('offers visitors a way to get in touch next to the download', async () => {
    const host = await render();

    expect(linkContaining(host, 'Get in touch').getAttribute('href')).toBe('/contact');
  });

  it('keeps the page heading for navigation', async () => {
    const host = await render();

    expect(host.querySelector('h1')?.textContent?.trim()).toBe('Resume');
  });
});
