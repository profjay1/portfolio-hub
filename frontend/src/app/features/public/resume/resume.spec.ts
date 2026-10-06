import { TestBed } from '@angular/core/testing';
import { Resume } from './resume';

describe('Resume', () => {
  async function render(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(Resume);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function downloadLink(host: HTMLElement): HTMLAnchorElement {
    const link = Array.from(host.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Download resume'),
    );
    if (!link) {
      throw new Error('No download link');
    }
    return link;
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

  it('keeps the page heading for navigation', async () => {
    const host = await render();

    expect(host.querySelector('h1')?.textContent?.trim()).toBe('Resume');
  });
});
