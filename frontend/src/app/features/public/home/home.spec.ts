import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Home } from './home';

describe('Home', () => {
  let fixture: ComponentFixture<Home>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function status(): string {
    const el = (fixture.nativeElement as HTMLElement).querySelector('[role="status"]');
    return el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  it('shows a loading message while the ping is in flight', () => {
    const request = http.expectOne('/api/v1/ping');

    expect(status()).toBe('Checking backend…');

    request.flush({ status: 'ok', version: '0.1.0' });
  });

  it('shows the backend version once the ping succeeds', async () => {
    http.expectOne('/api/v1/ping').flush({ status: 'ok', version: '0.1.0' });
    await fixture.whenStable();

    expect(status()).toBe('Backend online · version 0.1.0');
  });

  it('shows an unavailable message when the ping fails', async () => {
    http.expectOne('/api/v1/ping').flush(null, { status: 503, statusText: 'Service Unavailable' });
    await fixture.whenStable();

    expect(status()).toBe('Backend unavailable right now.');
  });
});
