import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Skills } from './skills';

describe('Skills', () => {
  let fixture: ComponentFixture<Skills>;

  beforeEach(() => {
    fixture = TestBed.createComponent(Skills);
    fixture.detectChanges();
  });

  function sections(): HTMLElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('section.card'));
  }

  function skillsIn(groupName: string): string[] {
    const section = sections().find(
      (s) => s.querySelector('h2')?.textContent?.trim() === groupName,
    );
    return Array.from(section?.querySelectorAll('li') ?? []).map(
      (li) => li.textContent?.trim() ?? '',
    );
  }

  it('shows each skill group as a section labelled by its heading', () => {
    const labels = sections().map((section) => {
      const heading = section.querySelector(`#${section.getAttribute('aria-labelledby')}`);
      expect(heading?.tagName).toBe('H2');
      return heading?.textContent?.trim();
    });

    expect(labels).toEqual(['Backend', 'Frontend', 'Data', 'Delivery and operations', 'Practices']);
  });

  it('lists service boundaries alongside Spring Modulith in Backend', () => {
    const backend = skillsIn('Backend');
    const modulith = backend.indexOf('Spring Modulith');

    expect(backend.slice(modulith, modulith + 2)).toEqual([
      'Spring Modulith',
      'Service boundaries and when to split them',
    ]);
  });

  it('lists nginx under Delivery and operations', () => {
    expect(skillsIn('Delivery and operations')).toContain('nginx');
  });
});
